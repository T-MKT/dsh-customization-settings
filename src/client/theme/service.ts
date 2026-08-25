/**
 * ThemeService —— 应用主题的合成层（架构文档 §5.6/§5.7）。
 *
 * 职责：
 * - 注册预置主题：把 PRESETS 的 dual 色板映射为两套单色系 theme 定义
 *   （`<presetId>.light` / `<presetId>.dark`）逐套 `ctx.theme.register`；
 * - 应用主题：`theme.setTheme(variantId)`（色板面）+ `applyWallpaper`（壁纸面）；
 * - 当前状态：订阅 `theme/change` 维护 effective 明暗态，供 UI 高亮与预览刷新；
 * - M2 扩展（架构 §7.2 编辑模型）：预览层 + 用户层合成——渲染 = 基底（预置或
 *   shell 默认）+ 差异（`overrideTokens` 固定 source + 壁纸变量），方案切换 =
 *   同 source 重复调用自动替换整层；`resolveActive` 描述当前生效方案；
 * - 持有全部 disposer（register 返回值、壁纸 disposer、token 差异层 disposer、
 *   theme/change 与 store 订阅），`dispose()` 一键全清理。
 *
 * 不 import 任何 React 组件；UI 仅通过本服务与 theme 服务、壁纸层交互。
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ThemePreference,
  ThemeSnapshot,
  ThemeTokens,
  ThemeTokenOverrides,
} from '@deepseek-ai/dsh-client-ui-theme/client'
import { findPreset, PRESETS } from './presets.js'
import { applyWallpaper } from './wallpaper.js'
import { getToken, THEME_TOKENS } from './tokens.js'
import type { TOKEN_KEYS } from './tokens.js'
import type { CustomTheme, Theme, ThemeDiffs } from './spec.js'
import { mergeWallpaper } from './spec.js'
import type { ThemeStore } from './store.js'

/** 预览层 overrideTokens source（架构 §4/plan §3）。 */
const PREVIEW_SOURCE = 'dsh-customization-settings.preview'
/** 用户层（自定义方案）overrideTokens source。 */
const CUSTOM_SOURCE = 'dsh-customization-settings.custom'

/** 当前生效方案的描述（供 UI 高亮与恢复默认，M3 用）。 */
export type ActiveResolution =
  | { kind: 'system' }
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; id: string }

/** 主题服务暴露给 UI 的合成接口。 */
export interface ThemeService {
  /**
   * 应用一个预置主题（或 `null` = 跟随系统 + 无壁纸）。
   * 持久化 activeThemeId 后立即切换色板与壁纸；未知 id 抛错；选择预置即退出自定义方案。
   */
  applyTheme(id: string | null): Promise<void>
  /** 当前激活的预置主题 id（来自 store 的持久化值）；`null` = 跟随系统/默认。 */
  getActiveId(): string | null
  /** 当前深浅色偏好（与「通用设置」Appearance 行一致）：`light`/`dark`/`system`。 */
  getPreference(): ThemePreference
  /** 订阅激活主题或明暗态变化，返回取消订阅的 disposer。 */
  subscribe(listener: () => void): () => void
  /** 激活（或取消）自定义方案：内部落库（saveCustomTheme）+ 设置 activeCustomThemeId + 立即重算渲染；null 取消。 */
  applyCustomTheme(theme: CustomTheme | null): Promise<void>
  /** 开始/更新实时预览（以 basePresetId 为基底 + diffs 覆盖）；返回「结束预览并恢复用户层」的 disposer；每次调用整体替换旧预览。 */
  beginPreview(basePresetId: string | null, diffs: ThemeDiffs): () => void
  /** 当前生效方案：custom > preset > system（activeCustomThemeId 存在且能找到对应方案时优先）。 */
  resolveActive(): ActiveResolution
  /** 释放全部资源：注册的 theme、壁纸变量、theme/change 订阅、监听集合。 */
  dispose(): void
}

/**
 * 创建 ThemeService。
 *
 * `ctx.theme` 与 `ctx.on('theme/change', ...)` 由 web 外壳注入；store 由
 * bindThemeStore 提供。store 的 scope 已随 fiber 清理，故此处仅管理本服务
 * 自有的 disposer。
 */
export function createThemeService(ctx: ClientContext, store: ThemeStore): ThemeService {
  const disposers: (() => void)[] = []
  let themeChangeDisposer: (() => void) | null = null
  let wallpaperDisposer: (() => void) | null = null
  let tokenDisposer: (() => void) | null = null
  let storeDisposer: (() => void) | null = null
  const listeners = new Set<() => void>()

  // ---- 注册预置 ----
  for (const preset of PRESETS) registerPreset(preset)

  function registerPreset(preset: Theme): void {
    const scheme = preset.tokenSet.colorScheme
    if (scheme === 'dual') {
      // dual → 两套单色系变体；注册后按其 id 切换（色板面仍携带各自明/暗值）。
      disposers.push(ctx.theme.register({
        id: `${preset.id}.light`,
        colorScheme: 'light',
        tokens: pickTokens(preset, 'light'),
      }))
      disposers.push(ctx.theme.register({
        id: `${preset.id}.dark`,
        colorScheme: 'dark',
        tokens: pickTokens(preset, 'dark'),
      }))
    } else {
      disposers.push(ctx.theme.register({
        id: `${preset.id}.${scheme}`,
        colorScheme: scheme,
        tokens: pickTokens(preset, scheme),
      }))
    }
  }

  // 从 token 双值表按明/暗抽取单值，键换成 CSS 变量名（register 的 token 契约）。
  function pickTokens(preset: Theme, mode: 'light' | 'dark'): ThemeTokens {
    const tokens: ThemeTokens = {}
    for (const [key, pair] of Object.entries(preset.tokenSet.tokens)) {
      const entry = getToken(key as TOKEN_KEYS)
      tokens[entry.cssVar] = mode === 'light' ? pair.light : pair.dark
    }
    return tokens
  }

  // ---- 应用 ----
  /** 当前 effective 明暗态（system 已被外壳解析为具体明暗）。 */
  function currentScheme(): 'light' | 'dark' {
    return ctx.theme.getTheme().active.colorScheme
  }

  /** 计算某预置当前应使用的已注册变体 id。 */
  function variantFor(preset: Theme): string {
    const scheme = preset.tokenSet.colorScheme
    return scheme === 'dual' ? `${preset.id}.${currentScheme()}` : `${preset.id}.${scheme}`
  }

  function disposeWallpaper(): void {
    wallpaperDisposer?.()
    wallpaperDisposer = null
  }

  function disposeTokenOverlay(): void {
    tokenDisposer?.()
    tokenDisposer = null
  }

  // ---- M2：预览层 / 用户层合成（架构 §7.2）----

  /** 预览会话（内存态）：预览期间暂挂用户层，结束（disposer）后恢复。 */
  let preview: { base: Theme | null; diffs: ThemeDiffs } | null = null

  /** 当前生效方案缓存（供 resolveActive 同步读取；publish 时刷新）。 */
  let activeCache: ActiveResolution = { kind: 'system' }

  /** 按 id 查找自定义方案；不存在返回 undefined。 */
  function findCustomTheme(id: string): CustomTheme | undefined {
    return store.listCustomThemes().find((theme) => theme.id === id)
  }

  /** 当前激活的自定义方案（activeCustomThemeId 对应且能找到）；否则 null。 */
  function activeCustomTheme(): CustomTheme | null {
    const id = store.getActiveCustomThemeId()
    if (!id) return null
    return findCustomTheme(id) ?? null
  }

  /**
   * 当前渲染应采用的「基底 + 差异 + 差异层 source」：
   * - 预览存在 → 预览基底 + 预览差异（PREVIEW_SOURCE）；
   * - 自定义方案存在 → 其基底（basePresetId 对应预置，未知/无 → null）+ 其差异（CUSTOM_SOURCE）；
   * - 否则 → 持久化的预置基底 + 空差异（无差异层）。
   */
  function effectiveState(): { base: Theme | null; diffs: ThemeDiffs; source: string | null } {
    if (preview) {
      return { base: preview.base, diffs: preview.diffs, source: PREVIEW_SOURCE }
    }
    const custom = activeCustomTheme()
    if (custom) {
      const base = custom.basePresetId ? findPreset(custom.basePresetId) ?? null : null
      return { base, diffs: custom.diffs, source: CUSTOM_SOURCE }
    }
    const id = store.getActiveThemeId()
    return { base: id ? findPreset(id) ?? null : null, diffs: {}, source: null }
  }

  /** 把 token 差异映射为 overrideTokens 契约（键经目录转 cssVar；未知键跳过）。 */
  function tokenOverridesFor(diffs: ThemeDiffs): ThemeTokenOverrides {
    const overrides: ThemeTokenOverrides = {}
    for (const [key, pair] of Object.entries(diffs.tokenDiffs ?? {})) {
      const entry = THEME_TOKENS.find((token) => token.key === key)
      if (!entry) continue
      overrides[entry.cssVar] = { light: pair.light, dark: pair.dark }
    }
    return overrides
  }

  /**
   * 整体重算当前渲染（架构 §7.2 分层合成）：
   * 色板基底（setTheme 或 system）→ 壁纸面（基底壁纸 + 差异合成）
   * → 色板差异层（overrideTokens；source 非 null 时叠加，同 source 自动替换整层）。
   */
  function recompose(): void {
    const { base, diffs, source } = effectiveState()
    if (base) {
      ctx.theme.setTheme(variantFor(base))
    } else {
      ctx.theme.setTheme('system')
    }
    disposeWallpaper()
    wallpaperDisposer = applyWallpaper(mergeWallpaper(base?.wallpaper ?? null, diffs.wallpaper))
    disposeTokenOverlay()
    if (source) {
      tokenDisposer = ctx.theme.overrideTokens(source, tokenOverridesFor(diffs))
    }
  }

  /** 计算当前生效方案：custom > preset > system（custom 需能在列表中找到，否则回落）。 */
  function computeActive(): ActiveResolution {
    const custom = activeCustomTheme()
    if (custom) return { kind: 'custom', id: custom.id }
    const id = store.getActiveThemeId()
    if (id && findPreset(id)) return { kind: 'preset', id }
    return { kind: 'system' }
  }

  function publish(): void {
    activeCache = computeActive()
    for (const listener of listeners) listener()
  }

  // 订阅 theme/change：维护明暗态通知 UI；跟随系统时保证预置色板随明暗翻转。
  themeChangeDisposer = ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
    const base = effectiveState().base
    if (base && snapshot.preference === 'system' && base.tokenSet.colorScheme === 'dual') {
      const expected = `${base.id}.${snapshot.active.colorScheme}`
      if (snapshot.active.id !== expected) {
        // OS 明暗翻转而当前为 system → 切到对应变体（setTheme 幂等，防循环）。
        ctx.theme.setTheme(expected)
      }
    }
    publish()
  })

  // 订阅 store 快照：持久化值（activeThemeId / customThemes / activeCustomThemeId）
  // 变化时重算渲染并通知——解决刷新后 settings 快照迟到的问题。
  storeDisposer = store.subscribe(() => {
    recompose()
    publish()
  })

  // 初始：应用持久化状态（色板/壁纸/差异层由 recompose 从 store 读取，刷新后保持）。
  recompose()
  // 初始：计算生效方案缓存。
  activeCache = computeActive()

  return {
    async applyTheme(id: string | null) {
      if (id !== null && !findPreset(id)) throw new Error(`未知的预置主题: ${id}`)
      await store.setActiveThemeId(id)
      await store.setActiveCustomThemeId(null)
      recompose()
      publish()
    },
    async applyCustomTheme(theme: CustomTheme | null) {
      if (theme !== null) {
        await store.saveCustomTheme(theme)
      }
      // 保存/取消编辑 = 结束预览会话（预览层与用户层互斥，架构 §7.4）；
      // 此后渲染以用户层（activeCustomThemeId）为准，由 store 订阅触发 recompose。
      preview = null
      await store.setActiveCustomThemeId(theme?.id ?? null)
      publish()
    },
    beginPreview(basePresetId, diffs) {
      preview = { base: basePresetId ? findPreset(basePresetId) ?? null : null, diffs }
      recompose()
      return () => {
        preview = null
        recompose()
      }
    },
    resolveActive() {
      return activeCache
    },
    getActiveId() {
      return store.getActiveThemeId()
    },
    getPreference() {
      return ctx.theme.getTheme().preference
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      for (const dispose of disposers) dispose()
      disposers.length = 0
      disposeWallpaper()
      disposeTokenOverlay()
      themeChangeDisposer?.()
      themeChangeDisposer = null
      storeDisposer?.()
      storeDisposer = null
      listeners.clear()
    },
  }
}
