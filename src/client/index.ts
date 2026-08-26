import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { PRESETS } from './theme/presets.js'
import type { Theme } from './theme/spec.js'
import { createThemeService } from './theme/service.js'
import type { ThemeService } from './theme/service.js'
import { bindThemeStore } from './theme/store.js'
import type { ThemeStore } from './theme/store.js'
import { ThemeSection } from './components/ThemeSection.js'
import { installAppearanceEntryLink } from './appearanceEntryLink.js'
import { installSettingsNavStyle } from './settingsNavStyle.js'

/** 必填服务：slots 注册设置分区；settingsScope 绑定主题偏好；theme 合成主题色板。 */
export const inject = ['slots', 'settingsScope', 'theme']

/**
 * 组装「外观」设置分区（架构 §5.6.3 / plan 提交点 4）：
 *
 * 1. `bindThemeStore(ctx)` → store（settings scope，随 fiber 自动清理）；
 * 2. `createThemeService(ctx, store)` → service（注册预置、订阅 theme/change、
 *    应用色板 + 壁纸、M2 预览层/用户层合成）；其内部 disposer 经 `ctx.effect`
 *    挂到本 fiber，插件停用时全部释放；
 * 3. 在 `settings.section` 注册 `appearance` 分区（order 25），正文渲染
 *    ThemeSection——service/store/PRESETS 经注册的 `inject` 业务面注入组件，
 *    组件内不 `ctx.get`；
 * 4. 分区注册经 `ctx.slots.inject` 挂到 fiber，停用时随声明级联清理。
 */
export function apply(ctx: ClientContext): void {
  const store = bindThemeStore(ctx)
  const service = createThemeService(ctx, store)
  ctx.effect(() => () => service.dispose())

  // 在「通用设置 → 外观」快捷行内注入指向本「外观」分区的入口链接。
  ctx.effect(() => installAppearanceEntryLink())

  // 注入设置弹窗导航单元格（navCell）的 hover/active 样式覆盖（alias 交互色替代 specific 纯色）。
  ctx.effect(() => installSettingsNavStyle())

  const injected = (): { service: ThemeService; store: ThemeStore; presets: readonly Theme[] } => ({
    service,
    store,
    presets: PRESETS,
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'appearance',
      order: 25,
      label: '外观',
      inject: injected,
    },
    ThemeSection,
  ))
}
