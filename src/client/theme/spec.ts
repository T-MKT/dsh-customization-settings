/**
 * 主题（Theme）领域模型与校验（架构文档 §3.2）。
 *
 * `tokens` 以 `Record<string, { light; dark }>` 承载：校验必须接受任意
 * 未知输入，宽松的 key 类型便于在运行期检查后再按需收窄。
 */

import type { TOKEN_KEYS } from './tokens.js'
import { THEME_TOKEN_KEYS } from './tokens.js'
import { findPreset } from './presets.js'
import { assetUrl } from './assets.js'

/** 侧边栏专属遮罩（自定义颜色 + 透明度；渲染为侧边栏区域上的覆盖层，保证侧边栏文字可读）。 */
export interface SidebarMask {
  /** #rrggbb */
  color: string
  /** 0~1 */
  opacity: number
}

export interface Wallpaper {
  /** 'preset:<key>' | URL | null（无壁纸） */
  image: string | null
  placement: 'fullscreen' | 'conversation'
  /** 主遮罩透明度 0~1（颜色固定为 --dsw-alias-bg-base，随明暗自适应，不提供自定义颜色）。 */
  maskOpacity: number
  /** 侧边栏专属遮罩（可选；未设置时渲染回退 --dsw-specific-sidebar-fill @ 0.6）。 */
  sidebarMask?: SidebarMask
}

export interface TokenSet {
  colorScheme: 'light' | 'dark' | 'dual'
  tokens: Record<string, { light: string; dark: string }>
}

export interface Theme {
  schemaVersion: 1
  id: string
  name: string
  kind: 'preset'
  wallpaper: Wallpaper
  tokenSet: TokenSet
}

/** 非 null 的非数组对象（可用于 `unknown` 收窄）。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 校验未知输入是否为合法主题；合法返回 `null`，否则返回中文错误信息。
 */
export function validateTheme(theme: unknown): string | null {
  if (!isRecord(theme)) return '主题必须是对象'
  if (theme.schemaVersion !== 1) return '主题的 schemaVersion 必须为 1'
  if (typeof theme.id !== 'string') return '主题的 id 必须是字符串'
  if (typeof theme.name !== 'string') return '主题的 name 必须是字符串'
  if (theme.kind !== 'preset') return '主题的 kind 必须是 "preset"'

  if (!isRecord(theme.tokenSet)) return 'tokenSet 必须是对象'
  const { colorScheme } = theme.tokenSet
  if (colorScheme !== 'light' && colorScheme !== 'dark' && colorScheme !== 'dual') {
    return 'tokenSet.colorScheme 必须是 "light"、"dark" 或 "dual"'
  }

  if (!isRecord(theme.tokenSet.tokens)) return 'tokenSet.tokens 必须是对象'
  for (const [key, value] of Object.entries(theme.tokenSet.tokens)) {
    if (
      !isRecord(value)
      || typeof value.light !== 'string'
      || value.light.length === 0
      || typeof value.dark !== 'string'
      || value.dark.length === 0
    ) {
      return `tokenSet.tokens["${key}"] 必须是包含非空 light/dark 字符串的对象`
    }
  }

  if (!isRecord(theme.wallpaper)) return 'wallpaper 必须是对象'
  const { image, placement, maskOpacity, sidebarMask } = theme.wallpaper
  if (image !== null && typeof image !== 'string') return 'wallpaper.image 必须是字符串或 null'
  if (placement !== 'fullscreen' && placement !== 'conversation') {
    return 'wallpaper.placement 必须是 "fullscreen" 或 "conversation"'
  }
  if (typeof maskOpacity !== 'number' || Number.isNaN(maskOpacity) || maskOpacity < 0 || maskOpacity > 1) {
    return 'wallpaper.maskOpacity 必须是 0~1 之间的数字'
  }
  if (sidebarMask !== undefined) {
    const err = validateSidebarMask(sidebarMask)
    if (err) return `wallpaper.sidebarMask ${err}`
  }

  return null
}

/** 校验侧边栏遮罩形状；合法返回 `null`，否则返回中文错误信息。 */
function validateSidebarMask(value: unknown): string | null {
  if (!isRecord(value)) return '必须是对象'
  if (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color)) {
    return 'color 必须是 #rrggbb 格式的十六进制颜色'
  }
  if (typeof value.opacity !== 'number' || Number.isNaN(value.opacity) || value.opacity < 0 || value.opacity > 1) {
    return 'opacity 必须是 0~1 之间的数字'
  }
  return null
}

/** 便捷判断：是否为双主题（light/dark 双套）。 */
export function isDual(tokenSet: TokenSet): boolean {
  return tokenSet.colorScheme === 'dual'
}

/**
 * 壁纸差异（架构文档 §7.2）：只含用户改过的维度，未改项保持 `undefined`，
 * 渲染时从基底（basePresetId 对应主题或 shell 默认）继承。
 */
export type WallpaperDiff = Partial<Pick<Wallpaper, 'image' | 'placement' | 'maskOpacity' | 'sidebarMask'>>

/**
 * 自定义主题差异模型：只存用户改过的维度。
 * - `wallpaper`：壁纸四维中改过的子集；
 * - `tokenDiffs`：改过的 token 子集（键必须来自 THEME_TOKEN_KEYS）。
 */
export interface ThemeDiffs {
  wallpaper?: WallpaperDiff
  tokenDiffs?: Partial<Record<TOKEN_KEYS, { light: string; dark: string }>>
}

/** 自定义主题：基底预置 + 用户差异；`basePresetId` 为 `null` 表示 shell 默认。 */
export interface CustomTheme {
  /** 'custom.<uuid>' */
  id: string
  name: string
  basePresetId: string | null
  diffs: ThemeDiffs
}

/**
 * 校验未知输入是否为合法自定义主题；合法返回 `null`，否则返回中文错误信息。
 * 风格与 `validateTheme` 一致：isRecord 收窄 + 逐项检查。
 */
export function validateCustomTheme(theme: unknown): string | null {
  if (!isRecord(theme)) return '自定义主题必须是对象'
  if (typeof theme.id !== 'string' || theme.id.length === 0) {
    return '自定义主题的 id 必须是非空字符串'
  }
  if (!theme.id.startsWith('custom.')) return '自定义主题的 id 必须以 "custom." 开头'
  if (typeof theme.name !== 'string' || theme.name.length === 0) {
    return '自定义主题的 name 必须是非空字符串'
  }
  if (theme.basePresetId !== null && typeof theme.basePresetId !== 'string') {
    return '自定义主题的 basePresetId 必须是字符串或 null'
  }

  if (!isRecord(theme.diffs)) return '自定义主题的 diffs 必须是对象'

  const { wallpaper } = theme.diffs
  if (wallpaper !== undefined) {
    if (!isRecord(wallpaper)) return 'diffs.wallpaper 必须是对象'
    const { image, placement, maskOpacity, sidebarMask } = wallpaper
    if (image !== undefined && image !== null && typeof image !== 'string') {
      return 'diffs.wallpaper.image 必须是字符串或 null'
    }
    if (placement !== undefined && placement !== 'fullscreen' && placement !== 'conversation') {
      return 'diffs.wallpaper.placement 必须是 "fullscreen" 或 "conversation"'
    }
    if (
      maskOpacity !== undefined
      && (typeof maskOpacity !== 'number' || Number.isNaN(maskOpacity) || maskOpacity < 0 || maskOpacity > 1)
    ) {
      return 'diffs.wallpaper.maskOpacity 必须是 0~1 之间的数字'
    }
    if (sidebarMask !== undefined) {
      const err = validateSidebarMask(sidebarMask)
      if (err) return `diffs.wallpaper.sidebarMask ${err}`
    }
  }

  const { tokenDiffs } = theme.diffs
  if (tokenDiffs !== undefined) {
    if (!isRecord(tokenDiffs)) return 'diffs.tokenDiffs 必须是对象'
    for (const [key, value] of Object.entries(tokenDiffs)) {
      if (!(THEME_TOKEN_KEYS as readonly string[]).includes(key)) {
        return `diffs.tokenDiffs 包含未知 token: ${key}`
      }
      if (
        !isRecord(value)
        || typeof value.light !== 'string'
        || value.light.length === 0
        || typeof value.dark !== 'string'
        || value.dark.length === 0
      ) {
        return `diffs.tokenDiffs["${key}"] 必须是包含非空 light/dark 字符串的对象`
      }
    }
  }

  return null
}

/** 生成新的自定义主题 id（`custom.<uuid>`；无 `crypto.randomUUID` 时回退时间戳+随机串）。 */
export function newCustomThemeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom.${crypto.randomUUID()}`
  }
  return `custom.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 合并壁纸基底与差异：`diff` 字段存在时取差异值，否则取 `base` 值，
 * 否则取默认（placement 'fullscreen'、maskOpacity 0、image null、无侧边栏遮罩）。
 * `base` 与 `diff` 都为空（undefined）时返回 `null`（无壁纸）。
 */
export function mergeWallpaper(
  base: Wallpaper | null | undefined,
  diff: WallpaperDiff | undefined,
): Wallpaper | null {
  if (base === undefined && diff === undefined) return null
  const baseWallpaper = base ?? null
  const sidebarMask = diff?.sidebarMask !== undefined ? diff.sidebarMask : baseWallpaper?.sidebarMask
  return {
    image: diff?.image !== undefined ? diff.image : baseWallpaper?.image ?? null,
    placement: diff?.placement !== undefined ? diff.placement : baseWallpaper?.placement ?? 'fullscreen',
    maskOpacity: diff?.maskOpacity !== undefined ? diff.maskOpacity : baseWallpaper?.maskOpacity ?? 0,
    ...(sidebarMask !== undefined ? { sidebarMask } : {}),
  }
}

// ---------------------------------------------------------------------------
// M3 导入导出（架构 §3.2 Theme 序列化 + §7.4 / plan-m3 §3 提交点 2）
// ---------------------------------------------------------------------------
//
// 导出格式 = 合成后的完整 Theme（基底 + 差异），而非差异本身：
// `asset:`/`preset:`/URL 引用原样保留相对 id（不内嵌图片数据）；
// 导入时校验 schemaVersion / 结构 / basePresetId / asset 存在性，
// 再按「完整值 − 基底值」反推差异（与基底相同的维度不进入 diffs）。

/** 导出/导入的 JSON 形状（§3 序列化格式；wallpaper 为合成后的完整壁纸）。 */
export interface SerializedTheme {
  schemaVersion: 1
  name: string
  basePresetId: string | null
  /** 合成后的完整壁纸（基底 + 差异）；null = 无壁纸。 */
  wallpaper: Wallpaper | null
  tokenSet: {
    colorScheme: 'dual'
    /** 合成后的完整 token 值；基底为 null 时只含差异过的键。 */
    tokens: Partial<Record<TOKEN_KEYS, { light: string; dark: string }>>
  }
}

/**
 * 序列化自定义方案为可导入的 JSON 字符串（§3 形状）：
 * - 壁纸：基底壁纸 + 差异合并后的完整 Wallpaper（两者皆空 → null）；
 * - token：差异值优先，其次基底值；基底为 null 时只导出差异过的键；
 * - `asset:` / `preset:` / URL 引用原样保留。
 */
export function serializeTheme(custom: CustomTheme, base: Theme | null): string {
  const tokens: SerializedTheme['tokenSet']['tokens'] = {}
  for (const key of THEME_TOKEN_KEYS) {
    const pair = custom.diffs.tokenDiffs?.[key] ?? base?.tokenSet.tokens[key]
    if (pair) tokens[key] = pair
  }
  const serialized: SerializedTheme = {
    schemaVersion: 1,
    name: custom.name,
    basePresetId: custom.basePresetId,
    // 基底缺失时传 undefined（而非 null）：mergeWallpaper 在「基底与差异皆空」时返回 null（无壁纸），
    // 避免把「无壁纸」导出成一份全默认值的 wallpaper 对象，导致导入时误生成壁纸差异。
    wallpaper: mergeWallpaper(base?.wallpaper ?? undefined, custom.diffs.wallpaper),
    tokenSet: { colorScheme: 'dual', tokens },
  }
  return JSON.stringify(serialized, null, 2)
}

/**
 * 导出文件名建议：`theme-<slug>-<yyyy-mm-dd>.json`（slug 由方案名派生，保留中文）。
 */
export function themeExportFilename(name: string): string {
  const slug =
    name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'
  const date = new Date().toISOString().slice(0, 10)
  return `theme-${slug}-${date}.json`
}

/**
 * 校验 `asset:<id>` 引用在宿主资产通道存在（HEAD 请求，宿主 GET 路由同时支持 HEAD）；
 * 不存在或请求失败 → 抛可读中文错误（资产无法验证即拒绝，保证不落盘脏引用）。
 */
async function assertAssetExists(id: string): Promise<void> {
  let ok = false
  try {
    const res = await fetch(assetUrl(id), { method: 'HEAD' })
    ok = res.ok
  } catch {
    ok = false
  }
  if (!ok) throw new Error(`导入失败：壁纸资产不存在（asset:${id}）`)
}

/**
 * 解析导入的 JSON 为 CustomTheme（新 id `custom.<uuid>`）：
 * - JSON 解析失败 / schemaVersion 非 1 / 结构校验失败 → 抛可读中文错误（不部分落盘）；
 * - `basePresetId` 必须为 `null` 或 `PRESETS` 中存在的预置 id，否则拒绝；
 * - `asset:` 引用经宿主资产通道校验存在，不存在则拒绝整单；
 * - 差异由「完整值 − 基底值」反推：与基底相同的维度不进入 diffs。
 */
export async function parseTheme(json: string): Promise<CustomTheme> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '解析错误'
    throw new Error(`导入失败：不是有效的 JSON（${detail}）`)
  }
  if (!isRecord(raw)) throw new Error('导入失败：文件内容必须是 JSON 对象')
  if (raw.schemaVersion !== 1) throw new Error('导入失败：不支持的 schemaVersion（当前仅支持 1）')
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error('导入失败：name 必须是非空字符串')
  }
  if (raw.basePresetId !== null && typeof raw.basePresetId !== 'string') {
    throw new Error('导入失败：basePresetId 必须是字符串或 null')
  }
  const basePresetId = raw.basePresetId as string | null
  if (basePresetId !== null && !findPreset(basePresetId)) {
    throw new Error(`导入失败：basePresetId 对应的预置主题不存在（${basePresetId}）`)
  }

  // ---- wallpaper（null 或完整 Wallpaper 形状；旧导出文件可能带 maskColor，忽略该键） ----
  let wallpaper: Wallpaper | null = null
  if (raw.wallpaper !== null) {
    if (!isRecord(raw.wallpaper)) throw new Error('导入失败：wallpaper 必须是对象或 null')
    const { image, placement, maskOpacity, sidebarMask } = raw.wallpaper
    if (image !== null && typeof image !== 'string') {
      throw new Error('导入失败：wallpaper.image 必须是字符串或 null')
    }
    if (placement !== 'fullscreen' && placement !== 'conversation') {
      throw new Error('导入失败：wallpaper.placement 必须是 "fullscreen" 或 "conversation"')
    }
    if (typeof maskOpacity !== 'number' || Number.isNaN(maskOpacity) || maskOpacity < 0 || maskOpacity > 1) {
      throw new Error('导入失败：wallpaper.maskOpacity 必须是 0~1 之间的数字')
    }
    let parsedSidebarMask: SidebarMask | undefined
    if (sidebarMask !== undefined) {
      const err = validateSidebarMask(sidebarMask)
      if (err) throw new Error(`导入失败：wallpaper.sidebarMask ${err}`)
      parsedSidebarMask = sidebarMask as SidebarMask
    }
    wallpaper = {
      image,
      placement,
      maskOpacity,
      ...(parsedSidebarMask !== undefined ? { sidebarMask: parsedSidebarMask } : {}),
    }
  }

  // ---- tokenSet（仅支持 dual：本插件差异模型为 light/dark 双值） ----
  if (!isRecord(raw.tokenSet)) throw new Error('导入失败：tokenSet 必须是对象')
  if (raw.tokenSet.colorScheme !== 'dual') {
    throw new Error('导入失败：tokenSet.colorScheme 必须是 "dual"（本插件仅支持明暗双值色板）')
  }
  if (!isRecord(raw.tokenSet.tokens)) throw new Error('导入失败：tokenSet.tokens 必须是对象')
  const importedTokens: Partial<Record<TOKEN_KEYS, { light: string; dark: string }>> = {}
  for (const [key, value] of Object.entries(raw.tokenSet.tokens)) {
    if (!(THEME_TOKEN_KEYS as readonly string[]).includes(key)) {
      throw new Error(`导入失败：tokenSet.tokens 包含未知 token: ${key}`)
    }
    if (
      !isRecord(value)
      || typeof value.light !== 'string'
      || value.light.length === 0
      || typeof value.dark !== 'string'
      || value.dark.length === 0
    ) {
      throw new Error(`导入失败：tokenSet.tokens["${key}"] 必须是包含非空 light/dark 字符串的对象`)
    }
    importedTokens[key as TOKEN_KEYS] = { light: value.light, dark: value.dark }
  }

  // ---- asset 引用校验（不存在 → 拒绝整单，不部分落盘） ----
  const assetId = wallpaper?.image?.startsWith('asset:')
    ? wallpaper.image.slice('asset:'.length)
    : null
  if (assetId) await assertAssetExists(assetId)

  // ---- 差异反推：完整值 − 基底值 ----
  const base = basePresetId ? findPreset(basePresetId) : undefined
  const diffs: ThemeDiffs = {}
  if (wallpaper) {
    const baseWallpaper = base?.wallpaper
    const diff: WallpaperDiff = {}
    if (!baseWallpaper || wallpaper.image !== baseWallpaper.image) diff.image = wallpaper.image
    if (!baseWallpaper || wallpaper.placement !== baseWallpaper.placement) diff.placement = wallpaper.placement
    if (!baseWallpaper || wallpaper.maskOpacity !== baseWallpaper.maskOpacity) diff.maskOpacity = wallpaper.maskOpacity
    const baseMask = baseWallpaper?.sidebarMask
    const nextMask = wallpaper.sidebarMask
    const maskChanged =
      (nextMask !== undefined) !== (baseMask !== undefined)
      || (nextMask !== undefined && baseMask !== undefined && (nextMask.color !== baseMask.color || nextMask.opacity !== baseMask.opacity))
    if (maskChanged && nextMask !== undefined) diff.sidebarMask = nextMask
    if (Object.keys(diff).length > 0) diffs.wallpaper = diff
  }
  const tokenDiffs: ThemeDiffs['tokenDiffs'] = {}
  for (const [key, pair] of Object.entries(importedTokens) as Array<
    [TOKEN_KEYS, { light: string; dark: string }]
  >) {
    const basePair = base?.tokenSet.tokens[key]
    if (basePair && basePair.light === pair.light && basePair.dark === pair.dark) continue
    tokenDiffs[key] = pair
  }
  if (Object.keys(tokenDiffs).length > 0) diffs.tokenDiffs = tokenDiffs

  return { id: newCustomThemeId(), name: raw.name.trim(), basePresetId, diffs }
}
