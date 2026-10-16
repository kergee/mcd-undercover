export const ALLOWED_TOOLS = new Set(['query-nearby-stores', 'query-meals', 'list-nutrition-foods']);
const ENDPOINT = 'https://mcp.mcd.cn';

async function readResponse(response, id) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('MCP 返回了空响应');
  let total = 0, text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8 * 1024 * 1024) throw new Error('MCP 响应超过大小限制');
      text += decoder.decode(value, { stream: true });
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        for (const block of text.split(/\r?\n\r?\n/).slice(0, -1)) {
          const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
          if (!data) continue;
          try { const message = JSON.parse(data); if (message.id === id) { await reader.cancel(); return message; } } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
        }
      }
    }
  } finally { reader.releaseLock(); }
  text += decoder.decode();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    for (const line of text.split(/\r?\n/).filter(l => l.startsWith('data:'))) {
      try { const value = JSON.parse(line.slice(5)); if (value.id === id) return value; } catch {}
    }
    throw new Error('MCP 事件流没有返回本次请求结果');
  }
  try { return JSON.parse(text); } catch { throw new Error('MCP 返回内容无法解析为 JSON'); }
}

export function decodeToolResult(result) {
  if (result?.isError) throw new Error('MCP 工具调用失败');
  let value = result?.structuredContent;
  if (!value) {
    const blocks = result?.content?.filter(c => c.type === 'text').map(c => c.text) ?? [];
    for (const text of blocks) {
      try { value = JSON.parse(text); break; } catch {}
    }
    if (!value && blocks.length) value = { data: blocks.join('\n') };
  }
  if (!value) throw new Error('工具未返回可识别的数据');
  if (value.success === false || (typeof value.code === 'number' && value.code >= 400)) throw new Error(`MCP 业务请求失败（${value.code ?? 'unknown'}）：${String(value.message ?? '未知原因').slice(0, 140)}`);
  return value;
}

export class McpClient {
  constructor(token, { fetchImpl = fetch } = {}) {
    if (!token) throw new Error('尚未配置麦当劳 MCP Token');
    this.token = token; this.fetch = fetchImpl; this.nextId = 1;
    this.version = '2025-03-26'; this.session = null; this.tools = null; this.evidence = [];
  }
  async request(method, params = {}, notification = false) {
    const id = this.nextId++;
    const headers = { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': this.version };
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    const response = await this.fetch(ENDPOINT, {
      method: 'POST', redirect: 'error', headers,
      body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
      signal: AbortSignal.timeout(30000)
    });
    if (response.headers.get('mcp-session-id')) this.session = response.headers.get('mcp-session-id');
    if (!response.ok) throw new Error(`麦当劳 MCP 请求失败（HTTP ${response.status}）`);
    if (notification) { await response.body?.cancel(); return; }
    const message = await readResponse(response, id);
    if (message.error) throw new Error(`MCP 协议错误 ${message.error.code}：${String(message.error.message).slice(0, 160)}`);
    if (message.id !== id || !('result' in message)) throw new Error('MCP 响应与请求不匹配');
    return message.result;
  }
  async connect() {
    if (this.tools) return this.tools;
    const result = await this.request('initialize', { protocolVersion: this.version, capabilities: {}, clientInfo: { name: 'mcd-undercover', version: '0.1.0' } });
    this.version = result.protocolVersion || this.version;
    await this.request('notifications/initialized', {}, true);
    const tools = [];
    let cursor;
    for (let page = 0; page < 10; page++) {
      const list = await this.request('tools/list', cursor ? { cursor } : {});
      tools.push(...(list.tools ?? [])); cursor = list.nextCursor;
      if (!cursor) break;
      if (page === 9) throw new Error('MCP 工具分页未完整返回');
    }
    this.tools = tools.filter(t => ALLOWED_TOOLS.has(t.name));
    return this.tools;
  }
  async call(name, args = {}) {
    if (!ALLOWED_TOOLS.has(name)) throw new Error('本项目仅允许门店、菜单和营养三种只读工具');
    await this.connect();
    const tool = this.tools.find(t => t.name === name);
    if (!tool) throw new Error(`当前 MCP 服务未提供 ${name}`);
    for (const field of tool.inputSchema?.required ?? []) if (args[field] === undefined) throw new Error(`官方工具 ${name} 需要参数 ${field}`);
    const result = decodeToolResult(await this.request('tools/call', { name, arguments: args }));
    this.evidence.push({ tool: name, at: new Date().toISOString(), success: true });
    return result;
  }
}
