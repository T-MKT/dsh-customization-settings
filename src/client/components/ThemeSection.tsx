import { useSyncExternalStore } from 'react'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ThemeService } from '../theme/service.js'
import type { Theme } from '../theme/spec.js'
import { PresetGrid } from './PresetGrid.js'
import styles from './ThemeSection.module.css'

export interface ThemeSectionProps extends SettingsSectionOwnerProps {
  /** 主题合成服务：applyTheme / getActiveId / subscribe 均由此提供。 */
  service: ThemeService
  /** 预置主题列表（含「跟随系统」项的处理由 PresetGrid 负责）。 */
  presets: readonly Theme[]
}

/**
 * 「外观」设置分区 → 「主题」分区正文（提交点 4，M1 仅预置主题视图）。
 *
 * 组件不直接接触 store/theme 服务：activeId 通过 useSyncExternalStore 订阅
 * service（subscribe 返回的 disposer 恰是取消订阅函数，getSnapshot 返回
 * `string | null`），选择交由 PresetGrid 回调 `service.applyTheme`。
 * 我的主题/编辑器视图留待后续提交点。
 */
export function ThemeSection({ service, presets }: ThemeSectionProps): JSX.Element {
  const activeId = useSyncExternalStore(service.subscribe, service.getActiveId)
  return (
    <div className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>主题</h2>
        <p className={styles.description}>
          选择一套预置主题，主题色与壁纸将即时应用到整个界面。
        </p>
      </header>
      <PresetGrid
        presets={presets}
        activeId={activeId}
        onSelect={(id: string | null) => void service.applyTheme(id)}
      />
    </div>
  )
}
