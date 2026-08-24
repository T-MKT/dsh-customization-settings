/**
 * 预置主题库（M1 提交点 2 · Agent C）。
 *
 * 6 套手调预置主题：默认 / 暮蓝 / 森林 / 暖橙 / 石墨 / 紫罗兰。
 * - 每套含完整 13 token 的 light/dark 双色板（`colorScheme: 'dual'`）。
 * - 壁纸仅以 `preset:<key>` 字符串键引用（与 wallpaper.ts 的 PRESET_WALLPAPERS
 *   对应），不导入壁纸渲染层。
 * - 模块加载时对全部 PRESETS 执行 validateTheme，任一不合法立即抛错。
 */

import { validateTheme } from './spec.js'
import type { Theme, TokenSet, Wallpaper } from './spec.js'
import type { TOKEN_KEYS } from './tokens.js'

/** 单个 token 的明暗双值。 */
type TokenValue = { light: string; dark: string }

/** 13 个 token 的全量键值（键由 tokens.js 的 TOKEN_KEYS 联合类型约束，缺键即编译错误）。 */
type TokenMap = Record<TOKEN_KEYS, TokenValue>

/** 一套完整色板（语义名 → 色值），构建后经 toTokenSet 映射为 token 键。 */
interface Palette {
  brand: string
  bgBase: string
  bgLayer1: string
  bgLayer2: string
  bgOverlay: string
  labelPrimary: string
  labelSecondary: string
  borderL1: string
  borderL2: string
  stateError: string
  stateSuccess: string
  stateWarn: string
  sidebarFill: string
}

/** 主题声明的核心色板：遮罩底色、边框与状态色由 buildPalette 按明暗补齐。 */
type PaletteCore = Omit<
  Palette,
  'bgOverlay' | 'borderL1' | 'borderL2' | 'stateError' | 'stateSuccess' | 'stateWarn'
>

/** 所有预置主题共享的明/暗状态色（error / success / warn）。 */
const LIGHT_STATE_COLORS = {
  stateError: '#d93025',
  stateSuccess: '#188038',
  stateWarn: '#b26a00',
} as const

const DARK_STATE_COLORS = {
  stateError: '#f28b82',
  stateSuccess: '#81c995',
  stateWarn: '#fdd663',
} as const

/** 遮罩/浮层底色：light 用深色 scrim，dark 用近黑。 */
const LIGHT_OVERLAY = '#1f2430'
const DARK_OVERLAY = '#0b0d11'

/**
 * 将 #rrggbb 按比例向白（amount > 0）或黑（amount < 0）混合，返回 #rrggbb。
 * 保持色相不变，用于从表面色派生边框色。
 */
function shiftHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const target = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount)
  const mix = (c: number): string =>
    Math.round(c + (target - c) * ratio).toString(16).padStart(2, '0')
  return `#${mix(r)}${mix(g)}${mix(b)}`
}

/** 由核心色板补齐遮罩底色、边框（light 压暗 / dark 提亮）与状态色，得到完整 Palette。 */
function buildPalette(mode: 'light' | 'dark', core: PaletteCore): Palette {
  const states = mode === 'light' ? LIGHT_STATE_COLORS : DARK_STATE_COLORS
  const shift = mode === 'light' ? -0.12 : 0.12
  const shift2 = mode === 'light' ? -0.1 : 0.1
  return {
    ...states,
    ...core,
    bgOverlay: mode === 'light' ? LIGHT_OVERLAY : DARK_OVERLAY,
    borderL1: shiftHex(core.bgLayer1, shift),
    borderL2: shiftHex(core.bgLayer2, shift2),
  }
}

/** 将明暗两套完整 Palette 映射为 13 个 token 的双值 TokenSet。 */
function toTokenSet(light: Palette, dark: Palette): TokenSet {
  const tokens: TokenMap = {
    'dsw-alias-brand-primary': { light: light.brand, dark: dark.brand },
    'dsw-alias-bg-base': { light: light.bgBase, dark: dark.bgBase },
    'dsw-alias-bg-layer-1': { light: light.bgLayer1, dark: dark.bgLayer1 },
    'dsw-alias-bg-layer-2': { light: light.bgLayer2, dark: dark.bgLayer2 },
    'dsw-alias-bg-overlay': { light: light.bgOverlay, dark: dark.bgOverlay },
    'dsw-alias-label-primary': { light: light.labelPrimary, dark: dark.labelPrimary },
    'dsw-alias-label-secondary': { light: light.labelSecondary, dark: dark.labelSecondary },
    'dsw-alias-border-l1': { light: light.borderL1, dark: dark.borderL1 },
    'dsw-alias-border-l2': { light: light.borderL2, dark: dark.borderL2 },
    'dsw-alias-state-error-primary': { light: light.stateError, dark: dark.stateError },
    'dsw-alias-state-success-primary': { light: light.stateSuccess, dark: dark.stateSuccess },
    'dsw-alias-state-warn-primary': { light: light.stateWarn, dark: dark.stateWarn },
    'dsw-specific-sidebar-fill': { light: light.sidebarFill, dark: dark.sidebarFill },
  }
  return { colorScheme: 'dual', tokens }
}

/** 无壁纸主题的统一 wallpaper。 */
const NO_WALLPAPER: Wallpaper = {
  image: null,
  placement: 'fullscreen',
  maskColor: '#000000',
  maskOpacity: 0,
}

/** 构造一张全屏壁纸（按 preset 键引用，不导入壁纸资源）。 */
function fullscreenWallpaper(image: string, maskColor: string, maskOpacity: number): Wallpaper {
  return { image, placement: 'fullscreen', maskColor, maskOpacity }
}

/** 组装一个预置 Theme：核心色板 → 完整 Palette → 13 token 双值。 */
function makeTheme(
  id: string,
  name: string,
  wallpaper: Wallpaper,
  light: PaletteCore,
  dark: PaletteCore,
): Theme {
  return {
    schemaVersion: 1,
    id,
    name,
    kind: 'preset',
    wallpaper,
    tokenSet: toTokenSet(buildPalette('light', light), buildPalette('dark', dark)),
  }
}

/**
 * 6 套预置主题。
 * - 壁纸主题的 `image` 为 `preset:<key>` 字符串键，键与 wallpaper.ts 的
 *   PRESET_WALLPAPERS 一一对应。
 * - 全部为 dual：light / dark 两套独立色板。
 */
export const PRESETS: Theme[] = [
  // 1. 默认：中性灰 + 蓝色品牌，无壁纸
  makeTheme(
    'preset.default',
    '默认',
    NO_WALLPAPER,
    {
      brand: '#2563eb',
      bgBase: '#f7f8fa',
      bgLayer1: '#ffffff',
      bgLayer2: '#eef0f3',
      labelPrimary: '#1b1e24',
      labelSecondary: '#5a6472',
      sidebarFill: '#eceef2',
    },
    {
      brand: '#8ab4f8',
      bgBase: '#16181d',
      bgLayer1: '#1e2127',
      bgLayer2: '#262a31',
      labelPrimary: '#f2f4f8',
      labelSecondary: '#9aa3af',
      sidebarFill: '#1a1d23',
    },
  ),
  // 2. 暮蓝：冷蓝、偏暗，壁纸 gradient-dusk
  makeTheme(
    'preset.dusk',
    '暮蓝',
    fullscreenWallpaper('preset:gradient-dusk', '#0b1220', 0.55),
    {
      brand: '#3b6fe0',
      bgBase: '#eef4fc',
      bgLayer1: '#f6f9fe',
      bgLayer2: '#e3ebf7',
      labelPrimary: '#14233a',
      labelSecondary: '#4d6282',
      sidebarFill: '#e7eefb',
    },
    {
      brand: '#6fa8ff',
      bgBase: '#0b1220',
      bgLayer1: '#131c2e',
      bgLayer2: '#1a253a',
      labelPrimary: '#e8f0ff',
      labelSecondary: '#8fa3c4',
      sidebarFill: '#0e1726',
    },
  ),
  // 3. 森林：绿色系，壁纸 gradient-aurora
  makeTheme(
    'preset.forest',
    '森林',
    fullscreenWallpaper('preset:gradient-aurora', '#12240f', 0.5),
    {
      brand: '#388e3c',
      bgBase: '#f2f8f2',
      bgLayer1: '#f7fbf7',
      bgLayer2: '#e4efe5',
      labelPrimary: '#182216',
      labelSecondary: '#51614a',
      sidebarFill: '#e8f2e6',
    },
    {
      brand: '#81c784',
      bgBase: '#12240f',
      bgLayer1: '#1a2f17',
      bgLayer2: '#213a1d',
      labelPrimary: '#eaf5e6',
      labelSecondary: '#93a98c',
      sidebarFill: '#152a11',
    },
  ),
  // 4. 暖橙：暖橙/棕，无壁纸
  makeTheme(
    'preset.warm',
    '暖橙',
    NO_WALLPAPER,
    {
      brand: '#d9480f',
      bgBase: '#fbf7f2',
      bgLayer1: '#fffaf5',
      bgLayer2: '#f3e9df',
      labelPrimary: '#2b2118',
      labelSecondary: '#6d5d4d',
      sidebarFill: '#f6ece1',
    },
    {
      brand: '#ff922b',
      bgBase: '#211812',
      bgLayer1: '#2b2018',
      bgLayer2: '#35281e',
      labelPrimary: '#fdf1e6',
      labelSecondary: '#b09883',
      sidebarFill: '#251b13',
    },
  ),
  // 5. 石墨：冷灰近单色，无壁纸
  makeTheme(
    'preset.graphite',
    '石墨',
    NO_WALLPAPER,
    {
      brand: '#5c6675',
      bgBase: '#f4f5f7',
      bgLayer1: '#ffffff',
      bgLayer2: '#e9ebee',
      labelPrimary: '#17191d',
      labelSecondary: '#5f6570',
      sidebarFill: '#eceef1',
    },
    {
      brand: '#c0c8d4',
      bgBase: '#141619',
      bgLayer1: '#1b1e22',
      bgLayer2: '#23262b',
      labelPrimary: '#eef0f3',
      labelSecondary: '#979ca5',
      sidebarFill: '#181b1f',
    },
  ),
  // 6. 紫罗兰：紫色系，壁纸 texture-clouds
  makeTheme(
    'preset.violet',
    '紫罗兰',
    fullscreenWallpaper('preset:texture-clouds', '#0e1630', 0.45),
    {
      brand: '#7048e8',
      bgBase: '#f6f3fb',
      bgLayer1: '#faf8fd',
      bgLayer2: '#ebe5f5',
      labelPrimary: '#1e1633',
      labelSecondary: '#5f5280',
      sidebarFill: '#ece6f8',
    },
    {
      brand: '#a78bfa',
      bgBase: '#0e1630',
      bgLayer1: '#161f40',
      bgLayer2: '#1e294e',
      labelPrimary: '#e9e6fa',
      labelSecondary: '#8f86b8',
      sidebarFill: '#121a38',
    },
  ),
]

// 模块加载即校验：任一预置不合法立即抛错（错误信息带主题 id）。
for (const p of PRESETS) {
  const err = validateTheme(p)
  if (err) throw new Error(`preset ${p.id} invalid: ${err}`)
}

/** 按 id 查找预置主题。 */
export function findPreset(id: string): Theme | undefined {
  return PRESETS.find((p) => p.id === id)
}

/** 默认预置主题 id（恢复默认 / 初始激活用）。 */
export const DEFAULT_PRESET_ID: string | null = 'preset.default'
