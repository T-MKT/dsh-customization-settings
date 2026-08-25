/**
 * ThemeStore —— 架构文档 §5.4 的 L1 子集 + M2 扩展（settings scope 封装）。
 *
 * 通过 `ctx.settingsScope.bind` 绑定本插件自有 settings namespace
 * （THEME_SETTINGS_NAMESPACE，宿主侧已在 src/index.ts 注册 schema），读写落盘
 * `$DSH_HOME/settings.yaml` 的 `dsh-customization-settings` 段。
 *
 * 职责边界：负责「当前激活主题 id」（activeThemeId）与 M2 新增的
 * 自定义主题 CRUD（customThemes/activeCustomThemeId）；不接触 theme 服务、
 * 不处理壁纸（壁纸面由 service.ts 经 wallpaper.ts 渲染）。
 * scope 的 disposer 属于调用 fiber，卸载时自动清理，无需手动 dispose。
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { THEME_SETTINGS_NAMESPACE } from '../../settings.js'
import type { ThemeSettings } from '../../settings.js'
import type { CustomTheme } from './spec.js'
import { newCustomThemeId } from './spec.js'

/** namespace 内承载激活主题 id 的字段名。 */
const ACTIVE_THEME_ID_FIELD = 'activeThemeId'
/** namespace 内承载激活自定义主题 id 的字段名。 */
const ACTIVE_CUSTOM_THEME_ID_FIELD = 'activeCustomThemeId'
/** namespace 内承载自定义主题列表的字段名。 */
const CUSTOM_THEMES_FIELD = 'customThemes'

/**
 * L1 + M2 需要的存储接口。
 *
 * `getActiveThemeId` 读当前快照；`setActiveThemeId` 写入（`null` 表示清除、
 * 回退默认）；`subscribe` 透传 scope 快照订阅，供外部监听持久化值变化。
 * M2 新增：自定义主题 CRUD（create/list/save/remove）与激活自定义主题 id
 * 读写（`setActiveCustomThemeId(null)` 清除该字段，回退 schema 默认）。
 */
export interface ThemeStore {
  /** 当前激活的预置主题 id；`null` = 未应用任何预置（跟随系统/默认）。 */
  getActiveThemeId(): string | null
  /** 持久化激活主题 id；传 `null` 清除该字段（回退 schema 默认）。 */
  setActiveThemeId(id: string | null): Promise<void>
  /** 新建自定义主题（生成 `custom.<uuid>` id），仅返回内存对象，不落盘。 */
  createCustomTheme(name: string, basePresetId: string | null): CustomTheme
  /** 当前全部自定义主题（按保存顺序）。 */
  listCustomThemes(): CustomTheme[]
  /** 按 id upsert 保存自定义主题：读当前数组 → 过滤同 id → 追加 → 字段级写入。 */
  saveCustomTheme(theme: CustomTheme): Promise<void>
  /** 删除指定 id 的自定义主题。 */
  removeCustomTheme(id: string): Promise<void>
  /** 当前激活的自定义主题 id；`null` = 未激活任何自定义方案。 */
  getActiveCustomThemeId(): string | null
  /** 持久化激活自定义主题 id；传 `null` 清除该字段（回退 schema 默认）。 */
  setActiveCustomThemeId(id: string | null): Promise<void>
  /** 订阅快照变化，返回取消订阅的 disposer。 */
  subscribe(listener: () => void): () => void
}

/**
 * 绑定并返回 ThemeStore。
 *
 * `ctx.settingsScope` 由 @deepseek-ai/dsh-client-ui-settings 注入；bind 的 scope
 * disposer 属于调用 fiber，插件停用时自动清理。
 */
export function bindThemeStore(ctx: ClientContext): ThemeStore {
  // bind 返回的 scope 其 disposer 已属于当前调用 fiber，卸载时自动清理
  // （SettingsScopeBinder.bind 在调用方生命周期上建立），无需手动 dispose。
  const scope = ctx.settingsScope.bind<ThemeSettings>({
    namespace: THEME_SETTINGS_NAMESPACE,
  })

  return {
    getActiveThemeId() {
      return scope.getSnapshot().value?.activeThemeId ?? null
    },
    async setActiveThemeId(id: string | null) {
      if (id === null) {
        await scope.unset(ACTIVE_THEME_ID_FIELD)
      } else {
        await scope.set(ACTIVE_THEME_ID_FIELD, id)
      }
    },
    createCustomTheme(name, basePresetId) {
      return { id: newCustomThemeId(), name, basePresetId, diffs: {} }
    },
    listCustomThemes() {
      return scope.getSnapshot().value?.customThemes ?? []
    },
    async saveCustomTheme(theme) {
      const next = [
        ...(scope.getSnapshot().value?.customThemes ?? []).filter((item) => item.id !== theme.id),
        theme,
      ]
      await scope.set(CUSTOM_THEMES_FIELD, next)
    },
    async removeCustomTheme(id) {
      const next = (scope.getSnapshot().value?.customThemes ?? []).filter((item) => item.id !== id)
      await scope.set(CUSTOM_THEMES_FIELD, next)
    },
    getActiveCustomThemeId() {
      return scope.getSnapshot().value?.activeCustomThemeId ?? null
    },
    async setActiveCustomThemeId(id: string | null) {
      if (id === null) {
        await scope.unset(ACTIVE_CUSTOM_THEME_ID_FIELD)
      } else {
        await scope.set(ACTIVE_CUSTOM_THEME_ID_FIELD, id)
      }
    },
    subscribe(listener) {
      return scope.subscribe(listener)
    },
  }
}
