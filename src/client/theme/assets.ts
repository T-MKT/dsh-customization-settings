/**
 * 客户端资产 API（架构文档 §5.4 / plan-m2 §3）。
 *
 * 纯函数 + fetch，不依赖 React：
 * - `uploadWallpaper`：把用户选择的壁纸图片上传到宿主资产通道，成功返回
 *   `asset:<id>` 引用（settings 里只存这种引用，图片本体落盘在宿主侧
 *   `$DSH_HOME/storages/dsh-customization-settings/assets/`）；
 * - `assetUrl`：把资产 id 转成可加载的相对 URL——页面由 webServer 提供，
 *   origin 即 webServer origin，相对路径可直接用于 `<img>` 或 CSS 背景。
 */

/** 上传壁纸图片到宿主资产通道，返回 asset:<id> 引用。 */
export async function uploadWallpaper(file: Blob): Promise<string> {
  const res = await fetch('/customization/assets', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`壁纸上传失败（HTTP ${res.status}）`)
  }
  const data = (await res.json()) as { id?: unknown }
  if (typeof data.id !== 'string' || data.id === '') {
    throw new Error('壁纸上传失败：宿主未返回有效的资产 id')
  }
  return `asset:${data.id}`
}

/** 资产 id → 可加载的相对 URL（页面 origin 即 webServer origin）。 */
export function assetUrl(assetId: string): string {
  return `/customization/assets/${encodeURIComponent(assetId)}`
}
