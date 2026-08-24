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
 *
 * CSS Modules 处理：tsc 不会把 `*.module.css` 复制进 `lib/types`，且 tsdown
 * 的 css-guard 在未安装 `@tsdown/css` 时对 `.css` 直接报错。为此在客户端
 * 打包时用自研 rolldown 插件（cssModulesInline，见下）镜像官方工具链的
 * `dsh-css` 机制：把 `.module.css` 编译为一个虚拟 JS 模块——类名哈希化 +
 * 注入 `<style data-plugin-css>` 标签 + 导出类名映射，产物与
 * `@deepseek-ai/dsh-client-ui-theme` 的既有 CSS 产物同机制。
 */
import { readFileSync, existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import type { Plugin } from 'rolldown'
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

// ---- CSS Modules 内联（镜像官方 dsh-css 机制） ----

const CSS_VIRTUAL_PREFIX = '\0cst-css:'
const PLUGIN_ID = 'dsh-customization-settings'

/** djb2 哈希 → 6 位 base36；按文件内容确定，作为该文件全部类名的前缀。 */
function hash6(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

/** 把虚拟 id 还原为真实 css 文件路径：编译输出缺失时回退到 src 目录。 */
function cssFileFor(modulePath: string): string {
  if (existsSync(modulePath)) return modulePath
  const viaSrc = modulePath.replace(/(^|\/)lib\/types\//, '$1src/')
  if (existsSync(viaSrc)) return viaSrc
  throw new Error(`CSS Modules 文件不存在: ${modulePath}`)
}

/**
 * 把一段 `.module.css` 源码编译为可打包的 JS 模块：
 * - 所有类名替换为 `_<6位hash>_<原名>`（同文件同前缀）；
 * - 模块加载时注入 `<style data-plugin-css>` 标签（幂等，与官方产物一致）；
 * - 默认导出类名映射表。
 */
function compileCssModule(css: string, file: string): string {
  const prefix = hash6(css)
  const classMap: Record<string, string> = {}
  const transformed = css.replace(
    /\.([_a-zA-Z][_a-zA-Z0-9-]*)/g,
    (match, name: string) => {
      const hashed = `_${prefix}_${name}`
      classMap[name] = hashed
      return `.${hashed}`
    },
  )
  const tagId = `${PLUGIN_ID}/${basename(file)}`
  return `
const css = ${JSON.stringify(transformed)};
const tagId = ${JSON.stringify(tagId)};
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
export default ${JSON.stringify(classMap)};
`
}

/**
 * 拦截 `*.module.css` 的 rolldown 插件：resolveId 阶段把相对路径解析为
 * 真实文件并映射为 `\0cst-css:` 虚拟 id（不以 `.css` 结尾，避开 css-guard
 * 的过滤器），load 阶段产出编译后的 JS 模块。
 */
function cssModulesInline(): Plugin {
  return {
    name: 'cst-css-modules-inline',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      const resolved = importer ? resolve(dirname(importer), source) : resolve(source)
      return { id: `${CSS_VIRTUAL_PREFIX}${cssFileFor(resolved)}:inline` }
    },
    load(id) {
      if (!id.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const file = id.slice(CSS_VIRTUAL_PREFIX.length, -':inline'.length)
      return compileCssModule(readFileSync(file, 'utf8'), file)
    },
  }
}

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
  plugins: [cssModulesInline()],
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
