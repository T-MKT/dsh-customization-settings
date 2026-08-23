# 主题系统功能架构（壁纸 + 主题色）

> 目标：从「预置主题选择」起步，渐进演进到「完整主题自定义编辑器」。
> 核心设想：**主题（Theme）= 壁纸（Wallpaper）+ 主题色（TokenSet）**，二者合成为
> 一个可保存、可切换、可导出的整体。
> 前向兼容是硬约束：层次 1 产出的每一项资产（数据模型、token 目录、壁纸抽象、
> UI 入口、存储接口）都必须能原样承载层次 3，层次 3 只做扩展、不做推翻。

---

## 1. 分层路线图

| 层次 | 名称 | 内容 | 状态 |
|---|---|---|---|
| L1 | 预置主题 | 多套手调预置主题（每套 = 色板 + 可选壁纸），卡片选择即应用，明/暗双模式 | 本期开发 |
| L2 | 自定义编辑（壁纸 + 主题色） | 用户分别编辑壁纸（图片/位置/遮罩）与主题色（品牌/背景/文字/边框/状态色） | 内化进 L3，不单独发版 |
| L3 | 主题自定义编辑器 | 在 L2 之上加：方案管理、从预置起步编辑、实时预览、导出/导入、恢复默认 | 最终目标 |

开发顺序：**L1 → L3**。L3 的编辑器以 L1 的预置库为素材，用户在「预置基础上覆盖」而不是另起一套体系。壁纸与主题色在领域模型上统一于 `Theme`，在编辑 UI 上允许独立调整（对应 TODO 的 1.1 壁纸 / 1.2 主题色条目）。

---

## 2. 设计原则

1. **单一领域模型**：预置主题与用户自定义方案共用同一个 `Theme`（版本化 schema），
   `Theme = Wallpaper + TokenSet`。L1 先定型，L3 只增字段。
2. **分层合成**：渲染结果 = 基础 shell（light/dark）→ 预置主题层 → 用户覆盖层，
   每个主题层内部再分两个子面：
   - 主题色面：走 `theme.register`（预置）/ `theme.overrideTokens`（用户覆盖）；
   - 壁纸面：走自有的「壁纸渲染层」（CSS 变量 + 背景容器，见 §5.4），不占用 token。
3. **Token 目录与壁纸抽象都是单一事实来源**：13 个颜色 token 与「用户可编辑项」的映射、
   壁纸的可编辑维度（图片/位置/遮罩）集中定义，只增不改。
4. **UI 同区演进**：所有功能都挂在已有的 `settings.section`「外观」分区内，L3 只在该
   分区内新增子视图，不新增导航入口。
5. **存储接口先行**：L1 就定义 `ThemeStore` 接口并落地实现（元数据走宿主 `settings`
   namespace，落盘 `$DSH_HOME/settings.yaml`；壁纸图片资产走文件系统 + 静态路由，
   见 §5.4），L3 直接复用。

---

## 3. 领域模型：Theme

### 3.1 概念结构

```
Theme
├── 身份：id、name、kind（preset | custom）、basePresetId?
├── Wallpaper（壁纸）── 可独立编辑，也可随主题整体保存
│   ├── image        图片来源（内置资源 key / URL / 上传资产 id；null = 无壁纸）
│   ├── placement    'fullscreen'（全屏）| 'conversation'（仅对话区）
│   ├── maskColor    遮罩颜色（十六进制）
│   └── maskOpacity  遮罩透明度（0~1）
└── TokenSet（主题色）── 用户可编辑的颜色集合
    ├── colorScheme  'light' | 'dark' | 'dual'（dual = 明暗各有独立值）
    └── tokens       Record<tokenName, { light, dark }>
```

### 3.2 TypeScript 定义（L1 定型，L3 只增可选字段）

```ts
/** 壁纸：主题的视觉背景层 */
interface Wallpaper {
  /** 图片来源：'preset:forest' 内置资源 / URL / 'asset:<id>' 用户上传资产；null = 无 */
  image: string | null
  /** 显示位置：全屏 or 仅对话区 */
  placement: 'fullscreen' | 'conversation'
  /** 遮罩颜色（#rrggbb，不透明） */
  maskColor: string
  /** 遮罩透明度 0~1 */
  maskOpacity: number
}

/** 主题色：用户可编辑的颜色集合 */
interface TokenSet {
  colorScheme: 'light' | 'dark' | 'dual'
  /** 键为 §5.1 token 目录中的 token 名 */
  tokens: Record<string, { light: string; dark: string }>
}

/** 统一领域模型：预置与自定义共用 */
interface Theme {
  schemaVersion: 1
  id: string                       // 'preset.forest' | 'custom.<uuid>'
  name: string
  kind: 'preset' | 'custom'        // L3 字段，L1 时全部为 preset
  basePresetId?: string            // L3 字段：custom 方案的基底预置
  wallpaper: Wallpaper             // 壁纸面
  tokenSet: TokenSet               // 主题色面
}
```

### 3.3 不变式

- 预置主题：`wallpaper.image` 只允许内置资源 key 或 URL，不允许用户资产引用；
- 自定义主题：未编辑的维度继承基底（`basePresetId` 对应主题），只存差异；
- `tokens` 中每个值必须是 `{ light, dark }` 双值（运行时校验强制）。

---

## 4. 渲染管线（分层合成）

```
基础 shell（内置 light/dark）
└── 预置主题层（L1 起存在）
    ├── 主题色面：theme.register({ id, colorScheme, overrides })  →  替换整个 token 层
    └── 壁纸面：壁纸渲染层写入 CSS 变量（--cst-wallpaper-*），背景容器消费
└── 用户覆盖层（L3 起存在）
    ├── 主题色面：theme.overrideTokens(source, tokens)  →  叠加用户 token 子集
    └── 壁纸面：壁纸渲染层替换 CSS 变量（同 source 语义：重复调用整体替换）
```

要点：

- 两个子面**各自独立生效**：只换壁纸不动主题色（TODO 1.1 独立条目），或只调主题色不换壁纸，都成立；保存为一个 Theme 时二者才绑定。
- 预置层与用户层的壁纸渲染都走同一套 CSS 变量通道，仅 source 不同（预置用注册的 theme id，用户用固定标识如 `dsh-customization-settings.preview`）。
- 卸载/回退时：主题色面由 `theme` 服务的 disposer 自动清理；壁纸面由壁纸渲染层的 disposer 清理（重置 CSS 变量到基础值）。
- `theme/change` 事件驱动 UI 状态同步（当前激活主题、卡片高亮、编辑器预览）。

---

## 5. 共享技术底座

### 5.1 Token 目录（主题色面，单一事实来源）

| 分组 | 用户可编辑项 | token |
|---|---|---|
| 品牌 | 品牌主色 | `--dsw-alias-brand-primary` |
| 背景 | 基础背景 | `--dsw-alias-bg-base` |
| 背景 | 层级 1 表面 | `--dsw-alias-bg-layer-1` |
| 背景 | 层级 2 表面 | `--dsw-alias-bg-layer-2` |
| 背景 | 浮层/弹层 | `--dsw-alias-bg-overlay` |
| 文字 | 主要文字 | `--dsw-alias-label-primary` |
| 文字 | 次要文字 | `--dsw-alias-label-secondary` |
| 边框 | 主要边框 | `--dsw-alias-border-l1` |
| 边框 | 加强边框 | `--dsw-alias-border-l2` |
| 状态 | 错误 | `--dsw-alias-state-error-primary` |
| 状态 | 成功 | `--dsw-alias-state-success-primary` |
| 状态 | 警告 | `--dsw-alias-state-warn-primary` |
| 侧边栏 | 侧边栏填充 | `--dsw-specific-sidebar-fill` |

只增不改：L3 若新增可编辑项（如字体 token）只追加行，不改既有键。

### 5.2 壁纸抽象（壁纸面，单一事实来源）

| 维度 | 可编辑项 | 说明 |
|---|---|---|
| 图片 | `image` | 内置资源 / URL / 上传资产；L1 预置只允许前两者 |
| 位置 | `placement` | `fullscreen` 全屏背景 / `conversation` 仅对话区背景 |
| 遮罩 | `maskColor` + `maskOpacity` | 保证文字可读性的半透明遮罩层 |

壁纸的**用户可编辑项集**与 Token 目录地位相同：集中定义、只增不改。

### 5.3 壁纸渲染层（CSS 变量通道）

壁纸不占 token，由插件自有的样式层承载：

```css
/* 插件注入的壁纸容器样式（预置值 = 基础默认） */
:root {
  --cst-wallpaper-image: none;
  --cst-wallpaper-placement: none;
  --cst-wallpaper-mask-color: #000000;
  --cst-wallpaper-mask-opacity: 0;
}
```

- 壁纸渲染层 = 把当前生效壁纸写入上述变量 + 提供背景容器样式（伪元素/背景层，
  按 `placement` 挂到全屏或对话区容器，遮罩以 `linear-gradient` 叠加）。
- 具体挂载方式（全屏/对话区的背景容器选择器）在实现阶段通过查询客户端
  Slots/样式能力确认，不硬编码 `document.body`。
- 对话区壁纸需要考虑与既有 `--dsw-alias-bg-*` 层级的关系：壁纸作为最底层背景，
  token 表面色保持半透明或由遮罩保证可读性——此协调规则在 M2 落地时细化。

### 5.4 存储

所有用户配置统一走宿主 `settings` 服务（`dsh-settings-file` 提供），落盘为
**`$DSH_HOME/settings.yaml`**（即 `~/.dsh/settings.yaml`，按 namespace 分段）：

```yaml
ui-onboarding:        # shell 既有 namespace
  welcomeNoticeVersion: ...
agent-default-model:  # shell 既有 namespace
  ...
dsh-customization-settings:   # ← 本插件注册的 namespace
  activeThemeId: preset.forest
  customThemes:
    - id: custom.xxx
      name: 我的森林
      basePresetId: preset.forest
      ...
```

- 宿主侧：`ctx.settings.register(ns, schema)` 注册 namespace（schema 用 schemastery，
  注册即校验既有存储段；返回 owner scope），`scope.update(ns, patch)` 写入。
- 客户端侧：通过 `ctx.settingsScope`（来自 `@deepseek-ai/dsh-client-ui-settings`）
  绑定同一 namespace 读写，走 wire 到宿主 settings 服务，最终落盘同一文件。
- 变更经 `settings/updated` 事件发布，多窗口一致；`replace({})` 即整段恢复默认。

```ts
interface ThemeStore {
  // L1：预置选择（主题色面走 setTheme 持久化；壁纸面走本接口）
  getActiveThemeId(): string | null
  setActiveThemeId(id: string | null): void
  // ↓ L3 新增（接口扩展，不破坏 L1 调用方）
  listCustomThemes(): CustomTheme[]
  saveCustomTheme(theme: CustomTheme): void
  removeCustomTheme(id: string): void
  setActiveCustomThemeId(id: string | null): void
}
```

资产通道分工：

| 数据 | 通道 | 落盘 |
|---|---|---|
| 预置选择偏好 | `theme.setTheme`（shell 的 settings 作用域，ui-theme namespace） | `~/.dsh/settings.yaml` |
| 自定义主题元数据 | 本插件 settings namespace（宿主 `settings.register` + 客户端 `settingsScope`） | `~/.dsh/settings.yaml` 新增一段 |
| 用户上传壁纸图片 | 文件系统数据目录（如 `$DSH_HOME/storages/` 或 profile 资产目录），宿主 `webServer.register` 挂静态路由（如 `/customization/assets/<id>`）供浏览器加载；settings 里只存 `asset:<id>` 引用 | 独立图片文件 |

src/index.ts 从空 apply 扩展为：注册 settings namespace + 注册壁纸资产静态路由。

### 5.5 UI 组件目录

> 组件职责与数据流详见 §5.6 前端显示设计；样式遵循 DSH 原 UI（CSS Modules +
> `--dsw-alias-*` token，见 §5.6.2）。

```
src/client/
├── index.ts                  # apply：注册 settings.section 外观分区 + theme/change 订阅
├── theme/
│   ├── tokens.ts             # §5.1 映射表（单一事实来源）
│   ├── wallpaper.ts          # §5.2 壁纸抽象 + 渲染层（CSS 变量通道）
│   ├── spec.ts               # Theme/Wallpaper/TokenSet 类型 + 校验 + JSON 迁移
│   ├── presets.ts            # L1 预置常量 PRESETS: Theme[]（含壁纸与色板）
│   ├── store.ts              # §5.4 ThemeStore（settings scope + 资产路由）
│   └── service.ts            # 合成逻辑：预置层 + 用户层 → register/overrideTokens + 壁纸变量
└── components/
    ├── ThemeSection.tsx      # 分区正文 + 视图切换（预置主题 | 我的主题 | 编辑器）
    ├── PresetGrid.tsx        # L1 卡片网格（色板 + 壁纸缩略图，+ L3 自定义按钮 + 跟随系统项）
    ├── SchemeList.tsx        # L3 我的主题列表
    ├── ThemeEditor.tsx       # L3 编辑器（壁纸设置区 + 主题色设置区）
    ├── WallpaperEditor.tsx   # L3 壁纸编辑：图片选择、位置切换、遮罩颜色/透明度
    └── ColorField.tsx        # 单颜色项（light/dark 双输入）
```

### 5.6 前端显示设计（设置 → 外观）

#### 5.6.1 入口与并存关系

- 本插件在 `settings.section` 注册 `appearance` 分区（左侧导航「外观」，order 25），
  该分区是主题管理的**完整页面**。
- DSH 自带 `ui-theme` 已在「通用设置」注册了 **Appearance 行**
  （`settings.general.item`，明暗/跟随系统的快捷切换）。二者并存、职责分工：
  - General 里的 Appearance 行：快速切换明暗偏好（保留 shell 原样，不修改）；
  - 本插件的「外观」分区：预置主题库、壁纸、主题色自定义的完整管理。
- 不重复造「明暗快捷切换」：分区内的「跟随系统」入口是**主题库的一部分**
  （作为一张卡片/置顶选项），与 General 行的语义一致但定位不同，互不冲突。

#### 5.6.2 视觉风格（遵循 DSH 原 UI，AGENTS.md 约束）

- **样式方案**：与 shell 一致使用 CSS Modules（哈希类名），不写全局选择器；
  局部样式文件如 `ThemeSection.module.css`。
- **取色**：一律引用 `--dsw-alias-*` token（`label-primary`/`bg-layer-1`/
  `border-l1`/`interactive-bg-hover` 等），**不硬编码色值**，保证明暗两套自动适配。
- **控件惯例**（对齐 shell 设置页实测参数）：
  - 卡片/行：`border-radius: 12px`，表面用 `--dsw-alias-bg-layer-1`，
    边框用 `--dsw-alias-border-l1`；
  - 悬停态：`--dsw-alias-interactive-bg-hover`；选中态：`--dsw-alias-brand-primary`
    描边或背景；
  - 字号 14px / 行高 22px；按钮与表单控件风格沿用 primitives 包
    （`@deepseek-ai/dsh-client-ui-primitives`，settings-general 同源依赖）。
- **布局**：分区正文为单列滚动内容区（与 General/Models 页一致），
  卡片网格用 CSS Grid（自适应列宽，窄屏降为单列）。

#### 5.6.3 组件数据流

```
ThemeSection（settings.section 分区正文）
├── props：SettingsSectionOwnerProps（close 等）
├── 视图状态：useState('presets' | 'schemes' | 'editor')（内存态）
├── 订阅：ctx.on('theme/change', ...) → 快照驱动卡片高亮与预览区
└── 数据读写：settingsScope 绑定本插件 namespace（activeThemeId / 自定义方案）
     ├── PresetGrid：PRESETS 常量 + activeThemeId → 高亮；
     │              点击 → service.applyTheme(id)（setTheme + 壁纸层）
     ├── SchemeList：settingsScope.listCustomThemes() → 列表
     └── ThemeEditor：编辑会话（内存态）→ 保存时 settingsScope.saveCustomTheme
```

- 所有组件通过 props 接收数据/回调，不在组件内直接 `ctx.get`（与 shell 的
  `PropsStore`/`PropsRuntime` 组合模式对齐）；store 形状参考 ui-theme 的
  `createAppearanceRowStore`（`EngineStoreHandle` + `sync` 动作）。
- 壁纸渲染层独立于 React 树：`service.ts` 在 apply 层持有 CSS 变量写入口，
  组件只负责「告诉 service 当前激活主题」，不直接碰 DOM。

#### 5.6.4 明暗与壁纸呈现

- **跟随系统**：主题库顶部固定一项「跟随系统」（图标 + 文字），当前为 system 时高亮；
  明暗快照由 `theme/change` 驱动，无需页面自行检测。
- **卡片明暗预览**：每张卡片色板区以双行色块展示 light/dark 两组主色
  （品牌色 + 背景层级），缩略图用 `--cst-wallpaper-*` 渲染小背景
  （无壁纸主题显示纯色）。
- **编辑器明暗切换**：编辑器内提供 light/dark 分段切换（与卡片预览一致），
  编辑中的值分别对应 TokenSet 的 `tokens[token].light/.dark`。

### 5.7 与 theme 服务的职责边界

| 动作 | 使用方 |
|---|---|
| 注册预置主题色板 | 本插件 `theme.register`（持有 disposer） |
| 切换主题/跟随系统 | 本插件 `theme.setTheme` |
| 用户主题色覆盖层 | 本插件 `theme.overrideTokens` |
| 壁纸渲染 | 本插件壁纸渲染层（CSS 变量，不碰 token） |
| 当前主题状态 | 本插件监听 `theme/change`（snapshot） |
| 持久化 | 色板偏好由 shell 持久化；自定义主题（含壁纸）由本插件 Store 持久化 |

---

## 6. 层次 1：预置主题

### 6.1 功能列表

| 编号 | 功能 | 说明 |
|---|---|---|
| L1-F1 | 预置主题库 | 4~6 套手调主题（如默认、暮蓝、森林、暖橙、石墨、紫罗兰），每套含 light/dark 色板 + 可选壁纸（内置资源） |
| L1-F2 | 主题卡片展示 | 卡片含主题名 + 色板预览 + 壁纸缩略图（有壁纸的主题） |
| L1-F3 | 选择即应用 | 点击卡片 → 主题色面 `theme.setTheme(id)` + 壁纸面渲染层应用 → 立即生效 |
| L1-F4 | 明暗跟随 | 保留 `system`（跟随系统）入口；`theme` 服务自动处理 `prefers-color-scheme` 翻转 |
| L1-F5 | 当前状态标记 | 卡片高亮当前激活主题；监听 `theme/change` 同步状态 |
| L1-F6 | 选择持久化 | 主题色面经 `setTheme` 持久化；壁纸选择经 `ThemeStore.setActiveThemeId` 持久化，刷新后保持 |
| L1-F7 | 恢复默认 | 一键切回 shell 内置默认（无壁纸 + 默认色板） |

### 6.2 交互流程

```
进入设置 → 外观 → 主题卡片网格
   ├─ 点击某预置卡片 → 应用主题色 + 应用壁纸 → 全 UI 即时换肤 → 卡片高亮
   └─ 点击「跟随系统」 → setTheme('system')，壁纸保留当前主题的
```

### 6.3 技术要点

- 预置主题的色板面通过 `theme.register({ id, colorScheme, overrides })` 注册；
  `overrides` 必须为全部 13 个 token 提供 `{ light, dark }` 双值。
- 预置壁纸图片作为插件内置资源（打包静态资源或 data URI 常量），随 bundle 分发，
  不依赖网络。
- 预置数据以常量 `PRESETS: Theme[]` 存放，L3 的「从预置起步」直接消费同一数组。
- UI 挂在 `settings.section` 的 `appearance` 分区内（已注册），正文从空占位替换为
  卡片网格；呈现细节（卡片样式、色板预览、跟随系统项）遵循 §5.6 前端显示设计。
- 前端显示验收还需覆盖：外观分区在左侧导航正确显示（order 25）、与 General 的
  Appearance 行并存不冲突、明暗两套下卡片文字可读。

### 6.4 验收标准

- [ ] 设置 → 外观 中能看到 ≥4 套预置主题卡片与「跟随系统」，有壁纸的主题缩略图正确
- [ ] 外观分区在左侧导航显示且与 General 的 Appearance 行并存不冲突
- [ ] 卡片在明暗两套配色下文字/色板均可读（全部用 `--dsw-alias-*` token，无硬编码色值）
- [ ] 点击卡片：主题色与壁纸同时应用，全 UI 即时变化，刷新后保持
- [ ] 明暗两套配色均正确（无缺失 token、无裸字符串错误）
- [ ] 壁纸遮罩保证文字可读（深色遮罩覆盖浅色图片时正文仍清晰）
- [ ] 插件停用后主题与壁纸都回退，不残留覆盖层或 CSS 变量

---

## 7. 层次 3：主题自定义编辑器（含层次 2 的壁纸 + 主题色编辑）

### 7.1 功能列表

| 编号 | 功能 | 说明 |
|---|---|---|
| L3-F1 | 从预置起步 | 点预置卡片上的「自定义」→ 复制该预置为可编辑方案（含其壁纸与色板） |
| L3-F2 | 壁纸编辑 | 图片（上传/URL/内置资源）、位置（全屏/对话区）、遮罩颜色与透明度——TODO 1.1 全部条目 |
| L3-F3 | 主题色编辑 | 对 §5.1 用户可编辑项逐项调色，light/dark 分别编辑——TODO 1.2 全部条目 |
| L3-F4 | 实时预览 | 编辑中通过 `overrideTokens`（色板面）+ 壁纸渲染层（壁纸面）立即应用 |
| L3-F5 | 方案管理 | 自定义方案列表：新建、复制、重命名、删除、设为当前 |
| L3-F6 | 保存与持久化 | 编辑完成保存为命名 Theme，写入 Store（元数据 settings namespace + 图片资产宿主侧） |
| L3-F7 | 导出/导入 | 方案导出为 JSON（Theme 序列化，含壁纸引用与色板），导入前做 schema 校验与版本迁移 |
| L3-F8 | 恢复默认 | 单维度恢复（壁纸/单个颜色）/ 整方案重置 / 一键回到 shell 默认 |
| L3-F9 | 与预置库共存 | 预置卡片区 + 自定义方案区并列展示，随时切换 |

### 7.2 编辑模型

```
自定义 Theme = 预置基底（basePresetId 或 null=默认） + 用户差异
   ├── 壁纸差异：image / placement / maskColor / maskOpacity 各自可覆盖
   └── 色板差异：用户改过的 token 子集
```

- 方案只存**用户改过的维度**，未改项从基底继承——保证「从预置起步」的语义。
- 渲染时：基底色板走预置层（若基底非默认），用户色板覆盖走 `overrideTokens`；
  壁纸由渲染层按「基底壁纸 + 用户壁纸覆盖」合成，source 不同互不干扰。
- 方案切换 = 移除旧用户层 + 应用新用户层（同 source 重复调用自动替换整层）。

### 7.3 UI 结构（均在「外观」分区内）

> 分区整体呈现规范见 §5.6（入口并存、视觉风格、数据流、明暗呈现）；此处为编辑器视图的细化结构。

```
外观（settings.section: appearance）
├── 视图切换：预置主题 | 我的主题（分段控件，样式对齐 shell 分段控件）
├── [预置视图] 预置卡片网格（L1 卡片 + 每张卡「自定义」按钮 + 顶部「跟随系统」项）
├── [我的视图] 方案列表（新建 / 重命名 / 删除 / 设为当前）
└── [编辑器视图]（从卡片或方案进入）
    ├── 顶栏：方案名（可编辑）、保存、导出、恢复默认
    ├── 预览区：实时色板 + 壁纸预览（随编辑更新，明暗双态切换）
    ├── 编辑区
    │   ├── 壁纸段：图片选择（上传/URL/内置资源）/ 位置切换（全屏/对话区）/
    │   │        遮罩颜色 + 透明度滑块（L3-F2）
    │   └── 主题色段：颜色分组（品牌/背景/文字/边框/状态/侧边栏），
    │        每项 light/dark 两个 ColorField（L3-F3）
    └── 底部：取消（丢弃未保存编辑）
```

### 7.4 技术要点

- **编辑会话与已保存状态分离**：编辑中的临时值只存在于内存 + 预览层（色板
  `overrideTokens` + 壁纸变量）；点「保存」才写入 Store 并固化。未保存离开 = 丢弃预览层。
- 壁纸图片上传：客户端选文件 → 宿主侧持久化（settings namespace / 资产文件）→
  返回资产 id（`asset:<id>`）；渲染时按 id 解析 URL。避免 data URI 撑爆 settings.yaml。
- 颜色输入使用 `<input type="color">` + 十六进制文本输入双通道（type=color 不支持 alpha，
  需额外 alpha 输入或先不做透明度——壁纸遮罩已覆盖大部分可读性需求）。
- 导出 JSON 含 `schemaVersion` 字段，导入时按版本迁移；壁纸引用（`asset:`）导出时
  转为相对引用，导入时重建资产。
- 事件流：编辑 → 预览层 → `theme/change` + 壁纸变量更新 → 预览区/卡片刷新；
  卸载时 disposer 移除预览层与壁纸变量。
- **前端显示实现**：所有组件遵循 §5.6.3 的 props 模式（数据经 props 注入，
  store 形状对齐 shell 的 `EngineStoreHandle`）；编辑器内的分段控件、按钮、
  表单样式复用 primitives 包，不新造控件。

### 7.5 验收标准

- [ ] 从任一预置可进入编辑器，修改壁纸图片/位置/遮罩与品牌色后全 UI 实时变化
- [ ] light/dark 分别编辑正确；保存后刷新保持
- [ ] 可新建/复制/重命名/删除多个方案，并随时切换
- [ ] 壁纸上传在刷新/重启后仍可用（宿主侧资产持久化）
- [ ] 导出 JSON 后可导入还原（含壁纸引用），非法文件被拒绝且不破坏现有方案
- [ ] 删除当前方案后回退到预置/默认，无残留覆盖层或壁纸变量

---

## 8. 前向兼容保证（L1 → L3）

| 资产 | 保证 |
|---|---|
| `Theme` 模型 | L1 定 schema v1（含 wallpaper + tokenSet）；L3 只新增可选字段（`kind`/`basePresetId`），旧数据不失效 |
| Token 目录 | 只增不改；L1 的 13 项在 L3 中键名与含义完全不变 |
| 壁纸抽象 | L1 定 image/placement/maskColor/maskOpacity 四维；L3 只增加图片来源类型（上传资产），不改维度 |
| `PRESETS` 常量 | L3 直接复用，「从预置起步」零改造（壁纸随之继承） |
| `settings.section` 入口 | L1 已注册 `appearance` 分区；L3 只在分区内加子视图，不改注册 |
| `ThemeStore` 接口 | L1 定义的方法签名不变；L3 只追加方法 |
| 渲染分层 | L1 的「预置层（色板 + 壁纸）」在 L3 中原样保留，新增「用户层」叠加其上 |
| `theme/change` 监听 | L1 建立的事件订阅点，L3 复用并扩展消费方 |

---

## 9. 里程碑与任务分解

### M1（L1：预置主题）
1. `theme/tokens.ts`：token 映射表 + 分组说明
2. `theme/wallpaper.ts`：壁纸抽象 + 渲染层（CSS 变量通道 + 内置资源）
3. `theme/spec.ts`：Theme/Wallpaper/TokenSet 类型 + 校验
4. `theme/presets.ts`：4~6 套预置主题（色板全 token + 壁纸内置资源）
5. `theme/service.ts`：register 色板 + 壁纸渲染层应用 + 持有 disposer
6. `theme/store.ts`：settings scope Store（仅 activeThemeId）+ 宿主资产通道占位
7. `components/PresetGrid.tsx` + `ThemeSection.tsx`：卡片网格（色板 + 壁纸缩略图）+ 跟随系统 + 状态高亮
8. 宿主侧：src/index.ts 扩展注册壁纸资产持久化能力（M1 可先只留接口）
9. 验收（§6.4）

### M2（L3 编辑器，第一阶段：壁纸 + 主题色编辑）
1. Store 扩展：schemes CRUD + activeCustomThemeId
2. 宿主侧落地：壁纸图片上传/存储/解析（settings namespace 或资产文件）
3. `components/ThemeEditor.tsx`：编辑会话（内存态）+ 保存/取消
4. `components/WallpaperEditor.tsx`：图片选择、位置切换、遮罩颜色 + 透明度
5. `components/ColorField.tsx`：light/dark 双通道颜色输入
6. service.ts：预览层（overrideTokens + 壁纸变量）与用户层合成
7. 「从预置起步」：PresetGrid 加自定义按钮（继承壁纸）
8. 验收（§7.5 前 4 项）

### M3（L3 收尾：方案管理与数据交换）
1. `components/SchemeList.tsx`：方案列表管理
2. 导出/导入 JSON（含壁纸引用重建 + schema 校验与迁移）
3. 恢复默认（单维度 / 整方案 / 回默认主题）
4. 验收（§7.5 全部）

---

## 10. 风险与开放问题

| 风险/问题 | 说明 | 对策 |
|---|---|---|
| 壁纸渲染挂载点 | 全屏/对话区背景容器需与 shell 布局协调 | M1 实现时查询客户端 Slots/样式能力确认挂载方式，不硬编码 body |
| 壁纸与 token 表面色叠加 | 壁纸作为最底层背景时，`--dsw-alias-bg-*` 表面色若完全不透明会盖住壁纸 | 遮罩层 + 半透明表面色协调规则在 M2 落地时细化；预置主题人工校准 |
| 图片资产持久化 | 二进制不适合进 settings.yaml | 图片存文件系统数据目录 + `webServer` 静态路由；settings 只存 `asset:` 引用；M1 预留接口 |
| 16 进制透明度 | `<input type="color">` 不支持 alpha | 颜色先做不透明；壁纸遮罩已覆盖可读性需求 |
| 明暗派生算法 | 「从 light 派生 dark」质量不可控 | M2 先做手调双值，推导算法列为 M3 后的可选增强 |
| 预置主题视觉质量 | 手调 13 token 难保证协调 | 每套主题按「主色 + 色相轮派生」流程生成，人工校准 |
| 与 shell 未来主题更新冲突 | token 目录是 alias 层，理论上稳定 | 依赖 alias 层而非 specific 层（侧边栏除外）；升级时回归测试 |
| 导出主题体积 | 壁纸内置资源随 JSON 导出会膨胀 | M3 导出时壁纸引用化（`preset:`/`asset:` id），不内嵌图片数据 |
