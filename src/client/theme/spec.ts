/**
 * 主题（Theme）领域模型与校验（架构文档 §3.2）。
 *
 * `tokens` 以 `Record<string, { light; dark }>` 承载：校验必须接受任意
 * 未知输入，宽松的 key 类型便于在运行期检查后再按需收窄。
 */

import type { TOKEN_KEYS } from './tokens.js'
import { THEME_TOKEN_KEYS } from './tokens.js'

export interface Wallpaper {
  /** 'preset:<key>' | URL | null（无壁纸） */
  image: string | null
  placement: 'fullscreen' | 'conversation'
  /** #rrggbb */
  maskColor: string
  /** 0~1 */
  maskOpacity: number
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
  const { image, placement, maskColor, maskOpacity } = theme.wallpaper
  if (image !== null && typeof image !== 'string') return 'wallpaper.image 必须是字符串或 null'
  if (placement !== 'fullscreen' && placement !== 'conversation') {
    return 'wallpaper.placement 必须是 "fullscreen" 或 "conversation"'
  }
  if (typeof maskColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(maskColor)) {
    return 'wallpaper.maskColor 必须是 #rrggbb 格式的十六进制颜色'
  }
  if (typeof maskOpacity !== 'number' || Number.isNaN(maskOpacity) || maskOpacity < 0 || maskOpacity > 1) {
    return 'wallpaper.maskOpacity 必须是 0~1 之间的数字'
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
export type WallpaperDiff = Partial<Pick<Wallpaper, 'image' | 'placement' | 'maskColor' | 'maskOpacity'>>

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
    const { image, placement, maskColor, maskOpacity } = wallpaper
    if (image !== undefined && image !== null && typeof image !== 'string') {
      return 'diffs.wallpaper.image 必须是字符串或 null'
    }
    if (placement !== undefined && placement !== 'fullscreen' && placement !== 'conversation') {
      return 'diffs.wallpaper.placement 必须是 "fullscreen" 或 "conversation"'
    }
    if (maskColor !== undefined && (typeof maskColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(maskColor))) {
      return 'diffs.wallpaper.maskColor 必须是 #rrggbb 格式的十六进制颜色'
    }
    if (
      maskOpacity !== undefined
      && (typeof maskOpacity !== 'number' || Number.isNaN(maskOpacity) || maskOpacity < 0 || maskOpacity > 1)
    ) {
      return 'diffs.wallpaper.maskOpacity 必须是 0~1 之间的数字'
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
 * 否则取默认（placement 'fullscreen'、maskColor '#000000'、maskOpacity 0、image null）。
 * `base` 与 `diff` 都为空（undefined）时返回 `null`（无壁纸）。
 */
export function mergeWallpaper(
  base: Wallpaper | null | undefined,
  diff: WallpaperDiff | undefined,
): Wallpaper | null {
  if (base === undefined && diff === undefined) return null
  const baseWallpaper = base ?? null
  return {
    image: diff?.image !== undefined ? diff.image : baseWallpaper?.image ?? null,
    placement: diff?.placement !== undefined ? diff.placement : baseWallpaper?.placement ?? 'fullscreen',
    maskColor: diff?.maskColor !== undefined ? diff.maskColor : baseWallpaper?.maskColor ?? '#000000',
    maskOpacity: diff?.maskOpacity !== undefined ? diff.maskOpacity : baseWallpaper?.maskOpacity ?? 0,
  }
}
