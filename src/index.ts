import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema } from './settings.js'

/**
 * webServer 服务由宿主组合提供（`@deepseek-ai/dsh-host-webserver`），
 * 但本仓库未将其声明为直接依赖，其类型增强不会进入编译程序；
 * 这里按需声明与官方 `WebRoute.register` 签名对齐的最小结构类型。
 * 若日后将 dsh-host-webserver 提为直接依赖，应删除本段改用官方类型。
 */
declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
      }): () => void
    }
  }
}

/** Branded settings namespace, derived from the shared constant. */
const themeSettingsNs = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/** 宿主资产通道静态路由前缀（客户端 assets.ts 的同源相对路径与此一致）。 */
const ASSETS_ROUTE = '/customization/assets'
/** 资产文件落盘目录（相对 $DSH_HOME，架构 §5.4）。 */
const ASSETS_DIR = ['storages', 'dsh-customization-settings', 'assets']
/** 单次上传体积上限：20MB。 */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/** 资产根目录绝对路径（`$DSH_HOME/storages/dsh-customization-settings/assets`）。 */
function assetsRoot(): string {
  return join(resolveDshHome(), ...ASSETS_DIR)
}

/** 统一 JSON 响应出口（上传结果与各类错误共用）。 */
function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** 魔数嗅探图片 Content-Type；未知格式回退 `application/octet-stream`。 */
function sniffImageMime(buf: Buffer): string {
  // PNG：0x89 'P' 'N' 'G'
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png'
  }
  // JPEG：0xFF 0xD8 0xFF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  // WebP：'RIFF' 头，且第 8-12 字节为 'WEBP'
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  // GIF：'GIF87a' 或 'GIF89a'
  if (buf.length >= 6) {
    const head = buf.toString('latin1', 0, 6)
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  }
  // AVIF：第 4-12 字节 'ftypavif'
  if (buf.length >= 12 && buf.toString('latin1', 4, 12) === 'ftypavif') {
    return 'image/avif'
  }
  // SVG：文本嗅探（宽松：含 <svg 即可，兼容 <?xml 声明在前、前导空白的情况）
  const text = buf.toString('utf8').trimStart()
  if (text.startsWith('<svg') || text.startsWith('<?xml') || text.includes('<svg')) {
    return 'image/svg+xml'
  }
  return 'application/octet-stream'
}

/** POST：接收图片二进制并落盘，返回 `{ id }`。 */
async function handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 仅接受图片类型上传（按 Content-Type 头粗校验；正文格式由 GET 嗅探兜底）
  const contentType = req.headers['content-type'] ?? ''
  if (!contentType.startsWith('image/')) {
    sendJson(res, 415, { error: '仅支持上传图片（Content-Type 需以 image/ 开头）' })
    return
  }
  // 流式累积请求体，累计超过上限立即 413 中止
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_UPLOAD_BYTES) {
      sendJson(res, 413, { error: '图片超过 20MB 上传上限' })
      return
    }
    chunks.push(buf)
  }
  const id = randomUUID()
  await mkdir(assetsRoot(), { recursive: true })
  await writeFile(join(assetsRoot(), id), Buffer.concat(chunks))
  sendJson(res, 200, { id })
}

/** GET/HEAD：按资产 id 读文件，以嗅探出的图片 Content-Type 返回二进制（HEAD 仅返回头部，供导入校验资产存在性）。 */
async function handleDownload(pathname: string, res: ServerResponse, headOnly: boolean): Promise<void> {
  const id = decodeURIComponent(pathname.slice(ASSETS_ROUTE.length + 1))
  // 防目录穿越：id 只允许单个文件名形态（URL 解析不归一化 %2F，需显式拒绝）
  if (id === '' || id === '.' || id === '..' || id.includes('/') || id.includes('\\')) {
    sendJson(res, 404, { error: '资产不存在' })
    return
  }
  try {
    const buffer = await readFile(join(assetsRoot(), id))
    const mime = sniffImageMime(buffer)
    res.writeHead(200, { 'content-type': mime })
    if (headOnly) {
      res.end()
      return
    }
    res.end(buffer)
  } catch (err) {
    // 文件不存在 → 404；其余错误抛给外层统一 500
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJson(res, 404, { error: '资产不存在' })
      return
    }
    throw err
  }
}

/** 资产路由统一入口：按方法与路径分派；未捕获错误 → 500 + JSON error。 */
const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    // POST /customization/assets：上传
    if (req.method === 'POST' && pathname === ASSETS_ROUTE) {
      await handleUpload(req, res)
      return
    }
    // GET / HEAD /customization/assets/<id>：下载（HEAD 仅返回头部，供导入时校验资产存在性）
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith(`${ASSETS_ROUTE}/`)) {
      await handleDownload(pathname, res, req.method === 'HEAD')
      return
    }
    sendJson(res, 404, { error: '资源不存在' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    sendJson(res, 500, { error: `服务器内部错误：${message}` })
  }
}

/**
 * Host: register the appearance settings namespace and the wallpaper asset
 * channel when the respective services are available. Registration is an
 * effect on this plugin's fiber and is cleaned up when the fiber unloads.
 *
 * 用 `ctx.inject` 而非一次性 `ctx.get('settings')`：loader 并发应用各条目，
 * 本插件可能在服务提供前启动，inject 会在服务可用后补跑注册，
 * 服务消失时卸载、再次可用时重新注册。
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (sctx) => {
    sctx.settings.register(themeSettingsNs, ThemeSettingsSchema)
  })

  // 宿主资产通道（M2-R2）：webServer 就绪后注册 /customization/assets 前缀路由；
  // effect 包裹注册，返回的 disposer 随 fiber 清理（服务消失/重启时自动注销）。
  ctx.inject(['webServer'], (sctx) => {
    sctx.effect(() =>
      sctx.webServer.register({
        kind: 'prefix',
        path: ASSETS_ROUTE,
        handler,
      }),
    )
  })
}
