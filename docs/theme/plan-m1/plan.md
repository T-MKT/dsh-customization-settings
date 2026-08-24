# Theme 主题系统 · 编码计划（plan.md）

> 依据：`docs/theme/theme-architecture.md`（功能架构）。
> 目标：**M1（L1 预置主题）** 落地为可运行的代码：预置主题库 + 壁纸渲染层 +
> settings 持久化 + 「外观」设置分区完整页面。
> 约束：遵循 AGENTS.md（分支、最小提交点、单层并行、DSH 原 UI 风格）。
> 当前分支：`feature/theme`（禁止 main）。

---

## 1. 编码目标（M1 范围）

在 `src/` 内实现架构文档 §6（L1 预置主题）+ §5 共享底座的可运行子集：

| 模块 | 职责 | 架构章节 |
|---|---|---|
| `src/client/theme/tokens.ts` | token 映射表（13 项，单一事实来源） | §5.1 |
| `src/client/theme/wallpaper.ts` | 壁纸类型 + CSS 变量渲染层 | §5.2/§5.3 |
| `src/client/theme/spec.ts` | Theme/Wallpaper/TokenSet 类型 + 校验 | §3 |
| `src/client/theme/presets.ts` | 预置主题常量（色板 + 壁纸） | §6 |
| `src/client/theme/store.ts` | ThemeStore（settings scope，仅 activeThemeId） | §5.4 |
| `src/client/theme/service.ts` | 应用主题：register + 壁纸层 + 高亮状态 | §5.6/§5.7 |
| `src/client/components/ThemeSection.tsx` | 外观分区正文 + 视图切换 | §5.5/§5.6 |
| `src/client/components/PresetGrid.tsx` | 预置卡片网格 + 跟随系统项 | §5.5/§5.6 |
| `src/client/index.ts` | apply：注册分区 + 订阅 theme/change + 组装 | §5.6.3 |
| `src/index.ts`（宿主） | 注册 settings namespace（activeThemeId） | §5.4 |

**M1 不做**（后续 M2/M3）：壁纸图片上传/资产路由、自定义方案 CRUD、
编辑器、导出导入。

---

## 2. 依赖与接口基线（已调研确认）

- 宿主 `settings` 服务：`register<T>(ns, schema, opts)` → `SettingsScope<T>`，
  scope 有 `get()/update()/replace()/mutate()`；落盘 `$DSH_HOME/settings.yaml`。
- 客户端 `ctx.settingsScope`（`@deepseek-ai/dsh-client-ui-settings` 提供）：
  `bind<T>(spec)` → `SettingsScope<T>`，scope 有 `getSnapshot()/subscribe()/set()/unset()`。
- 客户端 `ctx.theme`：`getTheme()/setTheme(id)/register(def)/overrideTokens(source, tokens)`；
  事件 `theme/change`（snapshot 载荷）。
- schema 类型：`@deepseek-ai/schemastery`（peer，宿主与客户端通用）。
- 参考实现：`ui-theme` 的 `ThemeSettingsSchema`（`z.object({ preference: ... })` +
  常量 `SETTINGS_NS`），`GeneralSection` 的 CSS Modules 风格。
- 浏览器半依赖：`slots` + `settingsScope` + `theme`（inject）。

---

## 3. 编码结构（src 目录树，最终形态）

```
src/
├── index.ts                      # 宿主：注册 settings namespace
├── client/
│   ├── index.ts                  # apply：注册分区 + 订阅 + 组装
│   ├── theme/
│   │   ├── tokens.ts             # token 映射表
│   │   ├── wallpaper.ts          # 壁纸类型 + 渲染层
│   │   ├── spec.ts               # Theme 模型 + 校验
│   │   ├── presets.ts            # 预置主题常量
│   │   ├── store.ts              # ThemeStore（settings scope）
│   │   └── service.ts            # 应用主题服务
│   └── components/
│       ├── ThemeSection.tsx      # 分区正文 + 视图切换
│       ├── PresetGrid.tsx        # 卡片网格
│       ├── ThemeSection.module.css
│       └── PresetGrid.module.css
```

---

## 4. 进度（最小提交点序列，线性主干 + 单层并行）

```
M1
├── 提交点 1：工程准备（依赖声明 + tsdown externals + 宿主 namespace 注册）
│   （线性）
├── 提交点 2：数据与逻辑层（并联）
│   ├── Agent A：tokens.ts + spec.ts
│   ├── Agent B：wallpaper.ts（渲染层）
│   └── Agent C：presets.ts（预置配色 + 壁纸）
├── 提交点 3：状态与合成层（并联）
│   ├── Agent D：store.ts（settings scope 封装）
│   └── Agent E：service.ts（register + 壁纸 + 高亮）
├── 提交点 4：UI 层（并联）
│   ├── Agent F：ThemeSection.tsx + 样式
│   └── Agent G：PresetGrid.tsx + 样式
└── 提交点 5：集成收尾（线性）
    └── typecheck + build + 验收 checklist + commit
```

每个提交点为一次 commit（不 push）；单层并行、节点处汇合。

---

## 5. 分文档索引

| 文件 | 内容 |
|---|---|
| `plan.md` | 本主干 |
| `1/1.1.md` | 提交点 1：工程准备 |
| `2/2.1.md` | 提交点 2：数据与逻辑层（Agent A/B/C） |
| `3/3.1.md` | 提交点 3：状态与合成层（Agent D/E） |
| `4/4.1.md` | 提交点 4：UI 层（Agent F/G） |
| `5/5.1.md` | 提交点 5：集成收尾 |

> 按 AGENTS.md 分文档原则：各子文档只含**本层最小提交点序列**，
> 交叉引用主干即可。
