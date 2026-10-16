import { validatePack } from '../dist/core.mjs';

// These are game categories inferred from product names, not official tags.
export function classify(name) {
  if (/套餐|件套|组合|随心配|卡权益|麦金卡|早餐卡|优惠券|纸巾|餐具|酱包|番茄酱|玩具|周边/.test(name)) return null;
  if (/堡|麦香鸡|麦香鱼|巨无霸/.test(name)) return '汉堡';
  if (/麦满分|热香饼|早安/.test(name)) return '早餐';
  if (/咖啡|拿铁|美式|卡布|可乐|雪碧|芬达|饮|奶茶|果汁|牛奶|豆浆|巧克力|水/.test(name) && !/派|冰淇淋|麦旋风/.test(name)) return '饮品';
  if (/冰淇淋|麦旋风|派|甜筒|新地/.test(name)) return '甜品';
  if (/薯条|麦乐鸡|鸡翅|鸡块|玉米|苹果片|薯饼/.test(name)) return '小食';
  return null;
}

function csvRow(line) {
  const cells = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('营养 TOON 存在未闭合引号');
  cells.push(cell.trim()); return cells;
}

export function nutritionRows(input) {
  const data = input?.data ?? input;
  if (Array.isArray(data)) return data;
  if (typeof data !== 'string') return [];
  const lines = data.trim().split(/\r?\n/);
  const header = lines.shift()?.match(/\{([^}]+)\}:\s*$/);
  if (!header) throw new Error('营养信息不是已支持的官方 TOON 格式');
  const fields = header[1].split(',').map(s => s.trim());
  return lines.filter(l => l.trim()).map(line => {
    const cells = csvRow(line.trim());
    if (cells.length !== fields.length) throw new Error('营养 TOON 的列数不匹配');
    return Object.fromEntries(fields.map((f, i) => [f, cells[i]]));
  });
}

const keyOf = name => String(name).replace(/[\s（(]?(?:标准份|常规份)[）)]?/g, '').trim();
export function makePack(menuResponse, nutritionResponse, { storeName, kind = 'mcp-import', fetchedAt = new Date().toISOString() } = {}) {
  if (menuResponse?.success === false) throw new Error('菜单业务请求失败');
  const data = menuResponse?.data ?? menuResponse;
  if (!data?.meals || Array.isArray(data.meals) || typeof data.meals !== 'object') throw new Error('没有找到官方菜单 data.meals 字典');
  const rows = nutritionResponse ? nutritionRows(nutritionResponse) : [];
  const nutritionMap = new Map();
  for (const row of rows) {
    const key = keyOf(row.productName);
    // Ambiguous names are not treated as a confirmed match.
    if (nutritionMap.has(key)) nutritionMap.set(key, null); else nutritionMap.set(key, row);
  }
  const items = [];
  for (const [id, meal] of Object.entries(data.meals)) {
    const name = typeof meal.name === 'string' ? meal.name.trim() : '';
    const category = classify(name);
    if (!category) continue;
    const row = nutritionMap.get(keyOf(name));
    const nutrition = {};
    if (row) for (const field of ['energyKcal', 'protein', 'fat', 'carbohydrate', 'sodium']) {
      const raw = row[field];
      if (raw !== null && raw !== undefined && String(raw).trim() !== '' && String(raw) !== 'null') {
        const number = Number(raw);
        if (Number.isFinite(number) && number >= 0) nutrition[field] = number;
      }
    }
    items.push({ id, name, category, ...(Object.keys(nutrition).length ? { nutrition } : {}) });
  }
  return validatePack({ schemaVersion: 1, source: { kind, storeName, fetchedAt, tools: ['query-meals', ...(nutritionResponse ? ['list-nutrition-foods'] : [])] }, items });
}
