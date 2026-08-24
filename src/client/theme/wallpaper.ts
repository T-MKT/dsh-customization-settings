/**
 * 壁纸渲染层（架构文档 §5.2 / §5.3）。
 *
 * 纯逻辑 + DOM CSS 变量写入，不依赖 React：
 * - 把当前生效壁纸写入根元素 4 个 `--cst-wallpaper-*` CSS 变量；
 * - 返回 disposer，调用后变量全部复原为基础默认值。
 * - M1 无独立资源管线，内置壁纸以自包含的 SVG data URI 形式提供。
 */

import type { Wallpaper } from './spec.js'

/** M1 内置壁纸资源表（键 → data URI / label）。 */
export interface PresetWallpaper {
  /** 自包含资源（SVG data URI）。 */
  image: string
  /** 中文展示名。 */
  label: string
}

/** 内置壁纸键（固定字面量联合，与 `PRESET_WALLPAPERS` 保持同步）。 */
export const PRESET_WALLPAPER_KEYS = [
  'gradient-aurora',
  'texture-clouds',
  'gradient-dusk',
] as const

export type PresetWallpaperKey = (typeof PRESET_WALLPAPER_KEYS)[number]

/** 把 SVG 源编码为可直接作为背景图的 data URI（无网络请求）。 */
function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** M1 内置壁纸：2 张暗色系（深色遮罩下清晰）+ 1 张暖色浅色系（浅色遮罩下清晰）。 */
export const PRESET_WALLPAPERS: Record<PresetWallpaperKey, PresetWallpaper> = {
  /** 暗色冷调极光渐变，适配深色遮罩。 */
  'gradient-aurora': {
    label: '极光渐变',
    image: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0d1b2e'/><stop offset='0.55' stop-color='#16324a'/><stop offset='1' stop-color='#37275c'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><circle cx='620' cy='140' r='230' fill='#53d8b6' opacity='0.14'/><circle cx='200' cy='480' r='260' fill='#7a5cff' opacity='0.12'/></svg>`,
    ),
  },
  /** 暗色蓝灰云纹纹理，适配深色遮罩。 */
  'texture-clouds': {
    label: '云纹纹理',
    image: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#131b26'/><stop offset='1' stop-color='#1d2a3a'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><g fill='#eef4ff' opacity='0.07'><ellipse cx='170' cy='150' rx='230' ry='95'/><ellipse cx='640' cy='430' rx='270' ry='115'/><ellipse cx='420' cy='560' rx='200' ry='80'/></g></svg>`,
    ),
  },
  /** 暖色浅调暮色渐变，适配浅色遮罩。 */
  'gradient-dusk': {
    label: '暮色渐变',
    image: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff4e8'/><stop offset='0.55' stop-color='#ffdcc0'/><stop offset='1' stop-color='#f6b98c'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/></svg>`,
    ),
  },
}

/** 4 个壁纸 CSS 变量及其基础默认值（架构 §5.3）。 */
const WALLPAPER_DEFAULTS = {
  '--cst-wallpaper-image': 'none',
  '--cst-wallpaper-placement': 'none',
  '--cst-wallpaper-mask-color': '#000000',
  '--cst-wallpaper-mask-opacity': '0',
} as const

/**
 * 解析壁纸图片源：`preset:<key>` → 内置 data URI；未知键 → `null`；
 * 普通 URL 原样返回；非字符串 → `null`。
 */
export function resolveWallpaperSource(image: string): string | null {
  if (typeof image !== 'string') return null
  if (image.startsWith('preset:')) {
    const key = image.slice('preset:'.length) as PresetWallpaperKey
    return PRESET_WALLPAPERS[key]?.image ?? null
  }
  return image
}

/**
 * 把壁纸写入根元素 CSS 变量并返回 disposer。
 *
 * - `wallpaper` 为 `null` 或其 `image` 为 `null`：视为「无壁纸」，写入全部默认值；
 * - `document` 不可用（如 SSR）时安全跳过写入，仍返回可安全调用的 disposer；
 * - disposer 将 4 个变量全部复原为基础默认值。
 */
export function applyWallpaper(wallpaper: Wallpaper | null): () => void {
  const root = typeof document !== 'undefined' ? document.documentElement : null

  const values: Record<keyof typeof WALLPAPER_DEFAULTS, string> =
    wallpaper && wallpaper.image !== null
      ? {
          '--cst-wallpaper-image': resolveWallpaperSource(wallpaper.image) ?? WALLPAPER_DEFAULTS['--cst-wallpaper-image'],
          '--cst-wallpaper-placement': wallpaper.placement,
          '--cst-wallpaper-mask-color': wallpaper.maskColor,
          '--cst-wallpaper-mask-opacity': String(wallpaper.maskOpacity),
        }
      : { ...WALLPAPER_DEFAULTS }

  if (root) {
    for (const [name, value] of Object.entries(values)) {
      root.style.setProperty(name, value)
    }
  }

  return () => {
    if (root) {
      for (const [name, value] of Object.entries(WALLPAPER_DEFAULTS)) {
        root.style.setProperty(name, value)
      }
    }
  }
}
