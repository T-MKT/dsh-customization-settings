import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema } from './settings.js'

/** Branded settings namespace, derived from the shared constant. */
const themeSettingsNs = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/**
 * Host: register the appearance settings namespace when the settings service
 * is composed. Registration is an effect on this plugin's fiber and is cleaned
 * up when the fiber unloads. The returned scope is not used here; reads happen
 * on the client over the wire.
 */
export function apply(ctx: Context): void {
  const settings = ctx.get('settings')
  if (settings) settings.register(themeSettingsNs, ThemeSettingsSchema)
}
