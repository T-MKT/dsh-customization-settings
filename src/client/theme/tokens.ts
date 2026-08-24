/**
 * 主题令牌（Token）目录 —— 单一数据源（架构文档 §5.1）。
 *
 * - `key`：不带 `--` 前缀的令牌名。
 * - `cssVar`：完整的 CSS 变量名（带 `--` 前缀）。
 * - `label`：中文展示名。
 * - `group`：所属分组。
 */

/** 令牌分组。 */
export type TokenGroup = 'brand' | 'background' | 'text' | 'border' | 'state' | 'sidebar'

/** 全部 13 个令牌 key 的字面量联合类型。 */
export type TOKEN_KEYS =
  | 'dsw-alias-brand-primary'
  | 'dsw-alias-bg-base'
  | 'dsw-alias-bg-layer-1'
  | 'dsw-alias-bg-layer-2'
  | 'dsw-alias-bg-overlay'
  | 'dsw-alias-label-primary'
  | 'dsw-alias-label-secondary'
  | 'dsw-alias-border-l1'
  | 'dsw-alias-border-l2'
  | 'dsw-alias-state-error-primary'
  | 'dsw-alias-state-success-primary'
  | 'dsw-alias-state-warn-primary'
  | 'dsw-specific-sidebar-fill'

type TokenEntry = {
  key: TOKEN_KEYS
  cssVar: string
  label: string
  group: TokenGroup
}

/** 令牌目录：全部 13 个令牌，顺序即展示顺序。 */
export const THEME_TOKENS: TokenEntry[] = [
  { key: 'dsw-alias-brand-primary', cssVar: '--dsw-alias-brand-primary', label: '品牌主色', group: 'brand' },
  { key: 'dsw-alias-bg-base', cssVar: '--dsw-alias-bg-base', label: '基础背景', group: 'background' },
  { key: 'dsw-alias-bg-layer-1', cssVar: '--dsw-alias-bg-layer-1', label: '层级 1 表面', group: 'background' },
  { key: 'dsw-alias-bg-layer-2', cssVar: '--dsw-alias-bg-layer-2', label: '层级 2 表面', group: 'background' },
  { key: 'dsw-alias-bg-overlay', cssVar: '--dsw-alias-bg-overlay', label: '浮层/弹层', group: 'background' },
  { key: 'dsw-alias-label-primary', cssVar: '--dsw-alias-label-primary', label: '主要文字', group: 'text' },
  { key: 'dsw-alias-label-secondary', cssVar: '--dsw-alias-label-secondary', label: '次要文字', group: 'text' },
  { key: 'dsw-alias-border-l1', cssVar: '--dsw-alias-border-l1', label: '主要边框', group: 'border' },
  { key: 'dsw-alias-border-l2', cssVar: '--dsw-alias-border-l2', label: '加强边框', group: 'border' },
  { key: 'dsw-alias-state-error-primary', cssVar: '--dsw-alias-state-error-primary', label: '错误', group: 'state' },
  { key: 'dsw-alias-state-success-primary', cssVar: '--dsw-alias-state-success-primary', label: '成功', group: 'state' },
  { key: 'dsw-alias-state-warn-primary', cssVar: '--dsw-alias-state-warn-primary', label: '警告', group: 'state' },
  { key: 'dsw-specific-sidebar-fill', cssVar: '--dsw-specific-sidebar-fill', label: '侧边栏填充', group: 'sidebar' },
]

/** 分组展示顺序（品牌/背景/文字/边框/状态/侧边栏）。 */
export const TOKEN_GROUPS: { id: TokenGroup; label: string }[] = [
  { id: 'brand', label: '品牌' },
  { id: 'background', label: '背景' },
  { id: 'text', label: '文字' },
  { id: 'border', label: '边框' },
  { id: 'state', label: '状态' },
  { id: 'sidebar', label: '侧边栏' },
]

/** 13 个令牌 key 的只读数组（由目录派生，保持单一数据源）。 */
export const THEME_TOKEN_KEYS: readonly TOKEN_KEYS[] = THEME_TOKENS.map((token) => token.key)

/** 按 key 查找令牌条目；传入未登记的 key 会抛出错误。 */
export function getToken(key: TOKEN_KEYS): TokenEntry {
  const token = THEME_TOKENS.find((entry) => entry.key === key)
  if (!token) throw new Error(`未知的主题令牌: ${key}`)
  return token
}
