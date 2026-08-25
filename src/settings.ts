import z from '@deepseek-ai/schemastery'
import type { CustomTheme, ThemeDiffs } from './client/theme/spec.js'

/** Settings namespace owned by this plugin (persisted in the host user-settings doc). */
export const THEME_SETTINGS_NAMESPACE = 'dsh-customization-settings'

/** Durable appearance settings shared by the host schema and the browser scope. */
export interface ThemeSettings {
  /** Currently active preset theme id; `null` means no preset applied (system default). */
  activeThemeId: string | null
  /** Currently active custom theme id; `null` means no custom scheme applied. */
  activeCustomThemeId: string | null
  /** Saved custom themes (each validated against the schema below). */
  customThemes: CustomTheme[]
}

/** 壁纸差异 schema：字段均未 required，缺省即「该维度未修改」。 */
const WallpaperDiffSchema = z.object({
  image: z.union([z.string(), z.const(null)]),
  placement: z.union([z.const('fullscreen'), z.const('conversation')]),
  maskColor: z.string(),
  maskOpacity: z.number(),
})

/**
 * 差异模型 schema。显式标注 `z<ThemeDiffs>`：使输出类型中 wallpaper/tokenDiffs
 * 保持可选，从而 `diffs` 的默认 `{}`（两个子面都未修改，继承基底）可以赋值；
 * 运行期缺省子面仍是空对象（所有字段 undefined），不破坏继承语义。
 */
const ThemeDiffsSchema: z<ThemeDiffs> = z.object({
  wallpaper: WallpaperDiffSchema,
  tokenDiffs: z.dict(z.object({ light: z.string(), dark: z.string() })),
})

const CustomThemeSchema = z.object({
  id: z.string().required(),
  name: z.string().required(),
  basePresetId: z.union([z.string(), z.const(null)]).default(null),
  diffs: ThemeDiffsSchema.default({}),
})

/** Durable settings schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  activeThemeId: z.union([z.string(), z.const(null)]).default(null),
  activeCustomThemeId: z.union([z.string(), z.const(null)]).default(null),
  customThemes: z.array(CustomThemeSchema).default([]),
})
