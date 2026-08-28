# AGENTS.md

## MOST IMPORTANT: 任何时候均要遵循的

### Git 控制
**时刻注意，对工作区做任何改动前，检查当前分支。严禁在 `main` 分支上进行修改！**
如果没有可用 `feature/*` 分支，请先**停下来**通知我，不要自己建分支。

不要替我 commit 代码，除非我在提示词中或者 plan 中允许。

若 commit，**不要帮我 push 代码**。

Do not submit vague AI-generated commit/PR text. The human author must understand the change well enough to explain the code, edge cases, and why the approach fits this repository.

## Working Principles

- Think from first principles. Start from real requirements, code facts, and verification results; if the goal is unclear, discuss it with the user first.
- Treat code, better than documentation, as the source of truth.
- Before making code changes, read the relevant code and the most recent constraints, and follow the nearest `AGENTS.md` in the directory tree.
- Keep changes focused. Do not slip in unrelated refactors along the way.

## 本项目介绍
名称：DSH-Customization-Settings
这是一个通用 UI 自定义设置插件，为 DeepSeek Harness 提供自定义壁纸、主题色、字体等 UI 个性化设置，以及模糊材质，还包含任务终端与完成时的通知。

### 主题
对于主题色、字体、模糊材质等静态样式的修改，由于内置的 `ctx.theme` 功能受限，故全部采用 CSS 变量覆盖实现。
注意：对于颜色变量，都需准备 **light 和 dark** 两套。

### 创建新的界面时
当你在 web 页面写新的 UI 界面时，请尽量按照 DSH 原有的 UI 组件编写。

### 模糊材质
核心使用 `backdrop-filter` 滤镜，以及适当的 `saturate` 饱和度增益。
注意：当模糊材质背后的背景是动态的时候，根据实测，尽量不要将模糊半径设置超过 8px，否则会导致闪烁。
模糊材质配套的半透明背景颜色，不要直接修改原有的 CSS 变量（例如禁止直接修改 bg-base 变量），应新建一个 CSS 变量，名称可使用原来的使用的变量加上 `-blur` 后缀。




## plan 流程规划

### What & Why Plan
plan 是编程前，对编写代码结构及进度的规划。与 plan 之前做的规划不同的是，前面的规划通常指向业务功能，不直接关联代码或对代码进行宏观设计，可能有多层；而 plan 描述的是**代码结构及编写的进度**，plan 一旦编写并确定后，下一步即**直接**根据 plan 进行编程。
注意，既包含结构，也包含开发进度。

### How to plan

首先，再次明确需求，清晰地设计代码结构。

#### 并行处理
你作为可调用多 subagent 以并行处理任务的智能体，设计代码结构时，在保证需求实现的前提下，可将进度设计为“并联”的。
该并行为**单层并行**，即主干仍为线性流程，仅在线性流程的最小节点处，分设并行处理。

可并行处理时，必须在代码里明确并行角色。使用 **`Agent A/B/C/...`** 作为可并行处理部分的标题，作为标识符。
例如：

```md
## 1 xx
### 1.1 xxxx
#### 1.1.1 某需求（最小、最终端的进度节点）
- **Agent A**
...（实现 A 部分）
- **Agent B**
...（实现 B 部分）
- **Agent C**
...（实现 C 部分）
```

DSH 支持较多个 subagent。为平衡效率及功能设计，建议将子代理数量设在 3-5 个。


#### 提交点

为方便出现 bug 时回溯版本以快速且准确地定位故障，避免一个长会话只有一个提交，可在 plan 中，适当设置提交点（commit point）。



## 编程时

原则：不实现不在需求中的实现。保持简洁。
不过多考虑多余的边界情况：先动脑子想想这个边界情况是否真的存在。不存在就不要写。存在了就得写稳妥。也不要过多犹豫边界情况的存在，犹豫时“写了再说”。

### 并行处理
当接收来自一个文档的任务时，若识别到文档中的 `Agent A/B/C/...` 标识符时，请**开设多个 subagent，派发任务**。

#### 提交点

当一个提交点（commit point）的内容完成时，请提交————不要 push。
提交按照 Conventional Commits 进行。
提交根据文档编写的代码时，请在提交信息中注明完成了文档的哪一部分。

