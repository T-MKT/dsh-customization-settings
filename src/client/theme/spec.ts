/**
 * 主题（Theme）领域模型与校验（架构文档 §3.2）。
 *
 * `tokens` 以 `Record<string, { light; dark }>` 承载：校验必须接受任意
 * 未知输入，宽松的 key 类型便于在运行期检查后再按需收窄。
 */

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
