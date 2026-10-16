import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makePack } from '../lib/menu.mjs';
const args=process.argv.slice(2);const opts=Object.fromEntries(args.reduce((pairs,value,i)=>i%2===0?[...pairs,[value,args[i+1]]]:pairs,[]));
if(!opts['--menu']||!opts['--out']){console.error('用法: node scripts/import-menu.mjs --menu raw-menu.json --nutrition raw-nutrition.json --store 门店名 --out menu-pack.json');process.exit(1);}
try{
  const menu=JSON.parse(await readFile(opts['--menu'],'utf8'));const nutrition=opts['--nutrition']?JSON.parse(await readFile(opts['--nutrition'],'utf8')):null;
  const pack=makePack(menu,nutrition,{storeName:opts['--store']||'WorkBuddy 导入门店',kind:'mcp-import'});
  await mkdir(path.dirname(path.resolve(opts['--out'])),{recursive:true});await writeFile(opts['--out'],JSON.stringify(pack,null,2));console.log(`已生成导入菜单包：${pack.items.length} 个餐品。来源标注为 mcp-import，未声称由本机重新验证。`);
}catch(e){console.error(e.message);process.exitCode=1;}
