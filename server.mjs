import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { McpClient } from './lib/mcp.mjs';
import { makePack } from './lib/menu.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Only this explicit local configuration path is read. It is gitignored.
try {
  const env = await readFile(path.join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^(MCD_MCP_TOKEN|PORT)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
let token = process.env.MCD_MCP_TOKEN || '';
delete process.env.MCD_MCP_TOKEN;
if (process.argv.includes('--token-stdin')) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  console.log('Waiting for MCP token on stdin (not echoed, not saved).');
  token = await new Promise(resolve => { const rl = createInterface({ input: process.stdin, terminal: false }); rl.once('line', line => { rl.close(); resolve(line.trim()); }); });
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
}
const client = token ? new McpClient(token) : null;
const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 必须在 1024～65535 之间');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
function send(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
async function bodyOf(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('需要 JSON 请求');
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16000) throw new Error('请求过大'); }
  return JSON.parse(body || '{}');
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const validHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!validHosts.includes(req.headers.host)) return send(res, 403, { error: '只允许本机访问' });
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, { tokenConfigured: Boolean(client), readOnly: true });
      if (req.method !== 'POST') return send(res, 405, { error: '不支持的请求方法' });
      if (req.headers.origin && !validHosts.map(h => `http://${h}`).includes(req.headers.origin)) return send(res, 403, { error: '拒绝跨站请求' });
      if (!client) return send(res, 503, { error: '本机还没有配置 MCP Token，可先体验示例菜单或导入菜单包' });
      const args = await bodyOf(req);
      if (url.pathname === '/api/stores') {
        const city = String(args.city || '').trim(), keyword = String(args.keyword || '').trim();
        if (!city || !keyword || city.length > 30 || keyword.length > 60) throw new Error('请填写城市和地点关键词');
        const result = await client.call('query-nearby-stores', { searchType: 2, beType: 1, city, keyword });
        const stores = result.data;
        if (!Array.isArray(stores)) throw new Error('官方门店响应格式发生变化，请在 WorkBuddy 核对工具返回');
        return send(res, 200, { stores: stores.slice(0, 30).map(s => ({ storeCode: s.storeCode, beCode: s.beCode, storeName: s.storeName, address: s.address })) });
      }
      if (url.pathname === '/api/menu') {
        const storeCode = String(args.storeCode || '');
        if (!/^[a-zA-Z0-9_-]{1,50}$/.test(storeCode)) throw new Error('门店编码不正确');
        const menu = await client.call('query-meals', { storeCode, ...(args.beCode ? { beCode: String(args.beCode).slice(0, 50) } : {}), orderType: 1, beType: 1 });
        let nutrition = null, warning = '';
        try { nutrition = await client.call('list-nutrition-foods', {}); }
        catch { warning = '营养查询暂不可用，本次仅使用真实菜单词库'; }
        let pack;
        try { pack = makePack(menu, nutrition, { storeName: String(args.storeName || '所选门店'), kind: 'mcp-live' }); }
        catch (e) { if (!nutrition) throw e; pack = makePack(menu, null, { storeName: String(args.storeName || '所选门店'), kind: 'mcp-live' }); warning = '营养格式暂无法匹配，本次仅使用真实菜单词库'; }
        await mkdir(path.join(ROOT, 'runtime'), { recursive: true });
        await writeFile(path.join(ROOT, 'runtime', 'latest-menu-pack.json'), JSON.stringify(pack, null, 2));
        await writeFile(path.join(ROOT, 'runtime', 'mcp-evidence.json'), JSON.stringify({ endpoint: 'https://mcp.mcd.cn', calls: client.evidence, itemCount: pack.items.length, nutritionMatched: pack.items.filter(i => i.nutrition).length, warning, status: 'real-read-only-calls-completed' }, null, 2));
        return send(res, 200, { pack, warning });
      }
      return send(res, 404, { error: '接口不存在' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: '不支持的请求方法' });
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const dist = path.join(ROOT, 'dist');
    const target = path.resolve(dist, '.' + relative);
    if (!target.startsWith(dist + path.sep) || !types[path.extname(target)]) return send(res, 404, { error: '文件不存在' });
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] }); res.end(req.method === 'HEAD' ? undefined : content);
  } catch (e) {
    const message = String(e.message || '请求失败').replaceAll(token || '\0', '[REDACTED]');
    send(res, e.code === 'ENOENT' ? 404 : 400, { error: message.slice(0, 260) });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`麦麦谁是卧底: http://127.0.0.1:${port}\nMCP: ${client ? 'configured, read-only' : 'not configured; demo available'}\nPress Ctrl+C to stop.`));
