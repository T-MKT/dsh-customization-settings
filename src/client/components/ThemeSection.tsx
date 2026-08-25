import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ThemeService } from '../theme/service.js'
import type { ThemeStore } from '../theme/store.js'
import { findPreset } from '../theme/presets.js'
import type { CustomTheme, Theme, ThemeDiffs } from '../theme/spec.js'
import type { TOKEN_KEYS } from '../theme/tokens.js'
import { parseTheme } from '../theme/spec.js'
import { PresetGrid } from './PresetGrid.js'
import { SchemeList } from './SchemeList.js'
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

/** 主题分区视图：预置主题 | 我的主题 | 编辑器。 */
type ThemeView = 'presets' | 'schemes' | 'editor'

/** 极简类名拼接助手（本仓库无 clsx 依赖）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * 「外观」设置分区 → 「主题」分区正文（M3 提交点 2：三视图结构）。
 *
 * 组件不直接接触 store/theme 服务：activeId/mode/active 通过 useSyncExternalStore
 * 订阅 service（getSnapshot 返回稳定引用），customThemes 订阅 store；
 * 选择交由 PresetGrid 回调 `service.applyTheme`。
 * 视图状态（预置 | 我的主题 | 编辑器）为内存态：挂载时已有激活自定义方案 →
 * 默认落「我的主题」，否则「预置主题」；编辑器记录来源视图（editorOrigin），
 * 保存/取消后返回该视图。
 */
export function ThemeSection({ service, store, presets }: ThemeSectionProps): JSX.Element {
  // ---- 视图状态（内存态）：挂载时已有激活自定义方案 → 默认「我的主题」 ----
  const [view, setView] = useState<ThemeView>(() => (store.getActiveCustomThemeId() ? 'schemes' : 'presets'))
  /** 编辑器基底主题（预置或 null=默认基底；进入来源由 editorOrigin 记录）。 */
  const [editorBase, setEditorBase] = useState<Theme | null>(null)
  /** 编辑器初始方案（编辑既有方案时传入；新建为 null）。 */
  const [editorInitial, setEditorInitial] = useState<CustomTheme | null>(null)
  /** 进入编辑器的来源视图：保存/取消后返回该视图。 */
  const [editorOrigin, setEditorOrigin] = useState<'presets' | 'schemes'>('presets')
  /** 导入失败的提示信息；null = 无错误。 */
  const [importError, setImportError] = useState<string | null>(null)
  /** 隐藏的 JSON 文件选择输入（「导入」按钮触发）。 */
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** 「恢复默认」两步确认态：true 时按钮文案变「确认恢复默认？」。 */
  const [confirmResetAll, setConfirmResetAll] = useState(false)

  /** 确认态 3 秒后自动复位，避免确认态悬挂。 */
  useEffect(() => {
    if (!confirmResetAll) return
    const timer = setTimeout(() => setConfirmResetAll(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmResetAll])

  // ---- 订阅（getSnapshot 必须返回稳定引用） ----
  const activeId = useSyncExternalStore(service.subscribe, service.getActiveId)
  const mode = useSyncExternalStore(service.subscribe, service.getPreference)
  const active = useSyncExternalStore(service.subscribe, service.resolveActive)
  const customThemes = useSyncExternalStore(store.subscribe, () => store.listCustomThemes())

  // 挂载兜底：settings 快照可能晚于挂载到达（首次加载），此时初始视图可能误落「预置主题」；
  // 一旦检测到激活自定义方案存在即切到「我的主题」——仅首次生效（autoViewDone），
  // 之后用户手动切换视图不会被本效果覆盖。
  const autoViewDone = useRef(false)
  useEffect(() => {
    if (autoViewDone.current) return
    if (active.kind === 'custom') {
      autoViewDone.current = true
      setView('schemes')
    }
  }, [active])

  // 预置卡高亮：自定义方案激活时高亮其基底预置卡（找不到基底则不高亮任何预置）。
  const presetActiveId =
    active.kind === 'custom'
      ? (customThemes.find((t) => t.id === active.id)?.basePresetId ?? null)
      : activeId
  // 当前激活自定义方案名称（横幅提示；找不到时回退 id）。
  const activeCustomName =
    active.kind === 'custom' ? customThemes.find((t) => t.id === active.id)?.name ?? active.id : null

  /** 进入编辑器：记录基底/初始方案/来源视图后切换编辑器视图。 */
  function enterEditor(base: Theme | null, initial: CustomTheme | null, origin: 'presets' | 'schemes'): void {
    setEditorBase(base)
    setEditorInitial(initial)
    setEditorOrigin(origin)
    setView('editor')
  }

  /** 点击预置卡「自定义」：以该预置为基底进入编辑器（来源=预置视图）。 */
  function handleCustomize(preset: Theme): void {
    enterEditor(preset, null, 'presets')
  }

  /** 选择预置/跟随系统：应用（service 内部落库 + 渲染），保持预置视图。 */
  function handleSelect(id: string | null): void {
    void service.applyTheme(id)
  }

  // ---- 我的主题视图：列表操作处理器 ----

  /** 设为当前：仅切换 activeCustomThemeId（渲染由 store 订阅触发的 recompose 完成）。 */
  function handleActivate(id: string): void {
    void service.activateScheme(id)
  }

  /** 编辑方案：以 basePresetId 对应预置为基底进入编辑器（无基底/找不到 → base null）。 */
  function handleEdit(id: string): void {
    const scheme = customThemes.find((t) => t.id === id)
    if (!scheme) return
    enterEditor(scheme.basePresetId ? (findPreset(scheme.basePresetId) ?? null) : null, scheme, 'schemes')
  }

  /** 复制方案：store 生成新 id 副本（名称加「副本」），落库但不自动激活。 */
  function handleDuplicate(id: string): void {
    const copy = store.duplicateCustomTheme(id)
    void store.saveCustomTheme(copy)
  }

  /** 重命名方案。 */
  function handleRename(id: string, name: string): void {
    void store.renameCustomTheme(id, name)
  }

  /** 删除方案：service 内部处理「删除当前激活方案 → 回退预置/默认」。 */
  function handleDelete(id: string): void {
    void service.deleteScheme(id)
  }

  // ---- 我的主题视图：JSON 导入 ----

  /** 导入 JSON 文件：读文本 → parseTheme（校验+反推差异）→ 落库保存；任一步失败展示错误。 */
  async function handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text()
      const theme = await parseTheme(text)
      await store.saveCustomTheme(theme)
      setImportError(null)
      setView('schemes')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败，请检查文件内容')
    }
  }

  /** 文件选择变化：value 置空允许重复选择同一文件；选择新文件即清空上次错误。 */
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(null)
    await handleImportFile(file)
  }

  // ---- 恢复处理：编辑器内恢复操作对已保存方案的同步落 store ----

  /** 单维度恢复：对已保存方案同步落 store（themeId 为 null 的新建方案仅编辑器内存处理）。 */
  function handleResetDimension(themeId: string | null, dimension: 'wallpaper' | TOKEN_KEYS): void {
    if (themeId) void service.resetDimension(themeId, dimension)
  }

  /** 整方案重置：对已保存方案同步清空 diffs（themeId 为 null 时仅编辑器内存处理）。 */
  function handleResetScheme(themeId: string | null): void {
    if (themeId) void service.resetScheme(themeId)
  }

  // ---- 编辑器：预览 / 保存 / 取消 ----

  /** 编辑器内实时预览：差异 → service 预览层；返回结束预览的 disposer。 */
  const handlePreview = useCallback(
    (diffs: ThemeDiffs) => service.beginPreview(editorBase?.id ?? null, diffs),
    [service, editorBase],
  )

  /** 保存自定义方案：service 落库 + 激活，返回进入编辑器前的视图。 */
  async function handleSave(theme: CustomTheme): Promise<void> {
    await service.applyCustomTheme(theme)
    setView(editorOrigin)
  }

  /** 取消：丢弃未保存编辑，返回进入编辑器前的视图。 */
  function handleCancel(): void {
    setView(editorOrigin)
  }

  return (
    <div className={styles.section}>
      {view === 'editor' ? (
        <ThemeEditor
          base={editorBase}
          initial={editorInitial}
          onPreview={handlePreview}
          onSave={handleSave}
          onCancel={handleCancel}
          onResetDimension={handleResetDimension}
          onResetScheme={handleResetScheme}
        />
      ) : (
        <>
          <header className={styles.header}>
            <h2 className={styles.title}>主题</h2>
            <p className={styles.description}>
              选择一套预置主题，主题色与壁纸将即时应用到整个界面。
            </p>
          </header>
          {/* 分段控件：预置主题 | 我的主题（编辑器视图有自己的顶栏，不渲染） */}
          <div className={styles.segment} role="group" aria-label="主题视图">
            <button
              type="button"
              className={cx(styles.segmentButton, view === 'presets' && styles.segmentActive)}
              onClick={() => setView('presets')}
            >
              预置主题
            </button>
            <button
              type="button"
              className={cx(styles.segmentButton, view === 'schemes' && styles.segmentActive)}
              onClick={() => setView('schemes')}
            >
              我的主题
            </button>
          </div>
          {view === 'presets' ? (
            <>
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
          ) : (
            <>
              <div className={styles.schemeToolbar}>
                <button
                  type="button"
                  className={styles.toolbarButton}
                  onClick={() => enterEditor(null, null, 'schemes')}
                >
                  新建方案
                </button>
                <button
                  type="button"
                  className={styles.toolbarButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  导入
                </button>
                {/* 恢复默认：两步内联确认；一键回 shell 默认：清除预置选择 + 激活自定义方案（无壁纸 + 系统色板） */}
                <button
                  type="button"
                  className={cx(styles.toolbarButton, confirmResetAll && styles.toolbarButtonDanger)}
                  onClick={() => {
                    if (confirmResetAll) {
                      void service.resetAll()
                      setConfirmResetAll(false)
                    } else {
                      setConfirmResetAll(true)
                    }
                  }}
                >
                  {confirmResetAll ? '确认恢复默认？' : '恢复默认'}
                </button>
                {/* 隐藏的原生文件选择输入：仅作为「导入」按钮的触发源 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                />
              </div>
              {importError && <p className={styles.importError}>{importError}</p>}
              <SchemeList
                schemes={customThemes}
                activeId={active.kind === 'custom' ? active.id : null}
                onActivate={handleActivate}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
