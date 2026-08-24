/**
 * dsh-customization-settings 的构建配置。
 *
 * 宿主半与浏览器半分开打包：先由 `tsc`（tsconfig.json）把 `src/**` 编译成
 * `lib/types/**` 的 JS + .d.ts（`rootDir: src`、`outDir: lib/types`），随后
 * tsdown 分别把两半打包到 `lib/`：
 *
 *   - host：  `lib/types/index.js`        → `lib/index.js`（ESM，node）
 *   - client：`lib/types/client/index.js` → `lib/client.js`（CJS，browser，
 *     用 `window.__ModuleLoader__.load({ id, factory })` 包裹，供 web 外壳的
 *     模块表加载）。
 *
 * 这是对官方 `clientBundle` 预设（packages/client/tsdown.client.ts，未随
 * 发布物下发）的独立镜像，参照第三方插件 dsh-image-gen / working-activity。
 */
import type { UserConfig } from 'tsdown'

/**
 * 浏览器半的外部模块清单：这些 specifier 由 web 外壳的冻结模块表
 * （window.__DSH_BOOT__）在运行时注入的 require 中解析，打包时保持 external。
 * 只保留本插件真正会用到的平台种子词。
 */
const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings/client',
]

/** 宿主半：无宿主行为，仅产出 ESM 入口。 */
const host: UserConfig = {
  name: 'dsh-customization-settings',
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/** 浏览器半：CJS 工厂产物，供 web 外壳模块表加载。 */
const client: UserConfig = {
  name: 'dsh-customization-settings/client',
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    // 平台种子模块保持 external（由外壳冻结模块表在运行时解析）。
    neverBundle: [...CLIENT_EXTERNALS],
    // 其余一律内联：跨插件 value import 会让 tsdown 自动外置 node_modules
    // 依赖，但运行时只有外壳模块表能应答 require，因此必须打进 bundle。
    alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-customization-settings", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
