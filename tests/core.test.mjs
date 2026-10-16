import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, finishDeal, finishSpeech, castVote, beginRunoff, nextRound, living, winnerOf, buildPairs, pickPair, pairKey, validatePack } from '../dist/core.mjs';
import { demoPack } from '../dist/demo.mjs';
const pair = buildPairs(demoPack)[0];
const game = (n = 4, blank = false) => createGame(Array.from({length:n}, (_,i)=>`玩家${i+1}`), pair, {random:()=>.2,blank});
function toVote(g) { while(g.phase === 'deal') finishDeal(g); while(g.phase === 'speech') finishSpeech(g); }
function voteAgainst(g, target) { for (const voter of living(g)) castVote(g, voter.id === target ? living(g).find(p=>p.id!==target).id : target); }

test('3～8 人严格分配角色，普通玩家不知道身份，白板没有词',()=>{
  for(let n=3;n<=8;n++) { const g=game(n); assert.equal(g.players.length,n); assert.equal(g.players.filter(p=>p.role==='undercover').length,1); assert.equal(new Set(g.players.filter(p=>p.role==='civilian').map(p=>p.word)).size,1); assert.notEqual(g.players.find(p=>p.role==='undercover').word,g.players.find(p=>p.role==='civilian').word); }
  const g=game(6,true); assert.equal(g.players.filter(p=>p.role==='blank').length,1); assert.equal(g.players.find(p=>p.role==='blank').word,'');
});
test('重复昵称、非法人数和白板人数不足会被拒绝',()=>{
  assert.throws(()=>createGame(['a','a','c'],pair),/重复/); assert.throws(()=>game(2));assert.throws(()=>game(9));assert.throws(()=>game(4,true));
});
test('正常投出唯一卧底，整局结束且队员获胜',()=>{
  const g=game(4);toVote(g);const spy=g.players.find(p=>p.role==='undercover');voteAgainst(g,spy.id);assert.equal(g.phase,'result');assert.equal(g.winner,'civilian');assert.equal(spy.alive,false);
});
test('误投到阵营人数持平，卧底获胜',()=>{
  const g=game(3);toVote(g);voteAgainst(g,g.players.find(p=>p.role==='civilian').id);assert.equal(g.phase,'result');assert.equal(g.winner,'undercover');
});
test('四人循环投票产生平票，加投后投出卧底',()=>{
  const g=game(4);toVote(g);for(const voter of living(g)) castVote(g,(voter.id+1)%4);assert.equal(g.phase,'tie');assert.equal(g.eligible.length,4);beginRunoff(g);voteAgainst(g,g.players.find(p=>p.role==='undercover').id);assert.equal(g.winner,'civilian');assert.equal(g.history.length,2);
});
test('连续两次平票不淘汰任何人，下一轮重置候选和票箱',()=>{
  const g=game(4);toVote(g);for(const voter of living(g))castVote(g,(voter.id+1)%4);beginRunoff(g);for(const voter of living(g))castVote(g,(voter.id+1)%4);assert.equal(g.phase,'roundEnd');assert.equal(living(g).length,4);nextRound(g);assert.equal(g.round,2);assert.equal(g.phase,'speech');assert.deepEqual(g.votes,{});assert.equal(g.runoff,false);
});
test('不能投自己、不能投不存在的候选，失败不消耗票',()=>{
  const g=game();toVote(g);assert.throws(()=>castVote(g,0));assert.throws(()=>castVote(g,99));assert.equal(g.voteIndex,0);assert.deepEqual(g.votes,{});
});
test('淘汰玩家不再发言和投票，多轮直到结束',()=>{
  const g=game(6);toVote(g);const civilian=g.players.find(p=>p.role==='civilian');voteAgainst(g,civilian.id);assert.equal(g.phase,'roundEnd');nextRound(g);assert.equal(living(g).length,5);while(g.phase==='speech')finishSpeech(g);assert(!g.eligible.includes(civilian.id));voteAgainst(g,g.players.find(p=>p.role==='undercover').id);assert.equal(g.winner,'civilian');
});
test('白板与卧底同属卧底阵营，两人都淘汰才可判队员赢',()=>{
  const g=game(8,true);toVote(g);voteAgainst(g,g.players.find(p=>p.role==='undercover').id);assert.equal(g.winner,null);nextRound(g);while(g.phase==='speech')finishSpeech(g);voteAgainst(g,g.players.find(p=>p.role==='blank').id);assert.equal(g.winner,'civilian');assert.equal(winnerOf(g),'civilian');
});
test('词对仅从同一分类产生，演示两档难度均有词，分类筛选不泄漏',()=>{
  for(const level of ['easy','hard'])for(const category of ['all','汉堡','小食','饮品','甜品']) {const pairs=buildPairs(demoPack,level,category);assert(pairs.length);assert(pairs.every(p=>p.a.category===p.b.category && p.a.name!==p.b.name));if(category!=='all')assert(pairs.every(p=>p.a.category===category));}
});
test('导入去重且只保留白名单字段，实时声明被降为导入，非法营养不是零',()=>{
  const pack=validatePack({schemaVersion:1,source:{kind:'mcp-live',storeName:'测试',token:'secret'},items:[{id:'a',name:'堡A',category:'汉堡',secret:'no',nutrition:{energyKcal:null,protein:-1}},{id:'b',name:'堡B',category:'汉堡',nutrition:{energyKcal:0}},{id:'c',name:'堡A',category:'汉堡'}]},{imported:true});assert.equal(pack.source.kind,'mcp-import');assert.equal(pack.items.length,2);assert(!pack.source.token);assert(!pack.items[0].secret);assert.equal(pack.items[0].nutrition,undefined);assert.equal(pack.items[1].nutrition.energyKcal,0);
});
test('无同类词对、超大包、未声明来源会被拒绝',()=>{
  assert.throws(()=>validatePack({schemaVersion:1,source:{kind:'demo'},items:[{id:'a',name:'a',category:'1'},{id:'b',name:'b',category:'2'}]}));assert.throws(()=>validatePack({schemaVersion:1,source:{kind:'demo'},items:Array(501).fill({})}));assert.throws(()=>validatePack({...demoPack,source:{}}));
});

const food = (id, category = '汉堡') => ({ id, name: `餐品${id}`, category });
const mkPair = (x, y) => ({ a: food(x), b: food(y) });
const X = mkPair('x1', 'x2'), Y = mkPair('y1', 'y2'), Z = mkPair('z1', 'z2');

test('词对标识与 A/B 顺序无关，缺 id 时也不会抛出',()=>{
  assert.equal(pairKey(mkPair('a','b')), pairKey({ a: food('b'), b: food('a') }));
  assert.equal(pairKey(mkPair('b','a')), pairKey(mkPair('a','b')));
  assert.doesNotThrow(()=>pairKey({}));
});
test('正常避重：优先抽取不在最近历史中的词对',()=>{
  const chosen = pickPair([X, Y, Z], [pairKey(X), pairKey(Y)], () => 0);
  assert.equal(pairKey(chosen), pairKey(Z));
  for (let i = 0; i < 20; i++) assert.equal(pairKey(pickPair([X, Y, Z], [pairKey(X), pairKey(Y)])), pairKey(Z));
});
test('历史滚动只保留最近 3 组，最旧记录失效后可再被抽中',()=>{
  let recent = [];
  const record = pair => { recent = [...recent, pairKey(pair)].slice(-3); };
  record(X); record(Y); record(Z);
  assert.equal(pairKey(pickPair([X, Y], recent, () => 0)), pairKey(X)); // X 已滚出历史
  assert.equal(pairKey(pickPair([Y, Z], recent, () => 0)), pairKey(Y)); // 全被排除时先放宽最旧的 Y
});
test('候选仅 1～2 组且都在历史中时，逐条放宽后仍正常返回',()=>{
  assert.equal(pairKey(pickPair([X], [pairKey(X)], () => 0)), pairKey(X));
  assert.equal(pairKey(pickPair([X, Y], [pairKey(X), pairKey(Y)], () => 0)), pairKey(X)); // 最旧的 X 先放宽
});
test('重复历史记录按记录逐条放宽，不会提前解除限制',()=>{
  // 历史（旧→新）：X, Y, X。X 有两条记录，放宽一条后 X 仍应被排除。
  const chosen = pickPair([X, Y], [pairKey(X), pairKey(Y), pairKey(X)], () => 0);
  assert.equal(pairKey(chosen), pairKey(Y));
  // 三条都放宽后轮到 Y 解除时 X 已完全解除？继续放宽到只剩最新一条：排除 X，选 Y；
  // 再放宽到空历史时两组都可抽，确定性地取到第一组 X。
  assert.equal(pairKey(pickPair([X, Y], [], () => 0)), pairKey(X));
});
test('切换分类或菜单后，旧历史不阻塞新候选',()=>{
  const burgers = buildPairs(demoPack, 'easy', '汉堡');
  const snacks = buildPairs(demoPack, 'easy', '小食');
  const burgerKey = pairKey(burgers[0]);
  const chosenSnack = pickPair(snacks, [burgerKey], () => 0);
  assert(chosenSnack); assert.notEqual(pairKey(chosenSnack), burgerKey);
  // 新菜单的候选与历史完全无关时，任意候选都可被抽中
  const imported = validatePack({ schemaVersion: 1, source: { kind: 'mcp-import' }, items: [food('m1'), food('m2')] });
  const newPairs = buildPairs(imported);
  assert.equal(pairKey(pickPair(newPairs, [burgerKey], () => 0)), pairKey(newPairs[0]));
});
test('候选为空时返回 null，由调用方提示而不是死循环或换数据',()=>{
  assert.equal(pickPair([], []), null);
  assert.equal(pickPair([], [pairKey(X)]), null);
  assert.equal(pickPair(null, [pairKey(X)]), null);
});
