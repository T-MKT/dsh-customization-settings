# CSS 变量引用查询结果

> 用途：本文件记录 DSH CSS 变量（`--dsw-*`）被哪些 UI 元素引用。
> 查询范围：DSH 各 `dsh-client-ui-*` 包（lib/client.js 内嵌 CSS 规则）、`dsh-web-frontend/dist/assets/*.css`、
> 以及本插件 `dsh-customization-settings/src`。
> 生成时间：本次会话查询（8 个变量，5 个并行子代理汇总）。
> 说明：`定义(默认值)` 指主题注入的默认值（light/dark）；`引用元素` 指真正消费该变量的 CSS 规则；
> hashed 类名后的下划线后缀（如 `_frame`）为可读的元素语义。

---

## 0. --dsw-alias-bg-base

- **定义(默认值)**: light `var(--dsw-static-neutral-bluish-00)` = `#fff` / dark `var(--dsw-static-neutral-bluish-950)` = `#151517`（来源: dsh-client-ui-theme/lib/client.js 中 `body{...}` 与 `body[data-ds-dark-theme]{...}`；web CSS 无 `--dsw-alias-bg-base:` 定义）

- **引用元素**（每行一条去重规则）:

| 来源包 | 选择器 | 属性 | 用途 |
|---|---|---|---|
| layout | .pI_x6G_frame | background | 主界面框架背景 |
| conversation | .wSkVaW_root | background | 对话区根背景 |
| conversation | .ydkMvW_root | background | 详情区根背景 |
| conversation | ._7yHdaG_editor | background | 消息编辑器输入框背景 |
| conversation | .wSkVaW_root[data-phase=active] .wSkVaW_composerSeat | background(gradient) | 输入区吸底渐隐带(0%透明→36px bg-base) |
| conversation | .QWLzlG_root[data-state=running] .QWLzlG_row:after | background(gradient) | 推理行 running 扫光高亮(color-mix 60%) |
| conversation | ._Xvjua_root[data-state=running] ._Xvjua_row:after | background(gradient) | 命令行 running 扫光高亮(color-mix 60%) |
| skill | .iWrAna_card[data-state=running] .iWrAna_row:after | background(gradient) | 技能行 running 扫光高亮(color-mix 60%) |
| skill | .iWrAna_inspectButton | background | inspect 按钮胶囊背景 |
| tool | .o3BgMG_root[data-state=running] .o3BgMG_row:after | background(gradient) | 工具行 running 扫光高亮(color-mix 60%) |
| tool | .o3BgMG_inspectButton | background | inspect 按钮胶囊背景 |
| tool | .CY-8Ka_root[data-state=running]:after | background(gradient) | bash 工具行 running 扫光高亮(color-mix 60%) |
| tool | .CY-8Ka_inspectButton | background | bash inspect 按钮胶囊背景 |
| cordis | .cvtE3a_business | background | 插件业务卡片背景 |
| cordis | .gNWCoW_inspectButton | background | inspect 按钮胶囊背景 |
| goal | .nLMEza_objectiveInput | background | 目标输入框背景 |
| trajectory | .Y0dWHa_panelImage | background | 轨迹面板图片占位背景 |
| trajectory | .Y0dWHa_toolCatalogDefinition | background | 轨迹工具目录定义块背景 |
| web-frontend | body | background | 页面 body 背景(var + fallback #fff) |
| web-frontend | ._boot_1ionb_3 | background | 启动屏背景(var + fallback --dsh-boot-bg) |
| web-frontend | ._bannerWrap_178r4_21 | background-color | 代码块顶部横幅背景 |
| web-frontend | ._image_1r4m5_268 | background | 图片显示块背景 |

- **本插件(src)使用**:
  - **定义/覆盖**: `src/client/theme/presets.ts:95` — `'dsw-alias-bg-base': { light: light.bgBase, dark: dark.bgBase }`，各预设值如 #eef4fc/#0b1220、#f2f8f2/#12240f、#fbf7f2/#211812、#f4f5f7/#141619；`src/client/theme/tokens.ts:16,39` — 令牌注册(键/cssVar/标签"基础背景")；`src/client/theme/spec.ts:25` — 仅注释
  - **元素使用**: `src/client/theme/wallpaper.ts:248` — 壁纸遮罩层 inline `mask.style.background='var(--dsw-alias-bg-base)'`；`WallpaperEditor.module.css:37` `.thumbnail::after`、`ThemeEditor.module.css:160` `.previewThumb::after`、`PresetGrid.module.css:129` `.thumbnail::after` — 三个预览缩略图遮罩背景；`ThemeEditor.tsx:69` / `PresetGrid.tsx:46` — 色板条 swatch token key 引用（取当前值展示）
  - **回退链(非直接覆盖)**: `src/client/theme/wallpaper.ts:136` — `[data-slot="conversation"] > *,[data-slot="details"] > * { background: var(--cst-surface-bg, var(--dsw-alias-bg-base)) !important }`，该 token 仅作插件自有变量 `--cst-surface-bg` 的回退值，token 本身不动

- **注意**:
  - 全部引用均在各 bundle 的 CSS 模板字符串内，未发现 inline style 引用
  - 链式/渐变值用法: composerSeat 渐变与三处 running 扫光把该 var 作为 `color-mix(in srgb, var(--dsw-alias-bg-base) X%, transparent)` 的输入（渐隐/高亮效果），非直接 background 填充
  - web CSS 的 `body`/`._boot_1ionb_3` 是带 fallback 的引用（`var(--dsw-alias-bg-base, ...)`），不是定义
  - dsh-client-ui-theme 只定义该 token，未将其用作其它 token 的值；vendor css 无引用

---

## 1. --dsw-alias-bg-module-platform

- **定义(默认值)**: light `var(--dsw-static-neutral-bluish-60)` → `#f5f6f7`（静态 token 另一副本为 `#f9fafb`）/ dark `var(--dsw-static-neutral-bluish-800)` → `#353638`（均出自 `dsh-client-ui-theme/lib/client.js` 的 `body {…}` 与 `body[data-ds-dark-theme] {…}` 块；web-frontend CSS 中无任何定义或引用）
- **引用元素**（全部为 `background` 引用；无 fallback、无其他 token 定义引用该变量）：

| 来源包 | 选择器(hashed class + 后缀) | 属性 | 元素用途简述 |
|---|---|---|---|
| agent-preset / conversation / permission-presets（3 包同一规则，仅 hash 前缀不同） | `_5QVD0a_selector` / `T1PP_q_selector` / `oY77xG_selector` | background | 36px 圆角(18px) 胶囊选择器/触发器（inline-flex, gap 12, 标签色 label-primary） |
| model-selection | `_7KE1Ra_warning` | background | 警告态元素（配 state-warn-label 前景色） |
| settings-models | `zGbnIq_addCard` / `zGbnIq_setupCard` / `zGbnIq_editor` | background | 添加/设置卡片与编辑器面板（radius 12, column, gap 14, padding 14/16） |
| settings-plugin-inventory | `qSYn7G_cardDetails` | background | 插件卡片详情区（border-top: border-l2, padding 10/14/12） |
| settings-plugins | `At1oFq_badge`（`YyYd_a_pending` 同规则另加 `flex:none`） | background | 999px 胶囊徽标 / 待定(pending)状态徽标（11px, label-secondary） |
| theme | `_8HJdBW_selected` | background | 主题色板选中项（border-color: static-neutral-bluish-400） |
| trajectory | `Y0dWHa_compacted` / `Y0dWHa_systemNeutral`（同规则） | background | 轨迹折叠消息 / 系统中性消息元信息行（label-secondary） |
| trajectory | `Y0dWHa_promptDiffLinemeta` | background | prompt diff 行元信息（label-caption, user-select:none） |
| trajectory | `Y0dWHa_turnLabel` | background | 回合标签角标（8px 代码字体, 绝对定位左上, label-tertiary） |
| user-questions | `Mbwy4a_customBlock` | background | 自定义问答块（border-l2 描边, radius 10, min-height 64；同规则内另定义本地变量 `--dsh-answer-field-padding`） |
| workflow-run | `DBuyfa_runHeader` | background | 工作流运行头部栏（32px, radius 8, flex） |

- **本插件(src)使用**：`src/client/theme/*.ts` 中**无**该变量（无定义/覆盖）；组件内 5 处元素引用，均为激活/选中态 `background`：

| 文件 | 选择器 | 属性 | 用途 |
|---|---|---|---|
| src/client/components/WallpaperEditor.module.css:190 | `.segmentActive, .segmentActive:hover` | background | 壁纸编辑器分段控件选中态（品牌色描边+模块背景） |
| src/client/components/ThemeSection.module.css:77 | `.segmentActive, .segmentActive:hover` | background | 主题区分段控件选中态（同上） |
| src/client/components/SchemeList.module.css:41 | `.rowActive, .rowActive:hover` | background | 配色方案列表激活行（label-primary 描边） |
| src/client/components/ThemeEditor.module.css:221 | `.segmentActive, .segmentActive:hover` | background | 主题编辑器分段控件选中态（品牌色描边） |
| src/client/components/PresetGrid.module.css:69 | `.cardActive, .cardActive:hover` | background | 预设卡片激活态（label-primary 描边） |

- **注意**: 所有出现处均为 `background` 属性值引用（`grep -l 'var(--dsw-alias-bg-module-platform)'` 仅命中 `background:` 声明，无 fallback、无嵌套 token 定义）；web-frontend CSS（index/vendor）完全不含该 token；light/dark 定义仅存在于 `dsh-client-ui-theme/lib/client.js` 两个 `body` 块。

---

## 2. --dsw-alias-button-elevated-fill

- **定义(默认值)**: light `var(--dsw-static-neutral-bluish-00)` | dark `var(--dsw-static-neutral-bluish-750)`（无硬编码 hex，均为静态 token 引用）
- **引用元素**（合并去重后共 2 条规则）:
  - dsh-client-ui-sidebar | `.hHd-Xa_newSession` | background | 侧边栏"新建会话"按钮（38px 高、12px 圆角）
  - dsh-client-ui-workspace | `.YDXeBa_renameInput` | background | 工作区重命名输入框（内联编辑，4px 圆角）
- **定义包**: dsh-client-ui-theme 仅在 `body`/`body[data-ds-dark-theme]` 的 token 块中定义，无自身元素消费
- **本插件(src)使用**: 无（src 下无任何匹配，含松散子串 alias-button-elevated/button-elevated-fill）
- **注意**: web-frontend CSS 中 0 处引用（变量只存在于 client-ui bundle 内嵌样式）；该 token 本质是"悬浮/抬升表面色"——浅色近白、深色中性灰

---

## 3. --dsw-specific-input-major

- **定义(默认值)**: light `var(--dsw-static-neutral-bluish-00)` | dark `var(--dsw-static-neutral-bluish-850)`（无硬编码 hex）
- **引用元素**（合并去重后共 7 条规则, 全部为 background）:
  - dsh-client-ui-attachment | `.JVDQca_arrow` | background | 附件灯箱导航箭头（24px 圆形，绝对定位 top:50%）
  - dsh-client-ui-attachment | `.fNh4Da_close` | background | 附件灯箱关闭按钮（36px 圆形，fixed 右上角）
  - dsh-client-ui-attachment | `.fNh4Da_image` | background | 附件灯箱图片容器（object-fit:contain）
  - dsh-client-ui-conversation | `.bqrRRG_card` | background | 会话内警示卡片（warn-secondary 边框，20px 圆角）
  - dsh-client-ui-conversation | `.uV2eYG_card` | background | 会话 composer 输入卡片（22px 圆角，flex 纵向）
  - dsh-client-ui-user-questions | `.LVzXQa_card` | background | 用户提问卡片（warn-secondary 边框，max-height 60vh）
  - dsh-client-ui-user-questions | `.Mbwy4a_card` | background | 用户提问卡片（l2 边框变体）
- **本插件(src)使用**: 无（src 下无任何匹配，含松散子串 specific-input-major/input-major）
- **注意**: web-frontend CSS 中 0 处引用；该 token 是"主要输入表面色"，语义 = 输入区/弹层卡片背景，被附件灯箱（arrow/close/image）、composer 卡片、提问卡片共享；修改它会影响灯箱与输入卡片背景

---

## 4. --dsw-alias-button-info-fill

- **定义(默认值)**: theme `dsh-client-ui-theme/lib/client.js:124` — light `body{}` = `var(--dsw-static-deepseek-500)` (#4176e6)；dark `body[data-ds-dark-theme]{}` = `var(--dsw-static-deepseek-400)` (#679efe)；dsh-web-frontend CSS 无定义
- **引用元素**（去重后 4 条规则）:
  - `dsh-client-ui-conversation` | `.gdEzaW_retrySummary:focus-visible` | `outline:1.5px solid var(--dsw-alias-button-info-fill); outline-offset:2px` | 消息重试 `<details>` summary 的键盘聚焦外轮廓
  - `dsh-client-ui-conversation` | `.uV2eYG_primary` | `background:var(--dsw-alias-button-info-fill); color:#fff; border-radius:999px; width:34px; height:34px; transform:translateY(-2px)` | select 组件内 34px 圆形主按钮（白字, 悬浮确认/箭头）
  - `dsh-client-ui-directory-picker-browse` | `.ZuhsRW_rowIconSelected` | `color:var(--dsw-alias-button-info-fill); flex:none` | 目录浏览弹窗中选中行的图标颜色
  - `dsh-client-ui-user-questions` | `.Mbwy4a_badge` | `color:var(--dsw-alias-button-info-fill)`（bg 用 `--dsw-specific-sidebar-nav-item-active-accent`）| 选项旁数字徽标的文字色
- **本插件(src)使用**: 无（`src/` 下未出现该变量，grep 无命中）
- **注意**: 无 fallback；为 alias 语义色（品牌蓝 400/500），直接 var 引用；theme 包本身只定义不消费

---

## 5. --dsw-specific-bubble

- **定义(默认值)**: theme `dsh-client-ui-theme/lib/client.js:124` — light `body{}` = `var(--dsw-static-deepseek-50)` (#edf3fe)；dark `body[data-ds-dark-theme]{}` = `var(--dsw-static-neutral-bluish-850)` (#2c2c2e)；dsh-web-frontend CSS 无定义
- **引用元素**（去重后 2 条规则）:
  - `dsh-client-ui-conversation` | `.gdEzaW_bubble` | `background:var(--dsw-specific-bubble); max-width:100%; color:var(--dsw-alias-label-primary); border-radius:22px; padding:10px 16px; font-size:16px; line-height:24px` | **用户消息气泡背景**（`_userStack` 右对齐 flex 容器内）
  - `dsh-client-ui-goal` | `.oRe1gG_bubble` | `background:var(--dsw-specific-bubble); font:var(--dsw-font-markdown-code); white-space:pre-wrap; border-radius:22px; padding:10px 16px` | goal 面板中代码样式气泡（等宽字体、pre-wrap），同样右对齐
- **本插件(src)使用**: 无（`src/` 下未出现该变量，grep 无命中）
- **注意**: 无 fallback；气泡形状（border-radius/padding）两处一致，仅字体不同；存在兄弟 token `--dsw-specific-bubble-highlight`（light=deepseek-200 / dark=neutral-bluish-750）可作高亮配套色

---

## 6. --dsw-alias-state-business-primary

- **定义(默认值)**: 由 `dsh-client-ui-theme` 在 `body` 上定义 — light: `var(--dsw-static-deepseek-500)` = `#4176e6`; dark(`body[data-ds-dark-theme]`): `var(--dsw-static-deepseek-400)` = `#679efe`。web-frontend CSS 仅引用、无定义。

- **引用元素**（每行一条去重规则）:
  | 来源包 | 选择器 | 属性 | 用途 |
  |---|---|---|---|
  | conversation | `._7yHdaG_editor:focus` | border-color | 内联输入编辑器 focus 边框 |
  | conversation | `.gdEzaW_refChip` | color | 引用 chip 文字 |
  | conversation | `.lXshSW_glyphProgress` | color | glyph 引用区进度旋转动画颜色 |
  | conversation | `.uV2eYG_cardWorkspaceTrigger:hover:after` | background | 插入 workspace 卡片 trigger hover 下划线 |
  | conversation | `.uV2eYG_chip` / `.uV2eYG_textRef` | color | 输入区引用 chip / 文本引用着色 |
  | conversation | `.uV2eYG_input` | caret-color | 输入框 caret |
  | conversation | `.uV2eYG_pending` | background | 输入 pending 8px 状态圆点 |
  | conversation | `.wSkVaW_tabActive` + `:after` | color / background | 激活 tab 文字色 + 下划线 |
  | cordis | `.Nqubda_row[data-cordis-awaiting]` | border-color | 待审批(awaiting)插件行边框 |
  | cordis | `.cvtE3a_icon/.cvtE3a_title` | color | 插件列表行图标/标题高亮 |
  | cordis | `.cvtE3a_separator` / `.gNWCoW_separator` | background | 行内 2px 圆点分隔符 |
  | cordis | `.gNWCoW_card .gNWCoW_title,.gNWCoW_card .gNWCoW_chevron` | color | 卡片标题/chevron 高亮 |
  | cordis | `.gNWCoW_sourceTab:focus-visible` | outline | 源码 tab focus 环 |
  | cordis | `.gNWCoW_sourceTabActive` + `:after` | color / background | 源码 tab 激活文字+下划线 |
  | goal | `.nLMEza_objectiveInput:focus` | border-color | 目标编辑输入框 focus 边框 |
  | settings-plugin-inventory | `.qSYn7G_cardContent:focus-visible` | outline | 插件卡片 focus 环 |
  | settings-plugin-inventory | `.qSYn7G_search input:focus-visible` | border-color + box-shadow | 搜索框 focus (含 color-mix 18% 光晕) |
  | settings-plugin-inventory | `.qSYn7G_statusDot[data-phase=loading]` | background | 状态圆点 loading 色 |
  | settings-plugins | `.pbvGtq_tab:focus-visible` | outline + color | 设置 tab focus 环 |
  | tool | `.o3BgMG_root[data-tool^=cordis_] .o3BgMG_leading, .o3BgMG_title` | color | cordis_ 工具卡片图标+标题高亮 |
  | tool | `.o3BgMG_root[data-tool^=cordis_] .o3BgMG_sep` | background | cordis_ 工具卡片分隔符 |
  | trajectory | `.Y0dWHa_*:focus-visible`（assistantToolCallButton/close/detailTab/historyLoadButton/overviewTitle/overviewHierarchyNavLink/thinkingToggle/timestampToggle/toolCatalogSummary/_track/_action/_control/_toggle/fV0t5q） | outline | 轨迹各控件 focus 环 |
  | trajectory | `.Y0dWHa_detailTabActive` + `:after` | color / background | 详情页激活 tab 文字+下划线 |
  | trajectory | `.Y0dWHa_historyLoadingSpinner` | border-top-color | 历史加载 spinner |
  | trajectory | `.Y0dWHa_overviewTitle:focus-visible .Y0dWHa_overviewTitleIcon` / `.sourceBlockJumpTarget ...JumpIcon` | color | focus 时图标高亮 |
  | trajectory | `.Y0dWHa_table tbody tr:focus-visible`（含 collapsed-summary 两态） | box-shadow inset | 表格行 focus 环 |
  | trajectory | `.Y0dWHa_user` | color | 用户消息文本色 (bg 用 tertiary) |
  | trajectory | `.fV0t5q_search:focus-within` | border-color | 搜索框 focus 边框 |
  | trajectory | `.fV0t5q_controlTrack[data-on=true]` | background | 开关 track 开启色 |
  | trajectory | `._1p9O6q_hoverLine` | background | 时间轴 hover 竖线 |
  | trajectory | `._1p9O6q_selection` | background color-mix 12% | 时间轴选区淡色底 |
  | trajectory | `._1p9O6q_selection[data-dragging=true]` | background color-mix 18% | 选区拖拽中加深 |
  | trajectory | `._1p9O6q_selectionEdges:before/:after` | background | 选区边缘 3px 竖条 |
  | trajectory | `._1p9O6q_span[data-timeline-span=user]` | background | 时间轴 user 跨度条 |
  | trajectory | `._1p9O6q_span[data-current=true]` | box-shadow 2px | 当前跨度外环 |
  | trajectory | `._1p9O6q_span[data-hovered=true]:not([data-current=true])` | box-shadow color-mix 80% | hover 跨度外环 |
  | user-questions | `.Mbwy4a_customBlock:focus-within` | border-color | 自定义问题块 focus 边框 |
  | user-questions | `.Mbwy4a_fieldInput` | caret-color | 问题输入框 caret |
  | workflow-run | `.DBuyfa_memberButton .DBuyfa_memberLabel` | color + underline | 成员按钮标签下划线文字 |
  | workflow-run | `.DBuyfa_memberButton:focus-visible .DBuyfa_memberLabelWrap` / `.phaseHeader:focus-visible` / `.runHeader:focus-visible` | outline | 成员/阶段头/运行头 focus 环 |
  | workspace | `.YDXeBa_folderActive` | color | 文件夹激活文字色 |
  | workspace | `.YDXeBa_sessionRow.YDXeBa_dropBefore:before, .dropAfter:after` | background (3×) | 会话行拖拽放置 zigzag 指示线 |
  | workspace | `.qDHVXG_listTopDropIndicator, .workspaceDropBefore:before, .workspaceDropAfter:after` | background (3×) | 列表顶部/workspace 拖拽放置指示线 |
  | web-frontend (index css) | `._copyable_1b2ny_25:focus-visible` / `._copyButton_4qrvp_143:focus-visible` | outline | 复制文本/复制按钮 focus 环 |
  | web-frontend | `._markdown_1r4m5_5 a` | color | markdown 链接色 |
  | web-frontend | `._markdown_1r4m5_5 a:focus` / `a:focus-visible` / `._tableScroll_1r4m5_174:focus-visible` | text-decoration / box-shadow | 链接 focus 下划线/光环 |
  | web-frontend | `._fileMention_1r4m5_288` | color | 文件提及按钮文字 |
  | web-frontend | `._sourceLink_d4nqi_60` / `._fetchUrl_d4nqi_103` | color | 引用来源链接 / fetch URL 文字 |

- **本插件(src)使用**: 无。`src/client/theme/tokens.ts` 只列了 state-error/success/warn-primary 等，不含 business 系；`appearanceEntryLink.ts` 直接用 `var(--dsw-static-deepseek-450)`。

- **注意**: 纯"品牌/操作强调色"角色——大量用于 focus-visible 外环、激活 tab、输入框 caret、拖拽/时间轴指示，常配 `color-mix(...x%, transparent)` 做淡色底（12%/18%/80%）；无其他 token 以它为值；web-frontend 与各 client-ui 包均只消费、不定义，运行时依赖 theme 包注入。

---

## 7. --dsw-alias-state-business-tertiary

- **定义(默认值)**: `dsh-client-ui-theme` — light: `var(--dsw-static-deepseek-100)` = `#e4edfd`; dark: `var(--dsw-static-deepseek-800)` = `#34415b`。web-frontend CSS 无引用。

- **引用元素**:
  | 来源包 | 选择器 | 属性 | 用途 |
  |---|---|---|---|
  | conversation | `.pXSMma_previewBadge` | background | 消息预览徽标浅色底 (border-radius 24px 药丸) |
  | trajectory | `.Y0dWHa_user` | background | 用户消息浅色背景 (文字用 primary) |
  | theme | `body` / `body[data-ds-dark-theme]` | 定义 (--dsw-alias-state-business-tertiary:) | 主题默认值，非元素引用 |

- **本插件(src)使用**: 无。

- **注意**: 弱语义的"business 浅色底"，全仓仅 2 处元素消费（conversation 预览徽标、trajectory 用户消息背景），均与 primary 成对使用；无 fallback、未被其他 token 引用。
