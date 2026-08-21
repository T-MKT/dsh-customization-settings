import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

/** 必填服务：浏览器半依赖 slots 服务注册设置分区。 */
export const inject = ['slots']

/**
 * 「外观」设置分区正文。
 *
 * 当前为空：后续「壁纸 / 主题色 / 字体与排版 / 模糊材质」等条目会作为
 * `settings.section` 内的行或子页面逐步填入（见 TODO.md）。
 */
function AppearanceSection(_props: SettingsSectionOwnerProps): null {
  return null
}

/**
 * 在设置面板左侧导航注册「外观」大类。
 *
 * - `id: "appearance"`：非 shell 特判 id，导航图标自动回退为齿轮，
 *   与「通用设置」(`general`) 一致。
 * - `order: 5`：排在「通用设置」(0) 之后、「模型」(10) 之前。
 * - `label: "外观"`：暂用字面量；后续接入 locale 服务补双语。
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'appearance',
      order: 5,
      label: '外观',
    },
    AppearanceSection,
  ))
}
