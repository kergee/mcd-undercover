import { readFile,readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=false;
for(const folder of ['dist','lib','scripts','tests'])for(const file of await readdir(path.join(root,folder)))if(file.endsWith('.mjs')){
  const result=spawnSync(process.execPath,['--check',path.join(root,folder,file)],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);failed=true;}
}
for(const file of ['README.md','SKILL.md','CONTEST_DECLARATION.md','MCP_INTEGRATION.md','mcp-config.example.json','workbuddy.md']){
  try{const text=await readFile(path.join(root,file),'utf8');if(!text.trim())throw new Error('empty');}catch{console.error(`缺少文件: ${file}`);failed=true;}
}
const config=JSON.parse(await readFile(path.join(root,'mcp-config.example.json'),'utf8'));
if(config.mcpServers['mcd-mcp'].headers.Authorization!=='Bearer ${MCD_MCP_TOKEN}'){console.error('配置示例必须只含环境变量占位符');failed=true;}
console.log(failed?'检查失败':'语法与参赛文件结构检查通过');process.exitCode=failed?1:0;
