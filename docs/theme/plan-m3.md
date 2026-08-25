# Theme 主题系统 · 编码计划 M3（plan-m3.md）

> 依据：`docs/theme/theme-architecture.md` §7（L3 收尾）+ §5.4 存储。
> 前置：M2 已交付（壁纸 + 主题色编辑器、方案保存、资产通道）。
> 目标：**方案管理与数据交换**——「我的主题」列表、导出/导入 JSON、
> 恢复默认（单维度/整方案/回默认），完成 L3 全量验收。
> 约束：遵循 AGENTS.md（分支、提交点、单层并行、DSH 原 UI 风格）。
> 当前分支：`feature/theme`（严禁 main）。

---

## 1. 需求（M3 范围）

| 编号 | 需求 | 架构章节 |
|---|---|---|
| M3-R1 | 方案列表：SchemeList（我的主题视图）——新建/复制/重命名/删除/设为当前 | §7.3 |
| M3-R2 | 导出/导入 JSON：Theme 序列化、schema 校验与版本迁移、asset 引用重建 | §7.4 |
| M3-R3 | 恢复默认：单维度（壁纸/单颜色）/ 整方案 / 一键回 shell 默认 | §7.1 L3-F8 |
| M3-R4 | 三视图完整接线：预置主题 \| 我的主题 \| 编辑器 | §7.3 |
| M3-R5 | L3 全量验收（架构 §7.5） | §7.5 |

**M3 不做**：字体 token、明暗推导算法、壁纸分享链接（列为可选增强）。

---

## 2. 代码结构（M3 增量）

```
src/
├── client/
│   ├── theme/
│   │   ├── spec.ts               # （扩展）导入导出：serializeTheme/parseTheme + 版本迁移
│   │   ├── store.ts              # （扩展）duplicateTheme/renameTheme（或经 CRUD 组合）
│   │   └── service.ts            # （扩展）resetDefault/resetScheme/resetDimension
│   └── components/
│       ├── SchemeList.tsx        # （新增）我的主题列表
│       ├── ThemeEditor.tsx       # （扩展）恢复默认入口（单维度/整方案）
│       ├── ThemeSection.tsx      # （扩展）三视图接线 + 导入入口
│       └── *.module.css          # （新增/扩展）
```

---

## 3. 关键接口基线（已调研）

- **导出格式**（架构 §3.2 Theme 序列化，含 `schemaVersion`）：

```json
{
  "schemaVersion": 1,
  "name": "我的森林",
  "basePresetId": "preset.forest",
  "wallpaper": { "image": "asset:<id> | preset:<key> | URL | null", "placement": "fullscreen", "maskColor": "#000000", "maskOpacity": 0.4 },
  "tokenSet": { "colorScheme": "dual", "tokens": { "brand-primary": { "light": "#...", "dark": "#..." } } }
}
```

- **导入迁移**：`parseTheme(json)` 校验 `schemaVersion`（当前仅 v1，未知版本拒绝）；
  `asset:` 引用随导出为相对 id，导入时若资产不存在 → 报错并拒绝整单（不部分落盘）。
- **恢复默认**：
  - 单维度：`service.resetDimension(theme, 'wallpaper' | tokenKey)`——清 diffs 对应字段；
  - 整方案：`store.removeCustomTheme(id)` 或 `saveCustomTheme(全空 diffs)`；
  - 回默认：`theme.setTheme(默认)` + 壁纸置空 + `setActiveCustomThemeId(null)`。
- 列表操作基于 M2 的 store CRUD；复制 = `createCustomTheme` + 拷贝 diffs + 新 id。

---

## 4. 进度（提交点序列）

```
M3
├── 提交点 1：方案管理（并联）
│   ├── Agent A：SchemeList 组件（列表 + 操作行）
│   └── Agent B：store/service 扩展（复制/重命名 + 切换激活）
├── 提交点 2：数据交换（并联）
│   ├── Agent A：导出 JSON（序列化 + asset 引用化）
│   └── Agent B：导入 JSON（校验 + 版本迁移 + asset 校验）
├── 提交点 3：恢复默认与视图接线（并联）
│   ├── Agent A：恢复默认（单维度/整方案/回默认）
│   └── Agent B：ThemeSection 三视图接线 + 导入入口
└── 提交点 4：集成收尾（线性）
    └── index.ts 组装 + typecheck/build + L3 全量验收（§7.5）
```

每个提交点为一次 commit（约定式提交，注明完成的 plan 章节；不 push）。

---

## 5. 提交点明细

### 提交点 1：方案管理

#### 1.1 需求 1A：SchemeList 组件（最小提交点）
- **Agent A**
  - `src/client/components/SchemeList.tsx`：props
    `{ schemes, activeId, onActivate(id), onEdit(id), onDuplicate(id), onRename(id, name), onDelete(id) }`；
  - 渲染：方案列表（名称 + 基底徽标 basePresetId + 当前标记）、
    每项操作行（设为当前 / 编辑 / 复制 / 重命名 / 删除，内联确认删除）；
  - 「新建」按钮：从默认基底（basePresetId null）创建空方案并进入编辑器；
  - 空态：无方案时提示文案 + 新建按钮；
  - 样式遵循 DSH 原 UI（CSS Modules、`--dsw-alias-*` token）。

#### 1.2 需求 1B：store/service 扩展（最小提交点）
- **Agent B**
  - `store.ts` 扩展：
    - `duplicateCustomTheme(id): CustomTheme`——拷贝 diffs + 新 `custom.<uuid>` id
      + 名称追加「副本」；
    - `renameCustomTheme(id, name)`——经 saveCustomTheme 组合（读-改-写，保持 revision）；
  - `service.ts` 扩展：
    - `activateScheme(id | null)`——`setActiveCustomThemeId` + 应用用户层（M2 3A
      已有 applyCustomTheme，此处接列表切换）；
    - `deleteScheme(id)`——若为当前激活则同时 `setActiveCustomThemeId(null)`
      并回退到预置/默认。

**提交点 1 完成标准**：typecheck 通过；列表增删改查与激活切换可用，
删除当前方案后回退无残留。

---

### 提交点 2：数据交换

#### 2.1 需求 2A：导出 JSON（最小提交点）
- **Agent A**
  - `spec.ts` 扩展 `serializeTheme(custom: CustomTheme, base: Theme | null): string`：
    - 合成完整 Theme（基底 + diffs）→ §3 形状 JSON 字符串；
    - `asset:` 引用原样保留（相对 id），`preset:` 与 URL 原样；
    - 文件名建议 `theme-<slug>-<date>.json`（下载触发由调用方决定）。
  - `ThemeEditor` 顶栏「导出」按钮：`serializeTheme` → 浏览器下载
    （Blob + objectURL + a[download]，遵循浏览器侧可用 API）。

#### 2.2 需求 2B：导入 JSON（最小提交点）
- **Agent B**
  - `spec.ts` 扩展 `parseTheme(json: string): CustomTheme`：
    - JSON 解析失败 / `schemaVersion` 非 1 / 结构校验失败 → 抛可读错误；
    - `basePresetId` 必须在 `PRESETS` 中存在（或 null）→ 否则拒绝；
    - `asset:` 引用经宿主资产检查存在（`fetch HEAD` 或资产目录 stat，取简单可行者）→
      不存在则拒绝整单；
    - 输出 `CustomTheme`（新 id `custom.<uuid>`，diffs 由完整值减去基底推导）。
  - `ThemeSection`「我的主题」视图「导入」按钮：文件选择 → `parseTheme` →
    错误 toast/提示 → 成功则 `store.saveCustomTheme` + 进入列表。

**提交点 2 完成标准**：typecheck 通过；导出文件可被本插件重新导入还原；
非法文件（坏 JSON / 版本不符 / 缺失资产）被拒绝且不破坏现有方案。

---

### 提交点 3：恢复默认与视图接线

#### 3.1 需求 3A：恢复默认（最小提交点）
- **Agent A**
  - `service.ts` 扩展：
    - `resetDimension(themeId, 'wallpaper' | TokenKey)`——清 diffs 对应字段并保存；
    - `resetScheme(themeId)`——清空全部 diffs（保留名称与基底）或删除方案（UI 语义取整方案重置）；
    - `resetAll()`——`theme.setTheme(默认)` + 壁纸置空 + `setActiveCustomThemeId(null)`；
  - `ThemeEditor`：每颜色项「恢复该项」、壁纸段「恢复壁纸」、顶栏「整方案重置」；
  - 编辑器内未保存编辑的恢复走内存 diffs，已保存的走 store。

#### 3.2 需求 3B：三视图接线（最小提交点）
- **Agent B**
  - `ThemeSection.tsx`：完整三视图分段切换——预置主题 | 我的主题 | 编辑器；
    - 预置视图：PresetGrid（M1/M2 既有）；
    - 我的主题视图：SchemeList（提交点 1）+ 导入按钮；
    - 编辑器视图：ThemeEditor（M2 既有）+ 导出按钮 + 恢复默认入口；
  - 激活态贯穿：预置/方案/编辑器间切换时高亮与 service.resolveActive 一致；
  - 挂载时若 activeCustomThemeId 存在，默认落「我的主题」并高亮该项。

**提交点 3 完成标准**：typecheck 通过；三视图切换顺畅、状态一致；
单维度/整方案/回默认三种恢复均验证通过。

---

### 提交点 4：集成收尾（线性）

- `src/client/index.ts`：三视图组装 + 导入入口 + disposer 全挂 fiber；
- `pnpm typecheck` + `pnpm build`；
- L3 全量验收（架构 §7.5）：
  - [ ] 从任一预置可进入编辑器，修改壁纸图片/位置/遮罩与品牌色后全 UI 实时变化
  - [ ] light/dark 分别编辑正确；保存后刷新保持
  - [ ] 可新建/复制/重命名/删除多个方案，并随时切换
  - [ ] 壁纸上传在刷新/重启后仍可用（宿主侧资产持久化）
  - [ ] 导出 JSON 后可导入还原（含壁纸引用），非法文件被拒绝且不破坏现有方案
  - [ ] 删除当前方案后回退到预置/默认，无残留覆盖层或壁纸变量
- 更新 README.md 功能清单（主题色 + 壁纸条目）；
- 本提交点 commit。

---

## 6. M3 Checklist

- [ ] `SchemeList.tsx`：列表 + 新建/复制/重命名/删除/设为当前 + 空态
- [ ] `store.ts`：duplicateCustomTheme / renameCustomTheme
- [ ] `service.ts`：activateScheme / deleteScheme / resetDimension / resetScheme / resetAll
- [ ] `spec.ts`：serializeTheme / parseTheme（版本校验 + asset 校验）
- [ ] 导出下载可用；导入还原可用且非法文件安全拒绝
- [ ] ThemeSection 三视图完整接线，激活态一致
- [ ] 恢复默认三种粒度均可用
- [ ] `pnpm typecheck` / `pnpm build` 通过
- [ ] §7.5 全部验收项通过
- [ ] README 功能清单已更新
- [ ] 各提交点已按约定式提交（feature/theme，不 push）
