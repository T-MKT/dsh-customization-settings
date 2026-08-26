/**
 * 壁纸渲染层（架构文档 §5.2 / §5.3）。
 *
 * 纯逻辑 + DOM 写入，不依赖 React：
 * - 把当前生效壁纸写入根元素 `--cst-wallpaper-*` CSS 变量（供预览缩略图等消费；
 *   主遮罩颜色固定为 bg-base，不再单独成变量）+ 侧边栏遮罩 `--cst-sidebar-mask-*`；
 * - 挂载真正的壁纸层到应用框架/对话区列（见 applyWallpaper，修复「壁纸不显示」）；
 * - 返回 disposer，调用后变量复原、壁纸层移除、容器内联样式复原。
 * - 图片来源三通道：内置预置（`preset:<key>` → data URI）、宿主上传资产
 *   （`asset:<id>` → 相对 URL，见 assets.ts；settings 只存引用）、任意 URL；
 *   `resolveWallpaperSource` 统一返回 `url("...")` 包裹的 background-image 值。
 */

import type { Wallpaper } from './spec.js'
import { assetUrl } from './assets.js'

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

/** 壁纸 CSS 变量及其基础默认值（架构 §5.3；主遮罩颜色不再单独成变量，固定为 bg-base）。 */
const WALLPAPER_DEFAULTS = {
  '--cst-wallpaper-image': 'none',
  '--cst-wallpaper-placement': 'none',
  '--cst-wallpaper-mask-opacity': '0',
} as const

/** 侧边栏遮罩 CSS 变量（自定义颜色 + 透明度；未设置时 CSS 规则回退 sidebar-fill @ 0.6）。 */
const SIDEBAR_MASK_COLOR_VAR = '--cst-sidebar-mask-color'
const SIDEBAR_MASK_OPACITY_VAR = '--cst-sidebar-mask-opacity'

/**
 * 解析壁纸图片源为可直接作为 `background-image` 值的字符串（一律 `url("...")` 包裹）：
 * - `preset:<key>` → `url("<内置 data URI>")`；未知键 → `null`；
 * - `asset:<id>` → `url("<宿主资产相对 URL>")`；id 为空 → `null`；
 * - 其他非空字符串（http URL 等）→ `url("<原值>")`；
 * - 空字符串 / 非字符串 → `null`。
 */
export function resolveWallpaperSource(image: string): string | null {
  if (typeof image !== 'string' || image === '') return null
  if (image.startsWith('preset:')) {
    const key = image.slice('preset:'.length) as PresetWallpaperKey
    const uri = PRESET_WALLPAPERS[key]?.image
    return uri ? `url("${uri}")` : null
  }
  if (image.startsWith('asset:')) {
    const id = image.slice('asset:'.length)
    if (id === '') return null
    return `url("${assetUrl(id)}")`
  }
  return `url("${image}")`
}

/**
 * 壁纸渲染层（架构 §5.3「背景容器样式」）——修复「壁纸不显示」：
 *
 * 仅把 `--cst-wallpaper-*` 变量写到根元素不会被任何元素消费，壁纸实际不可见。
 * 本层把生效壁纸真正挂到应用容器上：
 * - `fullscreen` → 挂到应用框架（AppFrame 的 frame 网格容器），垫在列内容之下；
 * - `conversation` → 挂到对话区列（AppFrame 的 centerCol），仅对话区可见；
 * - 目标容器先 `isolation: isolate` 成为叠加上下文，壁纸层以 `z-index: -1`
 *   垫在容器背景之上、内容之下；主遮罩以子层（颜色 = bg-base 自适应 + maskOpacity）叠加，
 *   侧边栏遮罩为侧边栏列上的自定义颜色覆盖层（见 WALLPAPER_RULES）；
 * - 对话区/详情区根容器与侧边栏列自带不透明背景（bg-base / sidebar-fill），
 *   壁纸激活时经 `data-cst-wallpaper` 属性 + 全局样式把它们透明化（见 WALLPAPER_RULES）；
 * - 框架渲染晚于插件 apply 时，用 MutationObserver 监听 `#root` 待框架出现后补挂。
 */

/** 壁纸层元素标记（幂等去重：挂载前先清理同页残留旧层）。 */
const LAYER_ATTR = 'data-cst-wallpaper-layer'
/** 遮罩子层标记。 */
const MASK_ATTR = 'data-cst-wallpaper-mask'
/** html 上的壁纸激活标记：有壁纸时置位，驱动全局样式把全区域表面透明化（让壁纸透出）。 */
const ACTIVE_ATTR = 'data-cst-wallpaper'
/** 全局样式标签标记。 */
const STYLE_ATTR = 'data-cst-wallpaper-rules'

/**
 * 表面背景统一由插件自有变量 `--cst-surface-bg` 控制（用户诉求：不再借用 shell token 语义）：
 * - 对话区根（`.wSkVaW_root`）、详情区根（`ydkMvW_root`）→ 回退 `--dsw-alias-bg-base`；
 * - 侧边栏列（`.pI_x6G_sidebarCol`）与侧边栏根（`.hHd-Xa_root`，二者都带
 *   `--dsw-specific-sidebar-fill` 全区域背景，后者是之前「侧边栏不透」的漏网之鱼）→ 回退 sidebar-fill；
 * - 变量未设置时回退值等于主题色，视觉零变化；壁纸激活时
 *   `html[data-cst-wallpaper]` 把 `--cst-surface-bg` 置为 `transparent`，壁纸透出。
 *
 * 定位用 slots 运行时的 `data-slot` 包裹结构，不依赖哈希类名；
 * `--dsw-alias-bg-base` token 本身不动（它还被输入框/按钮等小元素使用，不能全局覆盖）。
 * `:has()` 需要现代 Chromium（DSH web 目标环境满足）。
 */
const WALLPAPER_RULES = [
  '[data-slot="conversation"] > *,',
  '[data-slot="details"] > * {',
  '  background: var(--cst-surface-bg, var(--dsw-alias-bg-base)) !important;',
  '}',
  'div:has(> [data-slot="sidebar"]),',
  '[data-slot="sidebar"] > * {',
  '  background: var(--cst-surface-bg, var(--dsw-specific-sidebar-fill)) !important;',
  '}',
  // 壁纸激活：表面背景透明；去掉输入框底部的 bg-base 渐变带（composerSeat 是
  // conversation.session 槽包裹的相邻兄弟，见 wSkVaW_scrollBody 的子元素结构）。
  `html[${ACTIVE_ATTR}] {`,
  '  --cst-surface-bg: transparent;',
  '}',
  `html[${ACTIVE_ATTR}] [data-slot="conversation.session"] + * {`,
  '  background: transparent !important;',
  '}',
  // 侧边栏遮罩：壁纸激活时侧边栏列背景 = 自定义颜色按透明度与 transparent 混合
  // （color-mix 不需要 stacking context，避免 sidebarCol 上的 isolation 把设置弹窗等
  // 固定层困在 sidebarCol 的叠加上下文里——弹窗就渲染在 sidebar 槽内，z-index 会被困住）。
  // 颜色/透明度由 --cst-sidebar-mask-* 控制；未设置回退 sidebar-fill @ 0.6。
  `html[${ACTIVE_ATTR}] div:has(> [data-slot="sidebar"]) {`,
  '  background: color-mix(in srgb, var(--cst-sidebar-mask-color, var(--dsw-specific-sidebar-fill)) calc(var(--cst-sidebar-mask-opacity, 0.6) * 100%), transparent) !important;',
  '}',
].join('\n')

/** 确保全局样式注入（幂等；html 未置 ACTIVE_ATTR 时规则不生效）。 */
function ensureWallpaperStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return
  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTR, '')
  style.textContent = WALLPAPER_RULES
  document.head.appendChild(style)
}

/**
 * ACTIVE_ATTR 激活引用计数：同一时刻可能有多个 applyWallpaper 会话（防御并发），
 * 任一 dispose 都不能在仍有会话激活时移除标记；计数归零才移除。
 */
let activeCount = 0

/** 置位激活标记（首个会话激活时）。 */
function markActive(): void {
  if (typeof document === 'undefined') return
  if (activeCount === 0) document.documentElement.setAttribute(ACTIVE_ATTR, 'active')
  activeCount++
}

/** 撤销一次激活标记（最后一个会话结束时移除）。 */
function unmarkActive(): void {
  if (typeof document === 'undefined') return
  activeCount = Math.max(0, activeCount - 1)
  if (activeCount === 0) document.documentElement.removeAttribute(ACTIVE_ATTR)
}

/**
 * 应用框架容器（AppFrame 的 frame div）：`#root` 下带内联 grid-template-columns 的网格容器。
 *
 * 匹配信号：内联 `grid-template-columns` 含 `1fr`（中列轨道；CSSOM 会把 React 写入的
 * `minmax(0, 1fr)` 序列化为 `minmax(0px, 1fr)`，故只匹配 `1fr` 子串）+ 计算样式为
 * grid 且 position: relative（frame 的布局契约），排除页面内其他内联网格。
 */
function findFrame(): HTMLElement | null {
  const root = document.getElementById('root')
  if (!root) return null
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('div'))) {
    const inline = el.style.gridTemplateColumns
    if (!inline || !inline.includes('1fr')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'grid' && cs.position === 'relative') return el
  }
  return null
}

/** 对话区列（AppFrame 的 centerCol）：frame 直接子元素中 computed 为 flex 纵向布局者。 */
function findCenterColumn(frame: HTMLElement): HTMLElement | null {
  for (const el of Array.from(frame.children)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'flex' && cs.flexDirection === 'column') return el as HTMLElement
  }
  return null
}

/**
 * 让目标容器成为叠加上下文并可作为绝对定位参考（isolation: isolate + position: relative），
 * 使壁纸层能以 `z-index: -1` 垫在容器背景之上、内容之下；返回复原函数（disposer 恢复内联样式）。
 */
function prepareTarget(target: HTMLElement): () => void {
  const prevIsolation = target.style.isolation
  const prevPosition = target.style.position
  target.style.isolation = 'isolate'
  target.style.position = 'relative'
  return () => {
    target.style.isolation = prevIsolation
    target.style.position = prevPosition
  }
}

/** 构建壁纸层（图片背景 + 遮罩子层，遮罩颜色固定为 bg-base 随明暗自适应）并挂到目标容器最底层。 */
function buildLayer(wallpaper: Wallpaper, source: string, target: HTMLElement): HTMLDivElement {
  const layer = document.createElement('div')
  layer.setAttribute(LAYER_ATTR, '')
  layer.style.position = 'absolute'
  layer.style.inset = '0'
  layer.style.zIndex = '-1'
  layer.style.pointerEvents = 'none'
  layer.style.backgroundImage = source
  layer.style.backgroundSize = 'cover'
  layer.style.backgroundPosition = 'center'

  const mask = document.createElement('div')
  mask.setAttribute(MASK_ATTR, '')
  mask.style.position = 'absolute'
  mask.style.inset = '0'
  mask.style.background = 'var(--dsw-alias-bg-base)'
  mask.style.opacity = String(wallpaper.maskOpacity)

  layer.appendChild(mask)
  target.insertBefore(layer, target.firstChild)
  return layer
}

/**
 * 把壁纸写入根元素 CSS 变量并挂载真正的壁纸层，返回 disposer。
 *
 * - `wallpaper` 为 `null` 或其 `image` 为 `null`：视为「无壁纸」，写入全部默认值、不挂层；
 * - 图片源解析失败（未知 `preset:` 键等）时不挂层（避免出现无图遮罩）；
 * - 侧边栏遮罩（sidebarMask）写入 `--cst-sidebar-mask-*` 变量（未设置时清除，渲染回退默认）；
 * - `document` 不可用（如 SSR）时安全跳过，仍返回可安全调用的 disposer；
 * - disposer 复原壁纸变量、清除侧边栏遮罩变量、移除壁纸层、断开补挂监听并复原目标容器内联样式。
 */
export function applyWallpaper(wallpaper: Wallpaper | null): () => void {
  const root = typeof document !== 'undefined' ? document.documentElement : null

  const values: Record<keyof typeof WALLPAPER_DEFAULTS, string> =
    wallpaper && wallpaper.image !== null
      ? {
          '--cst-wallpaper-image': resolveWallpaperSource(wallpaper.image) ?? WALLPAPER_DEFAULTS['--cst-wallpaper-image'],
          '--cst-wallpaper-placement': wallpaper.placement,
          '--cst-wallpaper-mask-opacity': String(wallpaper.maskOpacity),
        }
      : { ...WALLPAPER_DEFAULTS }

  if (root) {
    for (const [name, value] of Object.entries(values)) {
      root.style.setProperty(name, value)
    }
    // 侧边栏遮罩变量：有设置则写入，无设置则清除（CSS 规则回退 sidebar-fill @ 0.6）
    const sidebarMask = wallpaper?.sidebarMask
    if (sidebarMask) {
      root.style.setProperty(SIDEBAR_MASK_COLOR_VAR, sidebarMask.color)
      root.style.setProperty(SIDEBAR_MASK_OPACITY_VAR, String(sidebarMask.opacity))
    } else {
      root.style.removeProperty(SIDEBAR_MASK_COLOR_VAR)
      root.style.removeProperty(SIDEBAR_MASK_OPACITY_VAR)
    }
  }

  // ---- 壁纸层：仅当有可用图片源时挂载 ----
  let layer: HTMLDivElement | null = null
  let observer: MutationObserver | null = null
  let restoreTarget: (() => void) | null = null
  /** 本次 apply 是否置位了 ACTIVE_ATTR（disposer 只撤销自己参与的激活）。 */
  let activated = false
  if (typeof document !== 'undefined' && wallpaper && wallpaper.image !== null) {
    const source = resolveWallpaperSource(wallpaper.image)
    if (source) {
      // 置位激活标记 + 注入全局样式：全区域表面（对话区/详情区根、侧边栏列）透明化，壁纸透出
      ensureWallpaperStyles()
      markActive()
      activated = true
      const mount = (): void => {
        if (layer) return
        // 幂等清理：同页可能存在上一次未 dispose 的旧层（防御性）
        for (const old of Array.from(document.querySelectorAll(`[${LAYER_ATTR}]`))) old.remove()
        const frame = findFrame()
        if (!frame) return
        const target = wallpaper.placement === 'conversation' ? findCenterColumn(frame) : frame
        if (!target) return
        restoreTarget = prepareTarget(target)
        layer = buildLayer(wallpaper, source, target)
        observer?.disconnect()
        observer = null
      }
      mount()
      if (!layer) {
        // 应用框架尚未渲染（插件 apply 早于 React 挂载）：监听 #root，框架出现后补挂
        observer = new MutationObserver(mount)
        const appRoot = document.getElementById('root')
        if (appRoot) observer.observe(appRoot, { childList: true, subtree: true })
      }
    }
  }

  return () => {
    if (root) {
      for (const [name, value] of Object.entries(WALLPAPER_DEFAULTS)) {
        root.style.setProperty(name, value)
      }
      root.style.removeProperty(SIDEBAR_MASK_COLOR_VAR)
      root.style.removeProperty(SIDEBAR_MASK_OPACITY_VAR)
      if (activated) {
        unmarkActive()
        activated = false
      }
    }
    layer?.remove()
    layer = null
    observer?.disconnect()
    observer = null
    restoreTarget?.()
    restoreTarget = null
  }
}
