/**
 * 宿主加载器入口，指向 `./client` 导出的浏览器实现。
 * 本插件目前为纯 UI（客户端）能力，宿主侧无任何行为；后续壁纸/主题色等
 * 需要持久化设置时，再在此处注册 settings namespace。
 */
export function apply(): void {}
