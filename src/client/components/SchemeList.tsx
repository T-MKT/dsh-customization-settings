/**
 * 「我的主题」方案列表（架构文档 §5.6）。
 *
 * 纯展示 + 回调组件：只接收 props，不接触任何 store / ctx / 主题服务，
 * 数据流为单向「父组件传数据 → 本组件展示 → 回调上抛」。
 * - 每行一项自定义方案：名称（省略号截断）+ 基底徽标 + 「当前」标记
 *   （activeId === scheme.id 时）；基底徽标由 basePresetId 解析预置名，
 *   找不到对应预置时回退显示原始 id，basePresetId === null 显示「默认基底」；
 * - 每行操作行（设为当前 / 编辑 / 复制 / 重命名 / 删除）：
 *   「重命名」为内联编辑（输入框 Enter/失焦提交、Esc 取消 + 确定/取消按钮），
 *   「删除」为内联确认（点击「确认」才调用 onDelete，点击取消或其他操作恢复）；
 * - schemes 为空时显示空态提示（「新建方案」按钮由 ThemeSection 工具条提供，
 *   本组件无 onNew prop）。
 */

import { useRef, useState } from 'react'
import type { CustomTheme } from '../theme/spec.js'
import { findPreset } from '../theme/presets.js'
import styles from './SchemeList.module.css'

export interface SchemeListProps {
  /** 全部自定义方案（按保存顺序）。 */
  schemes: readonly CustomTheme[]
  /** 当前激活的自定义方案 id；null = 无激活自定义方案。 */
  activeId: string | null
  /** 设为当前。 */
  onActivate: (id: string) => void
  /** 进入编辑器编辑该方案。 */
  onEdit: (id: string) => void
  /** 复制该方案。 */
  onDuplicate: (id: string) => void
  /** 重命名（name 为最终名称）。 */
  onRename: (id: string, name: string) => void
  /** 删除该方案。 */
  onDelete: (id: string) => void
}

/** 极简类名拼接助手（本仓库无 clsx 依赖）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 解析基底徽标文案：null → 「默认基底」，否则预置名，找不到回退原始 id。 */
function baseLabelOf(scheme: CustomTheme): string {
  if (scheme.basePresetId === null) return '默认基底'
  return findPreset(scheme.basePresetId)?.name ?? scheme.basePresetId
}

export function SchemeList({
  schemes,
  activeId,
  onActivate,
  onEdit,
  onDuplicate,
  onRename,
  onDelete,
}: SchemeListProps): JSX.Element {
  // ---- 行内交互的本地状态（仅本组件内部，不影响数据流） ----
  /** 正在内联重命名的方案 id；null = 无。 */
  const [renameId, setRenameId] = useState<string | null>(null)
  /** 重命名输入框草稿（失焦/回车时才提交）。 */
  const [renameDraft, setRenameDraft] = useState('')
  /** 已进入「确认删除？」态的方案 id；null = 无。 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  /** 重命名收尾守卫：提交/取消后置 true，屏蔽输入框卸载触发的失焦提交。 */
  const renameGuard = useRef(false)

  /** 开始内联重命名：草稿取当前名称，清除删除确认态。 */
  function startRename(scheme: CustomTheme): void {
    setConfirmDeleteId(null)
    setRenameId(scheme.id)
    setRenameDraft(scheme.name)
    renameGuard.current = false
  }

  /** 提交重命名：trim 后非空才调用 onRename，空则放弃；随后退出编辑态。 */
  function commitRename(): void {
    if (renameGuard.current) return
    renameGuard.current = true
    const name = renameDraft.trim()
    if (renameId !== null && name.length > 0) onRename(renameId, name)
    setRenameId(null)
  }

  /** 取消重命名：直接退出编辑态，不调用 onRename。 */
  function cancelRename(): void {
    renameGuard.current = true
    setRenameId(null)
  }

  /** 开始删除内联确认（同时退出可能进行中的重命名编辑）。 */
  function startDeleteConfirm(id: string): void {
    renameGuard.current = true
    setRenameId(null)
    setConfirmDeleteId(id)
  }

  /** 确认删除：调用 onDelete 后恢复原状。 */
  function confirmDelete(id: string): void {
    setConfirmDeleteId(null)
    onDelete(id)
  }

  /** 取消删除确认，恢复原状。 */
  function cancelDelete(): void {
    setConfirmDeleteId(null)
  }

  // 设为当前 / 编辑 / 复制：点击即视为「其他操作」，清除删除确认态。
  function handleActivate(id: string): void {
    setConfirmDeleteId(null)
    onActivate(id)
  }
  function handleEdit(id: string): void {
    setConfirmDeleteId(null)
    onEdit(id)
  }
  function handleDuplicate(id: string): void {
    setConfirmDeleteId(null)
    onDuplicate(id)
  }

  if (schemes.length === 0) {
    return <div className={styles.empty}>还没有自定义方案，点击上方「新建方案」创建</div>
  }

  return (
    <div className={styles.list}>
      {schemes.map((scheme) => {
        const active = scheme.id === activeId
        const renaming = scheme.id === renameId
        const confirmingDelete = scheme.id === confirmDeleteId

        return (
          <div key={scheme.id} className={cx(styles.row, active && styles.rowActive)}>
            <div className={styles.rowTop}>
              {renaming ? (
                <input
                  className={styles.renameInput}
                  value={renameDraft}
                  autoFocus
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <span className={styles.rowName} title={scheme.name}>
                  {scheme.name}
                </span>
              )}
              <span className={styles.baseBadge}>{baseLabelOf(scheme)}</span>
              {active && <span className={styles.activeBadge}>当前</span>}
            </div>

            <div className={styles.rowActions}>
              {renaming ? (
                <>
                  {/* mousedown preventDefault：点击按钮不让输入框先失焦触发提交 */}
                  <button
                    type="button"
                    className={cx(styles.actionBtn, styles.confirmPrimary)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitRename}
                  >
                    确定
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelRename}
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={active}
                    onClick={() => handleActivate(scheme.id)}
                  >
                    设为当前
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleEdit(scheme.id)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleDuplicate(scheme.id)}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => startRename(scheme)}
                  >
                    重命名
                  </button>
                  {confirmingDelete ? (
                    <>
                      <span className={styles.confirmText}>确认删除？</span>
                      <button
                        type="button"
                        className={cx(styles.actionBtn, styles.confirmDanger)}
                        onClick={() => confirmDelete(scheme.id)}
                      >
                        确认
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={cancelDelete}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={cx(styles.actionBtn, styles.actionBtnDanger)}
                      onClick={() => startDeleteConfirm(scheme.id)}
                    >
                      删除
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
