/**
 * CSS Modules 的 TypeScript 环境声明。
 *
 * 构建期由 tsdown.config.ts 的 cssModulesInline 插件把 `*.module.css`
 * 编译为「类名映射 + 样式注入」的 JS 模块；此处仅向 tsc 声明其形状，
 * 使组件能以 `import styles from './X.module.css'` 的方式使用。
 */
declare module '*.module.css' {
  /** 原始类名 → 哈希化后的类名。 */
  const classes: Record<string, string>
  export default classes
}
