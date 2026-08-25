/**
 * ColorField 单颜色项（light/dark 双通道颜色输入，架构 §7.4 / plan-m2 §2.1 需求 2A）。
 *
 * 通道语义：light / dark 分别对应 CustomTheme 差异模型 tokenDiffs[key].light /
 * tokenDiffs[key].dark —— 浅色通道编辑 light 值，深色通道编辑 dark 值，未修改项显示基底值。
 *
 * 输入双通道（架构 §7.4）：`<input type="color">` 色块选择 + 十六进制文本输入；
 * type=color 不支持 alpha，因此本组件只处理不透明 #rrggbb。
 * - 文本输入带本地 draft 态：输入即更新 draft；输入为合法 6 位 hex 时立即 onChange；
 *   失焦时 draft 复位为 props 值（非法输入不提交）；
 * - onChange 时统一转小写；props 值为 ''（无基底）或非法时，色块输入回退展示 '#000000'。
 */

import { useEffect, useState } from 'react'
import styles from './ColorField.module.css'

export interface ColorFieldProps {
  /** 颜色项展示名（如「品牌主色」）。 */
  label: string
  /** 当前生效的 light 值（基底或已修改），可能为 ''（无基底）。 */
  light: string
  /** 当前生效的 dark 值，可能为 ''。 */
  dark: string
  /** 通道值变化时回调（任意一通道变化都带两值）。 */
  onChange: (light: string, dark: string) => void
}

/** 合法 hex 判定：#rrggbb（6 位十六进制，大小写均可）。 */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** 归一化：合法 hex 统一转小写；非法输入原样返回（由调用方按需回退）。 */
export function normalizeHex(value: string): string {
  return isHexColor(value) ? value.toLowerCase() : value
}

/** type=color 不接受非法值：props 为 '' 或非法时回退展示纯黑。 */
const FALLBACK_COLOR = '#000000'

/** 通道草稿态：文本输入未提交（非法）时的本地值。 */
interface ChannelDrafts {
  light: string
  dark: string
}

/** 通道标识：light=浅色（tokenDiffs[key].light），dark=深色（tokenDiffs[key].dark）。 */
type ChannelKey = 'light' | 'dark'

export function ColorField({ label, light, dark, onChange }: ColorFieldProps): JSX.Element {
  const [drafts, setDrafts] = useState<ChannelDrafts>(() => ({ light, dark }))

  // props 值变化（onChange 生效 / 父组件重置）时同步 draft，保持文本框与生效值一致。
  useEffect(() => {
    setDrafts((prev) => {
      if (prev.light === light && prev.dark === dark) return prev
      return { light, dark }
    })
  }, [light, dark])

  /** 提交某通道值：归一化后经 onChange 带两通道当前值上抛。 */
  function commit(channel: ChannelKey, value: string): void {
    const next = normalizeHex(value)
    if (channel === 'light') onChange(next, dark)
    else onChange(light, next)
  }

  /** 渲染单个通道：小标签 + 色块输入 + 十六进制文本输入。 */
  function renderChannel(channel: ChannelKey): JSX.Element {
    const value = channel === 'light' ? light : dark
    const draft = channel === 'light' ? drafts.light : drafts.dark
    const channelLabel = channel === 'light' ? '浅色' : '深色'

    return (
      <div className={styles.channel}>
        <span className={styles.channelLabel}>{channelLabel}</span>
        <input
          type="color"
          className={styles.colorInput}
          value={isHexColor(value) ? value : FALLBACK_COLOR}
          onChange={(event) => commit(channel, event.target.value)}
          aria-label={`${label} ${channelLabel}`}
        />
        <input
          type="text"
          className={styles.textInput}
          value={draft}
          spellCheck={false}
          onChange={(event) => {
            const raw = event.target.value
            setDrafts((prev) => ({ ...prev, [channel]: raw }))
            // 合法 6 位 hex 立即提交；非法输入仅留在 draft，失焦时复位。
            if (isHexColor(raw)) commit(channel, raw)
          }}
          onBlur={() => {
            setDrafts((prev) => ({ ...prev, [channel]: value }))
          }}
          aria-label={`${label} ${channelLabel} 十六进制`}
        />
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.channels}>
        {renderChannel('light')}
        {renderChannel('dark')}
      </div>
    </div>
  )
}
