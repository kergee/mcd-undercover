export const ROLE_LABEL = { civilian: '麦麦队员', undercover: '卧底', blank: '白板' };

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    if (j < 0 || j > i) throw new Error('随机数必须位于 [0,1)');
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function secureRandom() {
  const n = new Uint32Array(1);
  globalThis.crypto.getRandomValues(n);
  return n[0] / 4294967296;
}

export function createGame(names, pair, { blank = false, random = secureRandom } = {}) {
  if (!Array.isArray(names) || names.length < 3 || names.length > 8) throw new Error('请选择 3～8 位玩家');
  const cleaned = names.map((n, i) => String(n).trim().slice(0, 12) || `玩家 ${i + 1}`);
  if (new Set(cleaned).size !== cleaned.length) throw new Error('玩家昵称不能重复');
  if (blank && names.length < 5) throw new Error('白板模式至少需要 5 位玩家');
  if (!pair?.a?.name || !pair?.b?.name || pair.a.name === pair.b.name) throw new Error('本局需要两个不同的餐品');
  const swapped = random() < 0.5;
  const a = swapped ? pair.b : pair.a;
  const b = swapped ? pair.a : pair.b;
  const roles = shuffle(['undercover', ...(blank ? ['blank'] : []), ...Array(names.length - (blank ? 2 : 1)).fill('civilian')], random);
  return {
    phase: 'deal', round: 1, dealIndex: 0, speechIndex: 0, voteIndex: 0,
    players: cleaned.map((name, id) => ({ id, name, role: roles[id], alive: true, word: roles[id] === 'blank' ? '' : roles[id] === 'undercover' ? b.name : a.name })),
    pair: { a, b, reason: pair.reason }, votes: {}, eligible: [], runoff: false,
    history: [], quotes: [], winner: null, startedAt: new Date().toISOString()
  };
}

export const living = game => game.players.filter(p => p.alive);
export function winnerOf(game) {
  const active = living(game);
  const spies = active.filter(p => p.role !== 'civilian').length;
  if (!spies) return 'civilian';
  if (spies >= active.length - spies) return 'undercover';
  return null;
}

export function beginSpeech(game) {
  game.phase = 'speech'; game.speechIndex = 0; game.runoff = false;
  game.votes = {}; game.eligible = living(game).map(p => p.id);
}

export function finishDeal(game) {
  if (game.phase !== 'deal') throw new Error('当前不在发牌阶段');
  game.dealIndex++;
  if (game.dealIndex >= game.players.length) beginSpeech(game);
}

export function finishSpeech(game, quote = '') {
  if (game.phase !== 'speech') throw new Error('当前不在发言阶段');
  const speaker = living(game)[game.speechIndex];
  if (quote.trim()) game.quotes.push({ name: speaker.name, text: quote.trim().slice(0, 80), round: game.round });
  game.speechIndex++;
  if (game.speechIndex >= living(game).length) { game.phase = 'vote'; game.voteIndex = 0; }
}

export function castVote(game, targetId) {
  if (game.phase !== 'vote') throw new Error('当前不在投票阶段');
  const voter = living(game)[game.voteIndex];
  if (!voter || !game.eligible.includes(targetId) || targetId === voter.id) throw new Error('请选择一位其他候选玩家');
  game.votes[voter.id] = targetId;
  game.voteIndex++;
  if (game.voteIndex < living(game).length) return { kind: 'pending' };
  const tally = Object.fromEntries(game.eligible.map(id => [id, 0]));
  Object.values(game.votes).forEach(id => tally[id]++);
  const maximum = Math.max(...Object.values(tally));
  const tied = game.eligible.filter(id => tally[id] === maximum);
  const record = { round: game.round, tally, runoff: game.runoff, eliminated: null, tied };
  if (tied.length > 1) {
    game.history.push(record);
    if (!game.runoff) {
      game.phase = 'tie'; game.eligible = tied; game.runoff = true;
      return { kind: 'tie', tied, tally };
    }
    game.phase = 'roundEnd';
    return { kind: 'draw', tied, tally };
  }
  const eliminated = game.players[tied[0]];
  eliminated.alive = false;
  record.eliminated = eliminated.id;
  game.history.push(record);
  game.winner = winnerOf(game);
  game.phase = game.winner ? 'result' : 'roundEnd';
  return { kind: 'eliminated', eliminated: eliminated.id, tally, winner: game.winner };
}

export function beginRunoff(game) {
  if (game.phase !== 'tie') throw new Error('当前没有待处理的平票');
  game.phase = 'vote'; game.voteIndex = 0; game.votes = {};
}

export function nextRound(game) {
  if (game.phase !== 'roundEnd') throw new Error('当前轮次尚未结束');
  game.round++; beginSpeech(game);
}

function tokens(name) {
  return new Set([...name.replace(/[\s()（）大小中杯份块\d]/g, '')]);
}
function similarity(a, b) {
  const ta = tokens(a.name), tb = tokens(b.name);
  const intersection = [...ta].filter(x => tb.has(x)).length;
  let score = intersection / Math.max(1, new Set([...ta, ...tb]).size);
  if (a.nutrition && b.nutrition && a.nutrition.energyKcal != null && b.nutrition.energyKcal != null) {
    const x = a.nutrition.energyKcal, y = b.nutrition.energyKcal;
    score = score * 0.65 + (1 - Math.abs(x - y) / Math.max(x, y, 1)) * 0.35;
  }
  return score;
}
export function buildPairs(pack, difficulty = 'easy', category = 'all') {
  const list = pack.items.filter(i => category === 'all' || i.category === category);
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.category !== b.category || a.name === b.name) continue;
    if (a.name.replace(/[（(]?[大小中]杯[）)]?/g, '') === b.name.replace(/[（(]?[大小中]杯[）)]?/g, '')) continue;
    pairs.push({ a, b, score: similarity(a, b), reason: `同属${a.category}，两款均来自本次${pack.source.kind === 'demo' ? '演示' : '导入或查询'}菜单` });
  }
  pairs.sort((x, y) => x.score - y.score || x.a.id.localeCompare(y.a.id));
  const half = Math.max(1, Math.ceil(pairs.length / 2));
  return difficulty === 'hard' ? pairs.slice(-half) : pairs.slice(0, half);
}

export function pairKey(pair) {
  return [String(pair?.a?.id ?? ''), String(pair?.b?.id ?? '')].sort().join('|');
}

// Prefer pairs absent from recent history (order-independent); when all are
// excluded, relax restrictions from the oldest record one at a time. Duplicate
// records each require their own relaxation step, so a repeated key stays
// excluded until every instance has been dropped.
export function pickPair(pairs, recent = [], random = Math.random) {
  if (!Array.isArray(pairs) || !pairs.length) return null;
  for (let dropped = 0; dropped <= recent.length; dropped++) {
    const blocked = new Set(recent.slice(dropped));
    const candidates = pairs.filter(pair => !blocked.has(pairKey(pair)));
    if (candidates.length) return candidates[Math.floor(random() * candidates.length)];
  }
  return null;
}

export function validatePack(input, { imported = false } = {}) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.items) || input.items.length > 500) throw new Error('菜单包格式不正确（需要 schemaVersion: 1，最多 500 个餐品）');
  if (!['demo', 'mcp-live', 'mcp-import'].includes(input.source?.kind)) throw new Error('菜单包缺少有效来源');
  const clean = value => String(value ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100);
  const ids = new Set(), names = new Set();
  const items = [];
  for (const item of input.items) {
    const id = clean(item.id), name = clean(item.name), category = clean(item.category);
    if (!id || !name || !category || ids.has(id) || names.has(name)) continue;
    ids.add(id); names.add(name);
    const nutrition = {};
    for (const field of ['energyKcal', 'protein', 'fat', 'carbohydrate', 'sodium']) {
      const value = item.nutrition?.[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) nutrition[field] = value;
    }
    items.push({ id, name, category, ...(Object.keys(nutrition).length ? { nutrition } : {}) });
  }
  if (items.length < 2) throw new Error('可用餐品不足两项');
  const source = {
    kind: imported && input.source.kind !== 'demo' ? 'mcp-import' : input.source.kind,
    storeName: clean(input.source.storeName || '未指定门店'),
    fetchedAt: clean(input.source.fetchedAt || ''),
    tools: Array.isArray(input.source.tools) ? input.source.tools.filter(t => ['query-meals', 'list-nutrition-foods'].includes(t)) : []
  };
  const pack = { schemaVersion: 1, source, items };
  if (!buildPairs(pack).length) throw new Error('没有可配对餐品，请至少保留同一分类的两个不同餐品');
  return pack;
}
