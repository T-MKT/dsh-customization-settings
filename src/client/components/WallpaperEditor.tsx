/**
 * WallpaperEditor 壁纸编辑组件（架构 §7.3 / plan-m2 §2.2 需求 2B）。
 *
 * 纯展示 + 回调组件：只接收 props，不接触 store / ctx / 资产通道——
 * 上传逻辑由父组件经 `onUpload` 注入（内部调用 assets.uploadWallpaper），
 * 本组件不 import assets.ts。
 *
 * 三个分区：
 * - 图片预览：内联 `--cst-wallpaper-*` 四变量驱动缩略图（范式同 PresetGrid），
 *   无壁纸时显示纯色占位 + 提示文字；
 * - 图片来源：上传按钮 / URL 输入 / 内置资源下拉三通道并列展示，任一操作即生效，
 *   最后一次操作为准（URL 输入带本地 draft 态，失焦/回车才提交）；
 * - 位置 + 遮罩：全屏/对话区分段控件，遮罩颜色（非法回退 '#000000'）与透明度滑块。
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import type { Wallpaper } from '../theme/spec.js'
import {
  PRESET_WALLPAPER_KEYS,
  PRESET_WALLPAPERS,
  resolveWallpaperSource,
} from '../theme/wallpaper.js'
import styles from './WallpaperEditor.module.css'

export interface WallpaperEditorProps {
  /** 当前生效壁纸（基底合并差异后的完整 Wallpaper）。 */
  value: Wallpaper
  /** 任一维度变化时回调（父组件负责把「改过的维度」折算为差异）。 */
  onChange: (next: Wallpaper) => void
  /** 上传图片文件；返回新的 image 源（'asset:<id>'）。由父组件提供（内部调用 assets.uploadWallpaper）。 */
  onUpload: (file: File) => Promise<string>
}

/** 极简类名拼接助手（本仓库无 clsx 依赖）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 位置选项：全屏 / 仅对话区。 */
const PLACEMENT_OPTIONS: ReadonlyArray<{ value: Wallpaper['placement']; label: string }> = [
  { value: 'fullscreen', label: '全屏' },
  { value: 'conversation', label: '仅对话区' },
]

/** 合法 #rrggbb 校验（type=color 只接受该格式）。 */
function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** type=color 不接受非法值：maskColor 非法时回退纯黑。 */
const FALLBACK_COLOR = '#000000'

export function WallpaperEditor({ value, onChange, onUpload }: WallpaperEditorProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // URL 输入本地 draft 态：输入过程不写回 value，失焦/回车才提交。
  const [urlDraft, setUrlDraft] = useState('')

  // 上传是异步的：resolve 时用最新 value（ref 镜像），避免覆盖上传期间用户改动的其他维度。
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  // 当前 image 变化（选择了预置 / 上传成功 / 提交了 URL）时，URL 输入框与当前值对齐：
  // 仅当 image 是「裸 URL」时回填，preset:/asset: 引用则清空输入框。
  useEffect(() => {
    const image = value.image
    setUrlDraft(image && !image.startsWith('preset:') && !image.startsWith('asset:') ? image : '')
  }, [value.image])

  // 预览缩略图四变量（无壁纸时 image 显式给 'none'），范式同 PresetGrid。
  const thumbVars = {
    '--cst-wallpaper-image': value.image ? resolveWallpaperSource(value.image) ?? 'none' : 'none',
    '--cst-wallpaper-placement': value.placement,
    '--cst-wallpaper-mask-color': value.maskColor,
    '--cst-wallpaper-mask-opacity': String(value.maskOpacity),
  } as CSSProperties

  // 内置资源下拉的当前选中值：image 以 preset: 开头时选中对应项，否则为「无壁纸」。
  const presetValue =
    value.image !== null && value.image.startsWith('preset:') ? value.image : ''

  // 遮罩颜色非法时回退 '#000000'（type=color 硬约束）；透明度 0~1 → 0~100 百分比。
  const maskColor = isHexColor(value.maskColor) ? value.maskColor : FALLBACK_COLOR
  const maskPercent = Math.round(value.maskOpacity * 100)

  /** 提交 URL draft：trim 后非空 → 作为 image；空 → 无壁纸。 */
  function commitUrl(): void {
    const trimmed = urlDraft.trim()
    onChange(trimmed ? { ...value, image: trimmed } : { ...value, image: null })
  }

  /** 选择文件 → 上传中 → onUpload 成功回填 image；失败行内提示中文错误。 */
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = '' // 清空选择，允许再次选择同一文件
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const image = await onUpload(file)
      onChange({ ...valueRef.current, image })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '壁纸上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.root}>
      {/* 图片预览：内联四变量驱动；无壁纸时显示纯色占位 + 提示文字 */}
      <div className={styles.thumbnail} style={thumbVars}>
        {!value.image && <span className={styles.thumbnailHint}>无壁纸</span>}
      </div>

      {/* 图片来源：三通道并列展示，最后一次操作为准 */}
      <section className={styles.block}>
        <h3 className={styles.blockTitle}>图片来源</h3>
        <div className={styles.sourceRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={(event) => void handleFileChange(event)}
          />
          <button
            type="button"
            className={styles.uploadButton}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '上传中…' : '上传图片'}
          </button>
          <input
            type="text"
            className={styles.urlInput}
            placeholder="或输入图片 URL"
            aria-label="图片 URL"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onBlur={commitUrl}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitUrl()
            }}
          />
          <select
            className={styles.presetSelect}
            aria-label="内置壁纸"
            value={presetValue}
            onChange={(event) => {
              const next = event.target.value
              onChange(next ? { ...value, image: next } : { ...value, image: null })
            }}
          >
            <option value="">无壁纸</option>
            {PRESET_WALLPAPER_KEYS.map((key) => (
              <option key={key} value={`preset:${key}`}>
                {PRESET_WALLPAPERS[key].label}
              </option>
            ))}
          </select>
        </div>
        {uploadError !== null && <p className={styles.errorText}>{uploadError}</p>}
      </section>

      {/* 位置：全屏 / 仅对话区分段控件 */}
      <section className={styles.block}>
        <h3 className={styles.blockTitle}>位置</h3>
        <div className={styles.segment} role="group" aria-label="壁纸位置">
          {PLACEMENT_OPTIONS.map((option) => {
            const active = value.placement === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={cx(styles.segmentButton, active && styles.segmentActive)}
                aria-pressed={active}
                onClick={() => onChange({ ...value, placement: option.value })}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 遮罩：颜色 + 透明度滑块（右侧百分比文字） */}
      <section className={styles.block}>
        <h3 className={styles.blockTitle}>遮罩</h3>
        <div className={styles.maskRow}>
          <label className={styles.maskField}>
            <span className={styles.maskLabel}>颜色</span>
            <input
              type="color"
              className={styles.colorInput}
              value={maskColor}
              onChange={(event) => onChange({ ...value, maskColor: event.target.value })}
            />
          </label>
          <label className={styles.maskField}>
            <span className={styles.maskLabel}>透明度</span>
            <input
              type="range"
              className={styles.opacityInput}
              min={0}
              max={100}
              value={maskPercent}
              onChange={(event) =>
                onChange({ ...value, maskOpacity: Number(event.target.value) / 100 })
              }
            />
            <span className={styles.opacityValue}>{maskPercent}%</span>
          </label>
        </div>
      </section>
    </div>
  )
}
