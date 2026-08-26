<h1 align="center"> DSH-Customization-Settings </h1>

[简体中文](./README.md) | [English](./README.en.md)

为 DeepSeek Harness 提供通用的 UI 个性化设置。

## 已开发功能

### 👚 外观
在「设置」面板左侧新增「外观」大类（图标与「通用设置」一致），提供完整的主题管理：
- **预置主题库**：暮蓝 / 森林 / 暖橙 / 石墨 / 紫罗兰 5 套主题 + 「跟随系统」入口，点击即应用；
- **壁纸**：图片（上传 / URL / 内置资源）、显示位置（全屏 / 仅对话区）、遮罩透明度（颜色随主题明暗自适应）、侧边栏遮罩（自定义颜色与透明度）；
- **主题色**：13 个颜色 token（品牌/背景/文字/边框/状态/侧边栏），浅色 / 深色双通道分别编辑；
- **方案管理**：「我的主题」列表——新建 / 复制 / 重命名 / 删除 / 设为当前，随时切换；
- **导出 / 导入**：方案导出为 JSON 文件，可重新导入还原（含壁纸引用），非法文件安全拒绝；
- **恢复默认**：单维度（壁纸 / 单个颜色）、整方案重置、一键回 shell 默认。

> 计划开发的功能详见 [TODO.md](./TODO.md)。

## 安装

### 1. 从 `npm` 安装
> 开发未完成，暂未发布到 npm。

### 2. 从仓库安装（本地开发）

```sh

# 1 安装到 web profile（转发 pnpm，装进 $DSH_HOME/profiles/web/node_modules）
dsh plugin --profile web add <repo-path>

# 2 启用：把 "dsh-customization-settings" 追加进 profile 的组合包列表
#    编辑 $DSH_HOME/profiles/web/package.json：
#      "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-customization-settings"] } }

# 3 重启
dsh web
```

> 等价启用方式：也可不把本包当作组合包，而是把本仓库 `cordis.patch.yml` 里的
> `insert` 段直接并入 `$DSH_HOME/profiles/web/cordis.patch.yml`。

## 开发

```sh
pnpm install   # 安装依赖
pnpm build     # tsc + tsdown，产出 lib/index.js 与 lib/client.js
pnpm typecheck # 仅类型检查
```

## 许可证
[MIT](./LICENSE)

## 贡献
作者高二在读，可能不常查看 issues 和 PRs。有意成为主要维护者的请与我邮件联系。
