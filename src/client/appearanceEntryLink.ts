/**
 * 在「通用设置 → 外观」的快捷切换行（ui-theme 的 AppearanceRow，即
 * `._8HJdBW_group`）标题行内，注入一个指向本插件「外观」设置分区的
 * 链接（架构 §5.6.1 的入口并存：General 行做快捷切换，分区做完整主题
 * 管理）。链接与「外观」标题同一行、右对齐。
 *
 * ui-theme 的 AppearanceRow 没有内部插槽，设置面板的活动分区又是组件内
 * 状态（无公开 API），因此采用 DOM 注入：
 *
 * 1. MutationObserver 监听设置面板挂载（面板仅在打开时渲染，AppearanceRow
 *    随之出现/消失），幂等地把链接挂到 title 节点内；
 * 2. title 行改为 flex（文字靠左、链接靠右）；title 本身无 React style
 *    管理，内联样式在重渲染时不会被覆盖；
 * 3. 点击链接时，在面板导航里找到 label 为「外观」的分区单元格并触发选择，
 *    等价于用户手动切换到本插件的「外观」分区。
 *
 * 返回 disposer：插件停用时断开 observer；注入的 DOM 随面板卸载自然消失。
 */

/** ui-theme AppearanceRow 的根节点（CSS Modules 哈希类名，取自实际产物）。 */
const GROUP_SELECTOR = '._8HJdBW_group'
/** 行内标题节点（「外观」文字），链接挂在其内、右对齐。 */
const TITLE_SELECTOR = '._8HJdBW_title'
/** 注入链接的标记属性，用于幂等去重。 */
const LINK_MARKER = 'data-cst-appearance-entry-link'
/** 设置面板导航中本插件「外观」分区的 label（与 src/client/index.ts 注册一致）。 */
const APPEARANCE_NAV_LABEL = '外观'

export function installAppearanceEntryLink(): () => void {
  if (typeof document === 'undefined') return () => {}

  /** 幂等注入：组内无标记链接时才创建并挂到 title 行内（右对齐）。 */
  function ensureInjected(group: Element): void {
    if (group.querySelector(`[${LINK_MARKER}]`)) return
    const title = group.querySelector<HTMLElement>(TITLE_SELECTOR)
    if (!title) return

    const link = document.createElement('a')
    link.setAttribute(LINK_MARKER, '')
    link.href = '#'
    link.textContent = '在“外观”中设置'
    // 链接样式：颜色按需求取 static deepseek-450，其余对齐 DSH 行内文字规格。
    link.style.color = 'var(--dsw-static-deepseek-450)'
    link.style.fontSize = '14px'
    link.style.lineHeight = '22px'
    link.style.textDecoration = 'none'
    link.style.cursor = 'pointer'
    link.style.whiteSpace = 'nowrap'
    link.style.flexShrink = '0'

    link.addEventListener('click', (event) => {
      event.preventDefault()
      openAppearanceSection(link)
    })

    // 标题行改为 flex：文字靠左，链接靠右（title 无 React style 管理，内联样式安全）。
    title.style.display = 'flex'
    title.style.alignItems = 'center'
    title.style.justifyContent = 'space-between'
    title.style.width = '100%'
    title.appendChild(link)
  }

  /** 点击链接：在设置面板导航中选中本插件的「外观」分区。 */
  function openAppearanceSection(link: HTMLAnchorElement): void {
    const dialog = link.closest('[role="dialog"]')
    if (!dialog) return
    const nav = dialog.querySelector('nav')
    if (!nav) return
    const cell = Array.from(nav.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === APPEARANCE_NAV_LABEL)
    cell?.click()
  }

  /** 扫描当前存在的全部 AppearanceRow 并注入。 */
  function scan(): void {
    for (const group of Array.from(document.querySelectorAll(GROUP_SELECTOR))) {
      ensureInjected(group)
    }
  }

  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
