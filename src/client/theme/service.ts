/**
 * ThemeService —— 应用主题的合成层（架构文档 §5.6/§5.7）。
 *
 * 职责：
 * - 注册预置主题：把 PRESETS 的 dual 色板映射为两套单色系 theme 定义
 *   （`<presetId>.light` / `<presetId>.dark`）逐套 `ctx.theme.register`；
 * - 应用主题：`theme.setTheme(variantId)`（色板面）+ `applyWallpaper`（壁纸面）；
 * - 当前状态：订阅 `theme/change` 维护 effective 明暗态，供 UI 高亮与预览刷新；
 * - 持有全部 disposer（register 返回值、壁纸 disposer、theme/change 订阅），
 *   `dispose()` 一键全清理。
 *
 * 不 import 任何 React 组件；UI 仅通过本服务与 theme 服务、壁纸层交互。
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeSnapshot, ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'
import { findPreset, PRESETS } from './presets.js'
import { applyWallpaper } from './wallpaper.js'
import { getToken } from './tokens.js'
import type { TOKEN_KEYS } from './tokens.js'
import type { Theme } from './spec.js'
import type { ThemeStore } from './store.js'

/** 主题服务暴露给 UI 的合成接口。 */
export interface ThemeService {
  /**
   * 应用一个预置主题（或 `null` = 跟随系统 + 无壁纸）。
   * 持久化 activeThemeId 后立即切换色板与壁纸；失败抛出中文错误。
   */
  applyTheme(id: string | null): Promise<void>
  /** 当前激活的预置主题 id（来自 store 的持久化值）；`null` = 跟随系统/默认。 */
  getActiveId(): string | null
  /** 订阅激活主题或明暗态变化，返回取消订阅的 disposer。 */
  subscribe(listener: () => void): () => void
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

  /** 仅切换视觉（色板 + 壁纸），不写 store。 */
  function applyVisual(id: string | null): void {
    if (id === null) {
      ctx.theme.setTheme('system')
      disposeWallpaper()
      applyWallpaper(null)
      return
    }
    const preset = findPreset(id)
    if (!preset) throw new Error(`未知的预置主题: ${id}`)
    ctx.theme.setTheme(variantFor(preset))
    disposeWallpaper()
    wallpaperDisposer = applyWallpaper(preset.wallpaper)
  }

  function publish(): void {
    for (const listener of listeners) listener()
  }

  // 订阅 theme/change：维护明暗态通知 UI；跟随系统时保证预置色板随明暗翻转。
  themeChangeDisposer = ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
    const id = store.getActiveThemeId()
    if (id && snapshot.preference === 'system') {
      const preset = findPreset(id)
      if (preset && preset.tokenSet.colorScheme === 'dual') {
        const expected = `${id}.${snapshot.active.colorScheme}`
        if (snapshot.active.id !== expected) {
          // OS 明暗翻转而当前为 system → 切到对应变体（setTheme 幂等，防循环）。
          ctx.theme.setTheme(expected)
        }
      }
    }
    publish()
  })

  // 初始：应用已持久化的激活主题（刷新后保持，L1-F6）；null 则保持外壳默认。
  const initial = store.getActiveThemeId()
  if (initial && findPreset(initial)) applyVisual(initial)

  return {
    async applyTheme(id: string | null) {
      await store.setActiveThemeId(id)
      applyVisual(id)
      publish()
    },
    getActiveId() {
      return store.getActiveThemeId()
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
      themeChangeDisposer?.()
      themeChangeDisposer = null
      listeners.clear()
    },
  }
}
