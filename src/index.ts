import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema } from './settings.js'

/** Branded settings namespace, derived from the shared constant. */
const themeSettingsNs = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/**
 * Host: register the appearance settings namespace when the settings service
 * is available. Registration is an effect on this plugin's fiber and is cleaned
 * up when the fiber unloads. The returned scope is not used here; reads happen
 * on the client over the wire.
 *
 * 用 `ctx.inject` 而非一次性 `ctx.get('settings')`：loader 并发应用各条目，
 * 本插件可能在 settings 服务提供前启动，inject 会在服务可用后补跑注册，
 * 服务消失时卸载、再次可用时重新注册。
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (sctx) => {
    sctx.settings.register(themeSettingsNs, ThemeSettingsSchema)
  })
}
