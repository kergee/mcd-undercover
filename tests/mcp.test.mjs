import test from 'node:test';
import assert from 'node:assert/strict';
import { McpClient, decodeToolResult } from '../lib/mcp.mjs';
import { makePack, nutritionRows, classify } from '../lib/menu.mjs';

const menu={success:true,data:{meals:{a:{name:'麦香鱼'},b:{name:'麦香鸡'},c:{name:'巨无霸三件套'},d:{name:'麦金卡'},e:{name:'麦香鸡'}}}};
const nutrition={data:'[2]{productName,nutritionDescription,energyKcal,protein}:\n  麦香鱼,null,336,15\n  麦香鸡,null,null,13\n'};
test('官方 TOON 营养表支持引号和逗号，null 保持未知',()=>{
  const rows=nutritionRows(nutrition);assert.equal(rows.length,2);const p=makePack(menu,nutrition,{storeName:'测试'});assert.equal(p.items.length,2);assert.equal(p.items[0].nutrition.energyKcal,336);assert.equal(p.items[1].nutrition.energyKcal,undefined);assert.equal(p.items[1].nutrition.protein,13);
  const quoted=nutritionRows({data:'[1]{productName,nutritionDescription,energyKcal}:\n"A,B","a,b",100'});assert.equal(quoted[0].productName,'A,B');
});
test('重复营养名称不做模糊匹配，格式失败明确报错',()=>{
  const p=makePack(menu,{data:[{productName:'麦香鱼',energyKcal:300},{productName:'麦香鱼',energyKcal:400}]});assert(!p.items[0].nutrition);assert.throws(()=>nutritionRows({data:'[1]{a,b}:\nx,y,z'}));assert.throws(()=>nutritionRows({data:'unknown'}));assert.throws(()=>makePack({success:false,data:{}}));
});
test('分类不把套餐、周边或权益卡当单品，未知不强行分类',()=>{
  assert.equal(classify('巨无霸'),'汉堡');assert.equal(classify('巨无霸三件套'),null);assert.equal(classify('麦金卡'),null);assert.equal(classify('未识别餐品'),null);
});
test('协议 isError=false 时也必须识别业务失败',()=>{
  assert.throws(()=>decodeToolResult({isError:false,content:[{type:'text',text:'{"success":false,"code":600022,"message":"失败"}'}]}));assert.throws(()=>decodeToolResult({isError:true}));assert.deepEqual(decodeToolResult({structuredContent:{success:true,data:[1]}}).data,[1]);
});
test('实际请求仅允许三个只读工具，先初始化再读 schema，携带会话头',async()=>{
  const calls=[];
  const fakeFetch=async(url,options)=>{
    const rpc=JSON.parse(options.body);calls.push({url,rpc,headers:options.headers});
    if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    const result=rpc.method==='initialize'?{protocolVersion:'2025-03-26'}:rpc.method==='tools/list'?{tools:[{name:'query-meals',inputSchema:{required:['storeCode']}}]}:{content:[{type:'text',text:'{"success":true,"data":{"meals":{}}}'}]};
    return new Response(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result}),{headers:{'Content-Type':'application/json','Mcp-Session-Id':'test-session'}});
  };
  const client=new McpClient('TEST_ONLY',{fetchImpl:fakeFetch});await assert.rejects(client.call('create-order',{}));assert.equal(calls.length,0);await assert.rejects(client.call('query-meals',{}),/storeCode/);await client.call('query-meals',{storeCode:'123'});assert.equal(calls.at(-1).headers['Mcp-Session-Id'],'test-session');assert.equal(client.evidence.length,1);assert(calls.every(c=>c.url==='https://mcp.mcd.cn'));
});
test('SSE 响应能读到对应请求，HTTP 401 不伪装成功',async()=>{
  const fetchImpl=async(_url,options)=>{
    const rpc=JSON.parse(options.body);
    return new Response(`event: message\ndata: ${JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{ok:true}})}\n\n`,{headers:{'Content-Type':'text/event-stream'}});
  };
  const client=new McpClient('TEST_ONLY',{fetchImpl});assert.deepEqual(await client.request('test'),{ok:true});
  const rejected=new McpClient('TEST_ONLY',{fetchImpl:async()=>new Response('Unauthorized',{status:401})});await assert.rejects(rejected.request('initialize'),/401/);
});
