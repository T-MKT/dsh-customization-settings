/**
 * 设置弹窗导航单元格（navCell）的样式覆盖。
 *
 * shell（dsh-client-ui-settings-general）的 navCell 目前 hover/active 用 specific 纯色
 * （`.VOzbGW_navCell:hover` → `--dsw-specific-sidebar-nav-item-hover`、
 * `.VOzbGW_navCell.VOzbGW_active` → `--dsw-specific-sidebar-nav-item-active`）；
 * 本模块用 CSS 覆盖为 alias 交互色（`--dsw-alias-interactive-bg-hover` / 其 active 变种）。
 *
 * 选择器用结构定位（设置弹窗 `[role="dialog"]` 内 `nav` 的按钮；active 项带
 * `aria-current="true"`），不依赖哈希类名，shell 升级换哈希也稳定。
 * `!important` 确保压过 shell 同类规则；active + hover 时保持 active 变种
 * （与 shell 现行为一致：active 规则排在 hover 之后）。
 *
 * 独立于壁纸：始终注入、始终生效（与壁纸激活无关）。
 */

/** 样式标签标记（幂等去重）。 */
const STYLE_ATTR = 'data-cst-settings-nav-style'

/** navCell hover / active 覆盖规则。 */
const NAV_STYLE_RULES = [
  '[role="dialog"] nav button:hover {',
  '  background: var(--dsw-alias-interactive-bg-hover) !important;',
  '}',
  '[role="dialog"] nav button[aria-current="true"] {',
  '  background: var(--dsw-alias-interactive-bg-active) !important;',
  '}',
  '[role="dialog"] nav button[aria-current="true"]:hover {',
  '  background: var(--dsw-alias-interactive-bg-active) !important;',
  '}',
].join('\n')

/**
 * 注入设置弹窗导航样式覆盖；返回移除该样式标签的 disposer。
 * 幂等：页面已存在同标记样式（如插件重载）时复用，不重复注入。
 */
export function installSettingsNavStyle(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[${STYLE_ATTR}]`)
  if (existing) return () => {}
  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTR, '')
  style.textContent = NAV_STYLE_RULES
  document.head.appendChild(style)
  return () => {
    style.remove()
  }
}
