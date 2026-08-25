import { useCallback, useSyncExternalStore, useState } from 'react'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ThemeService } from '../theme/service.js'
import type { ThemeStore } from '../theme/store.js'
import type { CustomTheme, Theme, ThemeDiffs } from '../theme/spec.js'
import { PresetGrid } from './PresetGrid.js'
import { ThemeEditor } from './ThemeEditor.js'
import styles from './ThemeSection.module.css'

export interface ThemeSectionProps extends SettingsSectionOwnerProps {
  /** 主题合成服务：applyTheme / resolveActive / subscribe 均由此提供。 */
  service: ThemeService
  /** 主题存储：订阅自定义方案列表（listCustomThemes 快照引用稳定）。 */
  store: ThemeStore
  /** 预置主题列表（含「跟随系统」项的处理由 PresetGrid 负责）。 */
  presets: readonly Theme[]
}

/**
 * 「外观」设置分区 → 「主题」分区正文（提交点 3，M2 入口接线）。
 *
 * 组件不直接接触 store/theme 服务：activeId/mode/active 通过 useSyncExternalStore
 * 订阅 service（getSnapshot 返回稳定引用），customThemes 订阅 store；
 * 选择交由 PresetGrid 回调 `service.applyTheme`。
 * 视图状态（预置 | 编辑器）为内存态：从预置卡「自定义」进入编辑器（以该预置为
 * 基底），保存/取消返回预置视图。
 */
export function ThemeSection({ service, store, presets }: ThemeSectionProps): JSX.Element {
  // ---- 视图状态（内存态）：预置主题 | 编辑器 ----
  const [view, setView] = useState<'presets' | 'editor'>('presets')
  /** 编辑器基底预置（从预置卡「自定义」进入时记录）。 */
  const [editorBase, setEditorBase] = useState<Theme | null>(null)

  // ---- 订阅（getSnapshot 必须返回稳定引用） ----
  const activeId = useSyncExternalStore(service.subscribe, service.getActiveId)
  const mode = useSyncExternalStore(service.subscribe, service.getPreference)
  const active = useSyncExternalStore(service.subscribe, service.resolveActive)
  const customThemes = useSyncExternalStore(store.subscribe, () => store.listCustomThemes())

  // 预置卡高亮：自定义方案激活时高亮其基底预置卡（找不到基底则不高亮任何预置）。
  const presetActiveId =
    active.kind === 'custom'
      ? (customThemes.find((t) => t.id === active.id)?.basePresetId ?? null)
      : activeId
  // 当前激活自定义方案名称（横幅提示；找不到时回退 id）。
  const activeCustomName =
    active.kind === 'custom' ? customThemes.find((t) => t.id === active.id)?.name ?? active.id : null

  /** 点击预置卡「自定义」：以该预置为基底进入编辑器。 */
  function handleCustomize(preset: Theme): void {
    setEditorBase(preset)
    setView('editor')
  }

  /** 选择预置/跟随系统：应用（service 内部落库 + 渲染），保持预置视图。 */
  function handleSelect(id: string | null): void {
    void service.applyTheme(id)
  }

  /** 编辑器内实时预览：差异 → service 预览层；返回结束预览的 disposer。 */
  const handlePreview = useCallback(
    (diffs: ThemeDiffs) => service.beginPreview(editorBase?.id ?? null, diffs),
    [service, editorBase],
  )

  /** 保存自定义方案：service 落库 + 激活，返回预置视图。 */
  function handleSave(theme: CustomTheme): void {
    void (async () => {
      await service.applyCustomTheme(theme)
      setView('presets')
    })()
  }

  /** 取消：丢弃未保存编辑，返回预置视图。 */
  function handleCancel(): void {
    setView('presets')
  }

  return (
    <div className={styles.section}>
      {view === 'editor' && editorBase ? (
        <ThemeEditor
          base={editorBase}
          initial={null}
          onPreview={handlePreview}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <>
          <header className={styles.header}>
            <h2 className={styles.title}>主题</h2>
            <p className={styles.description}>
              选择一套预置主题，主题色与壁纸将即时应用到整个界面。
            </p>
          </header>
          {active.kind === 'custom' && (
            <div className={styles.customBanner}>当前使用自定义方案「{activeCustomName}」</div>
          )}
          <PresetGrid
            presets={presets}
            activeId={presetActiveId}
            mode={mode}
            onSelect={handleSelect}
            onCustomize={handleCustomize}
          />
        </>
      )}
    </div>
  )
}
