/**
 * 预置主题卡片网格（架构文档 §5.6）。
 *
 * 纯展示 + 回调组件：只接收 props，不接触任何 store / ctx / 主题服务。
 * - 置顶「内置主题」项：文案随深浅色偏好（浅色/深色/跟随系统），
 *   `activeId === null` 时高亮（无描边），点击 → onSelect(null)；
 * - 每套预置一张卡片：壁纸缩略图（`--cst-wallpaper-*` 内联变量，每卡自设）
 *   + light/dark 双行色板预览 + 主题名，点击 → onSelect(theme.id)；
 * - 卡片右上角「自定义」按钮（与主区为兄弟节点，按钮内不嵌套按钮）：
 *   点击 → onCustomize(theme)，以该预置为基底进入编辑器；
 * - 激活卡片描边用 `--dsw-alias-label-primary`（见 PresetGrid.module.css）。
 */

import type { CSSProperties } from 'react'
import type { Theme } from '../theme/spec.js'
import { resolveWallpaperSource } from '../theme/wallpaper.js'
import styles from './PresetGrid.module.css'

export interface PresetGridProps {
  presets: readonly Theme[]
  /** 当前激活的预置主题 id；null = 跟随系统。 */
  activeId: string | null
  /** 当前深浅色偏好（light/dark/system），用于「内置主题」按钮文案。 */
  mode: 'light' | 'dark' | 'system'
  /** 点击卡片/跟随系统项时回调；传 null 表示跟随系统。 */
  onSelect: (id: string | null) => void
  /** 点击卡片「自定义」按钮：以该预置为基底进入编辑器。 */
  onCustomize: (preset: Theme) => void
}

/** 极简类名拼接助手（本仓库无 clsx 依赖）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 深浅色偏好 → 「内置主题」按钮文案（与「通用设置」Appearance 行一致）。 */
const MODE_LABELS = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
} as const

/** 色板预览展示的三个 token key（取自主题数据，非硬编码色值）。 */
const SWATCH_TOKEN_KEYS = [
  'dsw-alias-brand-primary',
  'dsw-alias-bg-base',
  'dsw-alias-bg-layer-1',
] as const

export function PresetGrid({
  presets,
  activeId,
  mode,
  onSelect,
  onCustomize,
}: PresetGridProps): JSX.Element {
  return (
    <div className={styles.grid}>
      <button
        type="button"
        className={cx(styles.systemCard, activeId === null && styles.cardActive)}
        aria-pressed={activeId === null}
        onClick={() => onSelect(null)}
      >
        <svg
          className={styles.systemIcon}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* 半明半暗圆：左半浅（低不透明度），右半深（当前色） */}
          <path d="M8 1a7 7 0 1 0 0 14z" fillOpacity="0.35" />
          <path d="M8 1a7 7 0 0 1 0 14z" />
        </svg>
        <span>内置主题 - {MODE_LABELS[mode]}</span>
      </button>

      {presets.map((theme) => {
        const active = theme.id === activeId
        const wallpaper = theme.wallpaper
        // 每张卡片始终自设 4 个壁纸变量（无壁纸时 image 显式给 'none'），
        // 不依赖全局变量，避免卡片之间相互串色。
        const thumbVars = {
          '--cst-wallpaper-image': wallpaper.image
            ? resolveWallpaperSource(wallpaper.image) ?? 'none'
            : 'none',
          '--cst-wallpaper-placement': wallpaper.placement,
          '--cst-wallpaper-mask-color': wallpaper.maskColor,
          '--cst-wallpaper-mask-opacity': String(wallpaper.maskOpacity),
        } as CSSProperties

        return (
          <div
            key={theme.id}
            className={cx(styles.card, active && styles.cardActive)}
          >
            <button
              type="button"
              className={styles.cardMain}
              aria-pressed={active}
              onClick={() => onSelect(theme.id)}
            >
              <div className={styles.thumbnail} style={thumbVars} />
              <div className={styles.palette}>
                <div className={styles.paletteRow}>
                  {SWATCH_TOKEN_KEYS.map((key) => (
                    <span
                      key={key}
                      className={styles.swatch}
                      style={{ background: theme.tokenSet.tokens[key]?.light }}
                    />
                  ))}
                </div>
                <div className={styles.paletteRow}>
                  {SWATCH_TOKEN_KEYS.map((key) => (
                    <span
                      key={key}
                      className={styles.swatch}
                      style={{ background: theme.tokenSet.tokens[key]?.dark }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.cardName}>{theme.name}</div>
            </button>
            <button
              type="button"
              className={styles.customizeBtn}
              onClick={() => onCustomize(theme)}
            >
              自定义
            </button>
          </div>
        )
      })}
    </div>
  )
}
