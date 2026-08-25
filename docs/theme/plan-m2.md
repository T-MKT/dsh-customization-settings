# Theme 主题系统 · 编码计划 M2（plan-m2.md）

> 依据：`docs/theme/theme-architecture.md` §7（L3 编辑器第一阶段）+ §5.4 存储。
> 前置：M1 已交付（预置主题库、壁纸渲染层、settings namespace、外观分区）。
> 目标：**壁纸 + 主题色自定义编辑器**——从预置起步、编辑壁纸与主题色、
> 实时预览、保存为命名方案并持久化。
> 约束：遵循 AGENTS.md（分支、提交点、单层并行、DSH 原 UI 风格）。
> 当前分支：`feature/theme`（严禁 main）。

---

## 1. 需求（M2 范围）

| 编号 | 需求 | 架构章节 |
|---|---|---|
| M2-R1 | 数据层扩展：`CustomTheme` 差异模型 + settings schema 扩展 + store CRUD | §3/§5.4 |
| M2-R2 | 宿主资产通道：壁纸图片上传/存储/解析（webServer 路由 + 文件系统） | §5.4 |
| M2-R3 | 编辑器核心：ThemeEditor 编辑会话（内存态）+ 保存/取消 | §7.3 |
| M2-R4 | WallpaperEditor：图片（上传/URL/内置）、位置、遮罩颜色/透明度 | §7.3 |
| M2-R5 | ColorField：light/dark 双通道颜色输入 | §7.3 |
| M2-R6 | service 扩展：预览层（overrideTokens + 壁纸变量）+ 用户层合成 + 方案切换 | §7.2/§7.4 |
| M2-R7 | 入口接线：PresetGrid 加「自定义」按钮（继承壁纸）+ ThemeSection 视图切换 | §7.3 |

**M2 不做**（M3 交付）：方案列表管理（重命名/删除）、导出/导入、恢复默认。

---

## 2. 代码结构（M2 增量）

```
src/
├── index.ts                      # 宿主：settings schema 扩展 + 资产路由注册（M2-R2）
├── settings.ts                   # （扩展）ThemeSettings 增 customThemes/activeCustomThemeId
├── client/
│   ├── index.ts                  # apply：视图切换接线 + 资产 API 注入
│   ├── theme/
│   │   ├── spec.ts               # （扩展）CustomTheme/ThemeDiffs 类型 + 校验
│   │   ├── store.ts              # （扩展）schemes CRUD + activeCustomThemeId
│   │   ├── service.ts            # （扩展）预览层 + 用户层合成 + 方案切换
│   │   └── assets.ts             # （新增）客户端资产 API（上传/URL 解析）
│   └── components/
│       ├── ThemeEditor.tsx       # （新增）编辑会话 + 顶栏 + 预览区
│       ├── WallpaperEditor.tsx   # （新增）壁纸编辑
│       ├── ColorField.tsx        # （新增）单颜色项
│       ├── PresetGrid.tsx        # （扩展）自定义按钮
│       └── *.module.css          # （新增/扩展）
```

---

## 3. 关键接口基线（已调研）

- **宿主资产通道**：`ctx.webServer.register({ kind: 'prefix', path: '/customization/assets', handler(req,res) })`。
  - `POST /customization/assets`：读请求体（图片二进制）→ 存 `$DSH_HOME/storages/dsh-customization-settings/assets/<id>`
    → 返回 `{ id }`；
  - `GET /customization/assets/<id>`：读文件 → 以 `image/*` Content-Type 返回；
  - 客户端用浏览器 `fetch` 相对路径（页面 origin 即 webServer origin）。
- **settings 写路径**：宿主 `settings.register` schema 扩展（新字段带默认值，
  旧存储段兼容）；客户端 `settingsScope` 读写同一 namespace。
- **预览层**：`ctx.theme.overrideTokens('dsh-customization-settings.preview', tokens)`
  返回 disposer；壁纸预览用 `applyWallpaper`（同 source 重复调用整体替换）。
- **差异模型**：自定义方案只存用户改过的维度：

```ts
interface ThemeDiffs {
  wallpaper?: Partial<Pick<Wallpaper, 'image' | 'placement' | 'maskColor' | 'maskOpacity'>>
  tokenDiffs?: Partial<Record<TokenKey, { light: string; dark: string }>>
}
interface CustomTheme {
  id: string                 // 'custom.<uuid>'
  name: string
  basePresetId: string | null   // null = shell 默认
  diffs: ThemeDiffs
}
```

---

## 4. 进度（提交点序列）

```
M2
├── 提交点 1：数据与资产底座（并联）
│   ├── Agent A：settings schema 扩展 + store CRUD（差异模型）
│   └── Agent B：宿主资产通道（webServer 路由 + 文件存储）
├── 提交点 2：编辑器核心（并联）
│   ├── Agent A：ColorField
│   ├── Agent B：WallpaperEditor
│   └── Agent C：ThemeEditor（会话 + 组装 A/B）
├── 提交点 3：合成与入口（并联）
│   ├── Agent A：service 扩展（预览层 + 用户层 + 切换）
│   └── Agent B：PresetGrid 自定义按钮 + ThemeSection 视图接线
└── 提交点 4：集成收尾（线性）
    └── index.ts 组装 + typecheck/build + 验收（§7.5 前 4 项）
```

每个提交点为一次 commit（约定式提交，注明完成的 plan 章节；不 push）。

---

## 5. 提交点明细

### 提交点 1：数据与资产底座

#### 1.1 需求 1A：settings schema 扩展 + store CRUD（最小提交点）
- **Agent A**
  - `src/settings.ts` 扩展 `ThemeSettings`：
    - 增 `activeCustomThemeId: string | null`（默认 null）与
      `customThemes: CustomTheme[]`（默认 []，schema 校验每项形状）；
  - `src/client/theme/spec.ts`：新增 `ThemeDiffs` / `CustomTheme` 类型
    （§3 形状）+ `validateCustomTheme()`；
  - `src/client/theme/store.ts` 扩展：
    - `createCustomTheme(name, basePresetId)`（生成 `custom.<uuid>` id）；
    - `listCustomThemes()` / `saveCustomTheme(theme)` / `removeCustomTheme(id)`；
    - `getActiveCustomThemeId()` / `setActiveCustomThemeId(id | null)`；
    - 全部经 settingsScope 的 set/unset 写入（字段级），保持 revision 语义。

#### 1.2 需求 1B：宿主资产通道（最小提交点）
- **Agent B**
  - `src/index.ts`（宿主）注册 webServer 路由：
    - `POST /customization/assets`：校验 Content-Type 为 `image/*` → 生成
      `crypto.randomUUID()` id → 写入 `$DSH_HOME/storages/dsh-customization-settings/assets/<id>`
      → 响应 `{ id }`（JSON）；
    - `GET /customization/assets/<id>`：读文件 → `image/*` 响应；不存在 → 404；
  - 文件读写用宿主 `ctx.fs`（或 node fs，确认宿主可用全局）；目录不存在时创建；
  - 路由注册返回 disposer，随 fiber 清理。
  - `src/client/theme/assets.ts`：
    - `uploadWallpaper(file: Blob): Promise<string>`（fetch POST → `asset:<id>`）；
    - `assetUrl(assetId: string): string`（`/customization/assets/<id>` 相对路径）。

**提交点 1 完成标准**：typecheck 通过；宿主注册路由后 POST/GET 图片往返成功
（可 curl 验证）；store CRUD 后 `settings.yaml` 出现 `customThemes` 段。

---

### 提交点 2：编辑器核心

#### 2.1 需求 2A：ColorField（最小提交点）
- **Agent A**
  - `src/client/components/ColorField.tsx`：props `{ label, light, dark, onChange(light, dark) }`；
  - 每项渲染 light/dark 两个输入：`<input type="color">` + 十六进制文本输入双通道
    （架构 §7.4：type=color 不支持 alpha，先做不透明）；
  - 样式遵循 DSH 原 UI（CSS Modules、`--dsw-alias-*` token）。

#### 2.2 需求 2B：WallpaperEditor（最小提交点）
- **Agent B**
  - `src/client/components/WallpaperEditor.tsx`：props
    `{ value: Wallpaper, onChange(next), onUpload(file) }`；
  - 区块：图片选择（文件上传按钮 → `onUpload` / URL 输入 / 内置资源下拉）、
    位置切换（全屏/对话区分段）、遮罩颜色 + 透明度滑块（0~1，显示百分比）；
  - 图片预览：当前 image 缩略图（`assetUrl`/`preset:` 解析）；
  - 样式遵循 DSH 原 UI。

#### 2.3 需求 2C：ThemeEditor（最小提交点）
- **Agent C**
  - `src/client/components/ThemeEditor.tsx`：props
    `{ base: Theme | null, initial: CustomTheme | null, onSave(theme), onCancel }`；
  - **编辑会话（内存态）**：本地 state 持有 `ThemeDiffs`，未保存不写 store；
  - 顶栏：方案名（可编辑输入）、保存、取消；
  - 预览区：实时色板（ColorField 变化即更新）+ 壁纸预览（明暗双态切换）；
  - 编辑区：壁纸段（WallpaperEditor）+ 主题色段（按 TOKEN_GROUPS 分组渲染
    ColorField，未修改项显示基底值）；
  - 保存：合成 `CustomTheme`（含 name/diffs）→ `onSave`；
  - 样式遵循 DSH 原 UI。

**提交点 2 完成标准**：typecheck 通过；三组件可独立渲染（临时挂载验证）。

---

### 提交点 3：合成与入口

#### 3.1 需求 3A：service 扩展（最小提交点）
- **Agent A**
  - `src/client/theme/service.ts` 扩展：
    - `beginPreview(diffs: ThemeDiffs): () => void`：用
      `theme.overrideTokens(previewSource, tokens)` + `applyWallpaper` 实时预览；
      每次调用先 dispose 旧预览层（同 source 替换语义）；
    - `applyCustomTheme(theme: CustomTheme | null)`：激活用户层——
      基底（basePresetId 预置层或 shell 默认）+ 用户差异（overrideTokens 固定
      source `dsh-customization-settings.custom` + 壁纸变量）；
    - `resolveActive()`：合并预置偏好与 activeCustomThemeId，返回当前生效描述
      （预置 id / custom id / system），供 UI 高亮与恢复默认（M3 用）；
    - 预览层与用户层互斥：预览期间暂挂用户层，取消/保存后恢复。

#### 3.2 需求 3B：入口接线（最小提交点）
- **Agent B**
  - `PresetGrid.tsx`：每张卡片加「自定义」按钮 → `onCustomize(preset)`（继承
    该预置为基底）；
  - `ThemeSection.tsx`：视图切换（预置主题 | 编辑器），编辑器视图挂
    `ThemeEditor`；`onSave` → store 保存 + service.applyCustomTheme + 返回预置视图；
  - 挂载时若存在 `activeCustomThemeId`，预置视图显示自定义方案为当前项。

**提交点 3 完成标准**：typecheck 通过；从预置进入编辑器、编辑实时预览、
保存后刷新保持（settings.yaml 有 customThemes 段且应用生效）。

---

### 提交点 4：集成收尾（线性）

- `src/client/index.ts`：组装 store/service/编辑器视图，disposer 全挂 fiber；
- `pnpm typecheck` + `pnpm build`；
- 验收（架构 §7.5 前 4 项）：
  - [ ] 从任一预置可进入编辑器，修改壁纸图片/位置/遮罩与品牌色后全 UI 实时变化
  - [ ] light/dark 分别编辑正确；保存后刷新保持
  - [ ] 可新建/保存/切换方案（重命名/删除由 M3 的 SchemeList 交付）
  - [ ] 壁纸上传在刷新/重启后仍可用（宿主侧资产持久化）
- 本提交点 commit。

---

## 6. M2 Checklist

- [ ] `settings.ts`：customThemes/activeCustomThemeId 入 schema（旧数据兼容）
- [ ] `spec.ts`：CustomTheme/ThemeDiffs + validateCustomTheme
- [ ] `store.ts`：CRUD + active id 读写（settingsScope 字段级）
- [ ] 宿主：webServer 资产路由 POST/GET，文件落 `storages/dsh-customization-settings/assets/`
- [ ] `assets.ts`：uploadWallpaper / assetUrl
- [ ] `ColorField.tsx` / `WallpaperEditor.tsx` / `ThemeEditor.tsx` 齐备且符合 DSH UI 风格
- [ ] `service.ts`：预览层 + 用户层 + resolveActive，disposer 全清理
- [ ] PresetGrid 自定义按钮 + ThemeSection 视图切换
- [ ] `pnpm typecheck` / `pnpm build` 通过
- [ ] §5 验收项全部通过
- [ ] 各提交点已按约定式提交（feature/theme，不 push）
