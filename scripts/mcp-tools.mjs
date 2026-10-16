import { McpClient } from '../lib/mcp.mjs';
if(!process.env.MCD_MCP_TOKEN){console.error('请先在本机设置 MCD_MCP_TOKEN 环境变量，不要把 Token 写入代码。');process.exit(1);}
try { const client=new McpClient(process.env.MCD_MCP_TOKEN);const tools=await client.connect();console.log(JSON.stringify(tools,null,2)); }
catch(e){console.error(String(e.message).replaceAll(process.env.MCD_MCP_TOKEN,'[REDACTED]'));process.exitCode=1;}
