/**
 * ThemeEditor 主题编辑器（架构 §7.3/§7.4 / plan-m2 §2.3 需求 2C）。
 *
 * 编辑会话（内存态）：name / diffs 只存在本地 state，点「保存」才合成 CustomTheme
 * 经 onSave 交给父组件落 store；取消/卸载直接丢弃，不写任何持久层。
 *
 * 组装：
 * - 顶栏：取消 + 方案名输入 + 保存；
 * - 预览区：壁纸预览框（内联 --cst-wallpaper-* 四变量，范式同 PresetGrid/WallpaperEditor
 *   缩略图）+ 色板条（品牌/基础背景/主要文字按当前 mode 取值）+ 明暗分段切换（本地
 *   mode，仅影响预览区渲染，不写全局）；
 * - 壁纸段：WallpaperEditor（value 为基底+差异合并后的完整 Wallpaper，onChange 折算为
 *   与基底的逐字段差异，差异为空则移除 wallpaper 键）；
 * - 主题色段：按 TOKEN_GROUPS 分组渲染 ColorField，未修改项显示基底值。
 *
 * 预览生命周期：diffs 或 onPreview 变化时整体替换预览（先 dispose 旧预览再建立新预览），
 * 卸载时结束预览、恢复用户层。
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CustomTheme, Theme, ThemeDiffs, Wallpaper, WallpaperDiff } from '../theme/spec.js'
import { mergeWallpaper, newCustomThemeId } from '../theme/spec.js'
import { THEME_TOKENS, TOKEN_GROUPS } from '../theme/tokens.js'
import type { TOKEN_KEYS } from '../theme/tokens.js'
import { resolveWallpaperSource } from '../theme/wallpaper.js'
import { uploadWallpaper } from '../theme/assets.js'
import { ColorField } from './ColorField.js'
import { WallpaperEditor } from './WallpaperEditor.js'
import styles from './ThemeEditor.module.css'

export interface ThemeEditorProps {
  /** 基底预置主题（从预置卡「自定义」进入；null = shell 默认，M2 恒传预置）。 */
  base: Theme | null
  /** 既有自定义方案（M2 恒为 null；M3 编辑既有方案用）。 */
  initial: CustomTheme | null
  /** 预览回调：把当前差异交给合成层实时预览；返回「结束预览」的 disposer。每次调用应整体替换旧预览。 */
  onPreview: (diffs: ThemeDiffs) => () => void
  /** 保存：合成 CustomTheme 后回调（由父组件落 store + 激活）。 */
  onSave: (theme: CustomTheme) => void
  /** 取消：丢弃未保存编辑。 */
  onCancel: () => void
}

/** 极简类名拼接助手（本仓库无 clsx 依赖）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 预览区色板条展示的三个 token key（品牌/基础背景/主要文字）。 */
const SWATCH_TOKEN_KEYS: readonly TOKEN_KEYS[] = [
  'dsw-alias-brand-primary',
  'dsw-alias-bg-base',
  'dsw-alias-label-primary',
]

/** 预览区明暗切换选项（本地 mode，不写全局）。 */
const MODE_OPTIONS: ReadonlyArray<{ value: 'light' | 'dark'; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

/** 无基底且无差异时的兜底壁纸（与 spec.mergeWallpaper 的默认值一致）。 */
const DEFAULT_WALLPAPER: Wallpaper = {
  image: null,
  placement: 'fullscreen',
  maskColor: '#000000',
  maskOpacity: 0,
}

export function ThemeEditor({
  base,
  initial,
  onPreview,
  onSave,
  onCancel,
}: ThemeEditorProps): JSX.Element {
  // ---- 编辑会话（内存态）：未保存不写 store ----
  const [name, setName] = useState<string>(
    () => initial?.name ?? (base ? `${base.name}·自定义` : '自定义主题'),
  )
  const [diffs, setDiffs] = useState<ThemeDiffs>(() => initial?.diffs ?? {})
  // 预览区明暗态：本地 mode，仅影响预览区渲染，不写全局。
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  // ---- 预览生命周期：mount 即预览初始差异、每次 diffs 变化整体替换、卸载时结束预览 ----
  const previewRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    previewRef.current?.()
    previewRef.current = onPreview(diffs)
    return () => {
      previewRef.current?.()
      previewRef.current = null
    }
  }, [diffs, onPreview])

  /** 某 token 的当前生效明暗值：差异优先，其次基底，兜底空值。 */
  function effectivePair(key: TOKEN_KEYS): { light: string; dark: string } {
    return diffs.tokenDiffs?.[key] ?? base?.tokenSet.tokens[key] ?? { light: '', dark: '' }
  }

  /** 主题色变更：写入 tokenDiffs（tokenDiffs 可能原本 undefined，先建对象）。 */
  function handleTokenChange(key: TOKEN_KEYS, light: string, dark: string): void {
    setDiffs((d) => ({ ...d, tokenDiffs: { ...d.tokenDiffs, [key]: { light, dark } } }))
  }

  /** 当前生效壁纸：基底 + 差异合并；两者皆无时用兜底默认值。 */
  const effectiveWallpaper: Wallpaper =
    mergeWallpaper(base?.wallpaper ?? null, diffs.wallpaper) ?? DEFAULT_WALLPAPER

  /** 壁纸变更：与基底逐字段比较折算差异；差异为空（改回基底）则移除 wallpaper 键。 */
  function handleWallpaperChange(next: Wallpaper): void {
    const baseWallpaper = base?.wallpaper
    const diff: WallpaperDiff = {}
    if (!baseWallpaper || next.image !== baseWallpaper.image) diff.image = next.image
    if (!baseWallpaper || next.placement !== baseWallpaper.placement) diff.placement = next.placement
    if (!baseWallpaper || next.maskColor !== baseWallpaper.maskColor) diff.maskColor = next.maskColor
    if (!baseWallpaper || next.maskOpacity !== baseWallpaper.maskOpacity) diff.maskOpacity = next.maskOpacity
    setDiffs((d) => {
      if (Object.keys(diff).length === 0) {
        const rest = { ...d }
        delete rest.wallpaper
        return rest
      }
      return { ...d, wallpaper: diff }
    })
  }

  /** 保存：合成 CustomTheme（新方案生成 custom.<uuid> id；编辑既有方案沿用其 id）。 */
  function handleSave(): void {
    onSave({
      id: initial?.id ?? newCustomThemeId(),
      name: name.trim() || '未命名主题',
      basePresetId: base?.id ?? null,
      diffs,
    })
  }

  // 壁纸预览框四变量（无壁纸时 image 显式给 'none'），范式同 PresetGrid/WallpaperEditor 缩略图。
  const previewVars = {
    '--cst-wallpaper-image': effectiveWallpaper.image
      ? resolveWallpaperSource(effectiveWallpaper.image) ?? 'none'
      : 'none',
    '--cst-wallpaper-placement': effectiveWallpaper.placement,
    '--cst-wallpaper-mask-color': effectiveWallpaper.maskColor,
    '--cst-wallpaper-mask-opacity': String(effectiveWallpaper.maskOpacity),
  } as CSSProperties

  return (
    <div className={styles.root}>
      {/* 顶栏：取消 / 方案名 / 保存 */}
      <header className={styles.topbar}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          取消
        </button>
        <input
          className={styles.nameInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="方案名"
          aria-label="方案名"
        />
        <button type="button" className={styles.saveButton} onClick={handleSave}>
          保存
        </button>
      </header>

      {/* 预览区：壁纸预览框 + 色板条 + 明暗分段切换（本地 mode） */}
      <section className={styles.preview}>
        <div className={styles.previewThumb} style={previewVars} />
        <div className={styles.previewFooter}>
          <div className={styles.swatchBar} role="group" aria-label="预览色板">
            {SWATCH_TOKEN_KEYS.map((key) => {
              const pair = effectivePair(key)
              return (
                <span
                  key={key}
                  className={styles.swatch}
                  style={{ background: pair[mode] || undefined }}
                />
              )
            })}
          </div>
          <div className={styles.segment} role="group" aria-label="预览明暗">
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cx(styles.segmentButton, active && styles.segmentActive)}
                  aria-pressed={active}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 编辑区：壁纸段 */}
      <section className={styles.sectionBlock}>
        <h3 className={styles.sectionTitle}>壁纸</h3>
        <WallpaperEditor
          value={effectiveWallpaper}
          onChange={handleWallpaperChange}
          onUpload={(file) => uploadWallpaper(file)}
        />
      </section>

      {/* 编辑区：主题色段（按 TOKEN_GROUPS 分组，未修改项显示基底值） */}
      <section className={styles.sectionBlock}>
        <h3 className={styles.sectionTitle}>主题色</h3>
        {TOKEN_GROUPS.map((group) => (
          <div key={group.id} className={styles.group}>
            <h4 className={styles.groupTitle}>{group.label}</h4>
            {THEME_TOKENS.filter((token) => token.group === group.id).map((token) => {
              const pair = effectivePair(token.key)
              return (
                <ColorField
                  key={token.key}
                  label={token.label}
                  light={pair.light}
                  dark={pair.dark}
                  onChange={(light, dark) => handleTokenChange(token.key, light, dark)}
                />
              )
            })}
          </div>
        ))}
      </section>
    </div>
  )
}
