import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin (persisted in the host user-settings doc). */
export const THEME_SETTINGS_NAMESPACE = 'dsh-customization-settings'

/** Durable appearance settings shared by the host schema and the browser scope. */
export interface ThemeSettings {
  /** Currently active preset theme id; `null` means no preset applied (system default). */
  activeThemeId: string | null
}

/** Durable settings schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  activeThemeId: z.union([z.string(), z.const(null)]).default(null),
})
