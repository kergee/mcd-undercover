import { createGame, finishDeal, finishSpeech, castVote, living, beginRunoff, nextRound, buildPairs, pickPair, pairKey, validatePack, secureRandom, ROLE_LABEL } from './core.mjs';
import { demoPack } from './demo.mjs';

const $ = s => document.querySelector(s);
const main = $('#main'), dialog = $('#info-dialog');
const state = { count: 4, names: ['小麦', '薯条', '阿堡', '可乐', '小派', '鸡块', '拿铁', '甜筒'], difficulty: 'easy', category: 'all', blank: false, seconds: 45, sound: false, pack: validatePack(demoPack), game: null, revealed: false, voterReady: false, selected: null, last: null, stores: [], recentPairs: [] };
let interval, secondsLeft, soundContext;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = `<svg class="burger-art" viewBox="0 0 220 180" aria-hidden="true"><path d="M22 76C23 16 190 10 198 76Z" fill="#d88b38"/><path d="M25 69C34 14 185 16 194 69Z" fill="#f5bb62"/><g fill="#ffedb9" transform="rotate(-12 110 45)"><ellipse cx="65" cy="43" rx="6" ry="2.2"/><ellipse cx="105" cy="29" rx="6" ry="2.2"/><ellipse cx="141" cy="46" rx="6" ry="2.2"/><ellipse cx="93" cy="57" rx="6" ry="2.2"/><ellipse cx="164" cy="59" rx="6" ry="2.2"/></g><rect x="17" y="81" width="187" height="13" rx="6" fill="#7c452c"/><path d="M13 97l23-5 18 9 24-8 20 10 23-11 18 10 24-9 20 8 25-6v13l-24 5-24-8-24 9-20-8-22 10-19-8-23 9-21-7-20 4Z" fill="#6d9553"/><path d="M21 112h181l-37 18-43-6-27 13-31-13-42 7Z" fill="#f5cc45"/><rect x="20" y="122" width="180" height="21" rx="9" fill="#6d3825"/><path d="M24 146h173c-5 29-164 32-173 0Z" fill="#d79348"/><path d="M27 145h166c-13 20-152 24-166 0Z" fill="#efb664"/></svg>`;

function toast(text) { const node = $('#toast'); node.textContent = text; node.classList.add('show'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => node.classList.remove('show'), 3500); }
function beep(end = false) {
  if (!state.sound) return;
  try { soundContext ??= new AudioContext(); soundContext.resume(); const osc = soundContext.createOscillator(), gain = soundContext.createGain(); osc.connect(gain); gain.connect(soundContext.destination); osc.type = 'sine'; osc.frequency.value = end ? 440 : 660; gain.gain.setValueAtTime(.07, soundContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, soundContext.currentTime + .13); osc.start(); osc.stop(soundContext.currentTime + .14); } catch {}
}
function sourceLabel() { return state.pack.source.kind === 'demo' ? '示例菜单' : state.pack.source.kind === 'mcp-live' ? '本机实时菜单' : '导入菜单'; }
function sourceBanner() {
  const source = state.pack.source;
  if (source.kind === 'demo') return `<div class="source-banner">◈ 正在使用演示词库 · 不代表当前门店在售情况，未编造价格与营养值。</div>`;
  const date = source.fetchedAt ? new Date(source.fetchedAt).toLocaleString('zh-CN', { hour12: false }) : '时间未标注';
  return `<div class="source-banner ${source.kind === 'mcp-live' ? 'live' : ''}">◈ ${esc(sourceLabel())} · ${esc(source.storeName)} · ${state.pack.items.length} 款 · ${esc(date)}${source.kind === 'mcp-import' ? ' · 文件来源未独立复核' : ''}</div>`;
}
function updateSourceChip() { $('#source-chip').textContent = sourceLabel(); $('.source-dot').classList.toggle('live', state.pack.source.kind === 'mcp-live'); }
function openDialog(html) { $('#dialog-content').innerHTML = html; if (!dialog.open) dialog.showModal(); }
function showRules() {
  openDialog(`<div class="eyebrow">HOW TO PLAY</div><h2 id="dialog-title">吃得很熟，未必猜得准。</h2><div class="rules-steps"><div class="rule"><div><b>传手机，偷偷看自己的词</b><p>麦麦队员拿到同一个餐品，1 位卧底拿到相似餐品。你只知道自己的词，不知道身份。</p></div></div><div class="rule"><div><b>每人一句，描述但别报菜名</b><p>轮流说一句线索，不能直接说完整餐品名。倒计时结束只是提醒，由你点击交给下一位。</p></div></div><div class="rule"><div><b>私密投票，找出不一样的朋友</b><p>每人投给另一位玩家。最高票出局并揭晓身份；平票加投一次，再平票则本轮无人出局。</p></div></div><div class="rule"><div><b>揭晓答案，留下一桌金句</b><p>所有卧底阵营玩家出局，麦麦队员获胜。卧底阵营存活人数达到或超过队员，卧底阵营获胜。</p></div></div></div><div class="help-card"><b>白板模式（可选，5 人起）</b><p>增加 1 位没有餐品词的玩家，需根据其他人的描述伪装。白板与卧底属于同一阵营，无单独猜词复活规则。</p></div><p class="quiet">同机版适合面对面聚会，请其他玩家在看牌、投票时移开视线。无需消费，没有积分或实物奖品。</p>`);
}
function setup() {
  clearInterval(interval);
  state.revealed = false;
  const seats = Array.from({ length: state.count }, (_, i) => {
    const angle = (i / state.count) * Math.PI * 2 - Math.PI / 2;
    return `<div class="seat" style="--sx:${Math.cos(angle) * 153}px;--sy:${Math.sin(angle) * 144}px"><span>${i + 1}</span><small>PLAYER ${String(i + 1).padStart(2, '0')}</small></div>`;
  }).join('');
  const categories = [...new Set(state.pack.items.map(i => i.category))];
  if (state.category !== 'all' && !categories.includes(state.category)) state.category = 'all';
  main.innerHTML = `<div class="heading-row"><div><div class="eyebrow">PASS THE PHONE, KEEP THE SECRET.</div><h1>这一桌，谁拿了<em>不一样的菜单？</em></h1><p class="intro">把手机传一圈，把朋友猜一遍。熟悉的餐品，也能藏住一位演技派。</p></div><div class="stamp">LUNCH BREAK<strong>午休开局</strong>EVERYONE IS INVITED</div></div><div class="setup-grid"><section class="table-card" aria-label="面对面聚会示意"><div class="table-label">TABLE NO. 001<b>今天的快乐，已经上桌。</b></div><div class="tape">ONE OF US IS DIFFERENT</div><div class="table-scene"><div class="plate">${icon}</div>${seats}<div class="mystery-sticker">?</div></div><div class="scene-caption"><strong>餐品很熟，朋友很会演。</strong><p>NO PURCHASE NEEDED. JUST BRING YOUR FRIENDS.</p></div></section><section class="setup-card" aria-labelledby="setup-title"><div class="card-top"><h2 id="setup-title">先把这一桌安排好</h2><span class="pill">同机传递模式</span></div><div class="field-title"><span>今天几个人？</span><div class="counter"><button data-action="decrease" aria-label="减少一位玩家" ${state.count <= 3 ? 'disabled' : ''}>−</button><output aria-live="polite">${state.count}</output><button data-action="increase" aria-label="增加一位玩家" ${state.count >= 8 ? 'disabled' : ''}>＋</button></div></div><div class="names-grid">${state.names.slice(0, state.count).map((n, i) => `<label class="name-field"><span>${String(i + 1).padStart(2, '0')}</span><input aria-label="玩家${i + 1}昵称" data-name-index="${i}" maxlength="12" value="${esc(n)}" autocomplete="off"></label>`).join('')}</div><div class="field-title"><span>想玩点什么难度？</span><small>每局 1 位卧底</small></div><div class="segment"><button class="choice ${state.difficulty === 'easy' ? 'selected' : ''}" aria-pressed="${state.difficulty === 'easy'}" data-difficulty="easy"><span>☀</span><div><b>轻松开局</b><small>区别明显，适合新朋友</small></div></button><button class="choice ${state.difficulty === 'hard' ? 'selected' : ''}" aria-pressed="${state.difficulty === 'hard'}" data-difficulty="hard"><span>✳</span><div><b>有点难猜</b><small>相似词对，演技上场</small></div></button></div><div class="options-row"><label><input id="blank-option" type="checkbox" ${state.blank ? 'checked' : ''} ${state.count < 5 ? 'disabled' : ''}> 加入白板 <span>（5 人起）</span></label><label>每人 <select id="seconds-option" aria-label="每人发言时间">${[30,45,60].map(n => `<option value="${n}" ${state.seconds === n ? 'selected' : ''}>${n} 秒</option>`).join('')}</select></label><label>词库 <select id="category-option" aria-label="餐品分类"><option value="all">混合上桌</option>${categories.map(c => `<option ${state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div><button class="primary full" data-action="start">人齐了，秘密上桌 <span class="arrow">↗</span></button><p id="setup-error" class="error-text" role="alert"></p><p class="setup-foot">${esc(sourceLabel())} · ${state.pack.items.length} 个餐品 · <button class="button-link" id="setup-source">切换真实菜单</button></p></section></div><div class="steps-strip"><div class="mini-step"><span>01</span><div><b>私密看牌</b><small>只记住自己的那一道</small></div></div><div class="mini-step"><span>02</span><div><b>一句描述</b><small>别把餐品名字说出来</small></div></div><div class="mini-step"><span>03</span><div><b>投出卧底</b><small>演技与默契一起上桌</small></div></div>`;
}

function gameShell(content) {
  const game = state.game;
  return `<div class="game-layout"><div class="game-top"><div><div class="eyebrow">THE LUNCH BREAK CLUB</div><h1>${({ deal: '秘密正在上桌', speech: `第 ${game.round} 轮 · 轮到你说了`, vote: game.runoff ? '平票加投 · 再想一想' : `第 ${game.round} 轮 · 谁最可疑？`, tie: '这桌朋友，旗鼓相当', roundEnd: '本轮揭晓', result: '这一桌，演技到位。' })[game.phase]}</h1></div><button class="button-link" data-action="restart">重新开局</button></div>${sourceBanner()}${content}<div class="players-line">${game.players.map(p => `<span class="player-badge ${!p.alive ? 'out' : ''}">${esc(p.name)}${!p.alive ? ' · 已出局' : ''}</span>`).join('')}</div></div>`;
}
function renderGame() {
  clearInterval(interval); updateSourceChip();
  const g = state.game;
  if (!g) { setup(); return; }
  let html = '';
  if (g.phase === 'deal') {
    const p = g.players[g.dealIndex];
    html = `<section class="stage-card"><div class="stage-label">PRIVATE CARD · ${g.dealIndex + 1} / ${g.players.length}</div><div class="avatar-large">${esc(p.name.slice(0,1))}</div><h2>请把手机交给 ${esc(p.name)}</h2><p>其他人先移开视线，秘密只能自己看。</p><button class="secret-card ${state.revealed ? 'revealed' : ''}" data-action="reveal" aria-label="${state.revealed ? '收起餐品词' : '查看我的餐品词'}">${state.revealed ? `<small>你的餐品词是</small><strong>${esc(p.word || '你拿到了白板')}</strong><small>${p.word ? '记住它，发言时别直接报名字' : '听听别人的描述，再悄悄融入大家'}</small>` : '<span class="card-question">?</span><small>点一下，查看你的秘密菜单</small>'}</button><div class="stage-actions"><button class="primary" data-action="next-card" ${state.revealed ? '' : 'disabled'}>${g.dealIndex === g.players.length - 1 ? '记住了，开始第一轮' : '记住了，收牌并交给下一位'} <span>→</span></button></div><p class="quiet">你不会知道自己的阵营。只有白板会看到特别提示。</p></section>`;
  } else if (g.phase === 'speech') {
    const p = living(g)[g.speechIndex];
    html = `<section class="stage-card"><div class="stage-label">SAY SOMETHING · ${g.speechIndex + 1} / ${living(g).length}</div><div class="avatar-large">${esc(p.name.slice(0,1))}</div><h2>${esc(p.name)}，给一句线索</h2><p>描述你的餐品，别报全名。也别太容易让大家猜到。</p><div class="timer" id="timer" role="timer" aria-label="发言剩余时间">${state.seconds}</div><button class="button-link" data-action="timer-toggle" id="timer-toggle">暂停计时</button><label class="sr-only" for="quote">记下这一句（可选，进入战报）</label><textarea class="quote-input" id="quote" maxlength="80" placeholder="这句话有点好笑？记下来，放进战报（可选）"></textarea><div class="stage-actions"><button class="primary" data-action="next-speech">${g.speechIndex === living(g).length - 1 ? '大家说完了，开始投票' : '下一位朋友发言'} <span>→</span></button></div><p class="quiet" id="timer-hint">倒计时只作提醒，不会替你跳过发言。</p></section>`;
  } else if (g.phase === 'vote') {
    const voter = living(g)[g.voteIndex];
    html = `<section class="stage-card"><div class="stage-label">SECRET BALLOT · ${g.voteIndex + 1} / ${living(g).length}</div><div class="avatar-large">${esc(voter.name.slice(0,1))}</div><h2>请把手机交给 ${esc(voter.name)}</h2>${!state.voterReady ? `<p>其他人移开视线。投票完成后会自动收起。</p><div class="stage-actions"><button class="primary" data-action="ready-vote">我是 ${esc(voter.name)}，开始投票</button></div>` : `<p>${g.runoff ? '本次仅在平票候选人中选择。' : '谁的描述和大家最不一样？'}不能投给自己。</p><div class="vote-grid">${g.eligible.map(id => g.players[id]).map(p => `<button class="vote-option ${state.selected === p.id ? 'selected' : ''}" data-vote="${p.id}" aria-pressed="${state.selected === p.id}" ${p.id === voter.id ? 'disabled' : ''}><span>${esc(p.name.slice(0,1))}</span>${esc(p.name)}${p.id === voter.id ? '（你）' : ''}</button>`).join('')}</div><button class="primary" data-action="confirm-vote" ${state.selected === null ? 'disabled' : ''}>确认这一票，并收起手机 <span>→</span></button>`}<p class="quiet">本局仅展示合计票数，不公开谁投给谁。</p></section>`;
  } else if (g.phase === 'tie') {
    html = `<section class="stage-card"><div class="stage-label">IT'S A TIE</div><div class="avatar-large">＝</div><h2>${g.eligible.map(id => esc(g.players[id].name)).join('、')} 平票</h2><p>给他们一点时间再解释一句，然后只在这些人中加投。</p><div class="round-note">${tallyText(g.history.at(-1).tally)}</div><div class="stage-actions"><button class="primary" data-action="runoff">解释完了，开始加投 <span>→</span></button></div><p class="quiet">再次平票，本轮无人出局，继续下一轮。</p></section>`;
  } else if (g.phase === 'roundEnd') {
    const record = g.history.at(-1), p = record.eliminated === null ? null : g.players[record.eliminated];
    html = `<section class="stage-card"><div class="stage-label">ROUND ${g.round} · REVEAL</div><div class="avatar-large">${p ? esc(p.name.slice(0,1)) : '＝'}</div><h2>${p ? `${esc(p.name)} 暂时离桌` : '再次平票，本轮无人出局'}</h2><p>${p ? `身份揭晓：${ROLE_LABEL[p.role]}。${p.role === 'civilian' ? '这桌还藏着演技派。' : '还要继续找到另一位。'}` : '大家再观察一轮，下一轮重新投票。'}</p><div class="round-note">${tallyText(record.tally)}</div><div class="stage-actions"><button class="primary" data-action="next-round">进入第 ${g.round + 1} 轮 <span>→</span></button></div><p class="quiet">餐品词留到整局结束再揭晓。</p></section>`;
  } else if (g.phase === 'result') {
    const civilianWin = g.winner === 'civilian';
    html = `<section class="stage-card"><div class="stage-label">CASE CLOSED · ROUND ${g.round}</div><div class="avatar-large">${civilianWin ? '✳' : '?'}</div><h2>${civilianWin ? '麦麦队员获胜，默契满分！' : '卧底阵营获胜，演技满分！'}</h2><p>${civilianWin ? '秘密藏得再好，也被这一桌朋友找到了。' : '一份不一样的菜单，竟然混进了这一桌。'}</p><div class="role-table">${g.players.map(p => `<div class="role-row ${p.role !== 'civilian' ? 'spy' : ''}"><div>${esc(p.name)}<span>${ROLE_LABEL[p.role]} · ${p.alive ? '留在桌上' : '已出局'}</span></div><small>${esc(p.word || '没有餐品词')}</small></div>`).join('')}</div><div class="receipt"><h3>本局菜单 · 原来只差这一点</h3><div class="fact-pair">${[g.pair.a,g.pair.b].map((food, i) => `<div><strong>${i === 0 ? '队员词' : '卧底词'}：${esc(food.name)}</strong><p>游戏分类：${esc(food.category)}</p><p>${food.nutrition?.energyKcal != null ? `官方匹配营养：${food.nutrition.energyKcal} kcal` : '热量：未匹配，不推算'}</p><p>${food.nutrition?.protein != null ? `蛋白质：${food.nutrition.protein} g` : '蛋白质：未匹配，不推算'}</p></div>`).join('')}</div><p class="source-foot">${esc(g.pair.reason)}。${state.pack.source.kind === 'demo' ? '示例词库不表示当前在售。' : '菜单为获取时快照，营养仅供信息展示。'} 游戏分类由项目按名称归纳。</p></div>${g.quotes.length ? `<div class="receipt"><h3>这桌的金句</h3>${g.quotes.slice(-5).map(q => `<p>“${esc(q.text)}” <span class="quiet">— ${esc(q.name)}</span></p>`).join('')}</div>` : ''}<div class="history-table">${g.history.map(h => `第 ${h.round} 轮${h.runoff ? '加投' : ''}：${tallyText(h.tally)}${h.eliminated !== null ? ` → ${esc(g.players[h.eliminated].name)} 出局` : ' → 平票'}`).join('<br>')}</div><div class="stage-actions"><button class="primary" data-action="share-png">下载本局战报 ↓</button><button class="secondary" data-action="share-text">复制战报文字</button><button class="secondary" data-action="play-again">再开一局 ↗</button></div><p class="quiet">战报含身份和餐品词，请在整局结束后分享。</p></section>`;
  }
  main.innerHTML = gameShell(html);
  if (g.phase === 'speech') startTimer();
  main.querySelector('h2')?.setAttribute('tabindex', '-1');
}

function tallyText(tally) { return Object.entries(tally).map(([id,n]) => `${esc(state.game.players[Number(id)].name)} ${n} 票`).join(' / '); }
function startTimer() {
  secondsLeft = state.seconds;
  const tick = () => { secondsLeft--; $('#timer').textContent = String(secondsLeft); if (secondsLeft <= 0) { clearInterval(interval); interval = null; $('#timer').classList.add('ended'); $('#timer-hint').textContent = '时间到，可以收尾啦。点击按钮再交给下一位。'; $('#timer-toggle').textContent = '重新计时'; beep(true); } };
  interval = setInterval(tick, 1000); startTimer.tick = tick;
}
function startGame() {
  try {
    const pairs = buildPairs(state.pack, state.difficulty, state.category);
    if (!pairs.length) throw new Error('这个分类暂时没有足够词对，请切换“混合上桌”或更换菜单');
    const pair = pickPair(pairs, state.recentPairs, secureRandom);
    if (!pair) throw new Error('暂时没有可用词对，请更换菜单');
    state.game = createGame(state.names.slice(0, state.count), pair, { blank: state.blank });
    state.recentPairs = [...state.recentPairs, pairKey(pair)].slice(-3);
    state.revealed = false; renderGame(); beep(); main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { $('#setup-error').textContent = e.message; }
}
function requestRestart() {
  if (!state.game || state.game.phase === 'result') { state.game = null; setup(); return; }
  openDialog('<div class="eyebrow">START OVER?</div><h2 id="dialog-title">这一局还没有结束</h2><p>重新开局会清空当前身份、发言和投票记录。</p><div class="stage-actions"><button class="secondary" id="keep-playing">继续这局</button><button class="primary" id="confirm-restart">结束本局，重新设置</button></div>');
  $('#keep-playing').onclick = () => dialog.close();
  $('#confirm-restart').onclick = () => { dialog.close(); state.game = null; setup(); };
}
function reportText() {
  const g = state.game;
  return [`麦麦谁是卧底 · 第 ${g.round} 轮结案`, g.winner === 'civilian' ? '麦麦队员获胜' : '卧底阵营获胜', `队员词：${g.pair.a.name} / 卧底词：${g.pair.b.name}`, ...g.players.map(p => `${p.name} · ${ROLE_LABEL[p.role]} · ${p.word || '白板'}`), ...g.quotes.slice(-3).map(q => `“${q.text}” — ${q.name}`), `${sourceLabel()} · ${state.pack.source.storeName}`, '独立趣味作品，非麦当劳官方产品；无需消费。'].join('\n');
}
async function copyReport() {
  try { await navigator.clipboard.writeText(reportText()); toast('战报文字已复制'); }
  catch { openDialog(`<h2 id="dialog-title">本局战报</h2><p>当前浏览器不支持自动复制，可手动复制下方文字。</p><textarea class="quote-input" rows="12" readonly>${esc(reportText())}</textarea>`); }
}
function downloadReport() {
  const g = state.game, lines = reportText().split('\n'), canvas = document.createElement('canvas');
  canvas.width = 1080;
  const ctx = canvas.getContext('2d');
  const wrapped = lines.map((line, index) => {
    ctx.font = `${index < 3 ? 'bold ' : ''}29px "Microsoft YaHei",sans-serif`;
    const rows = []; let part = '';
    for (const char of line) { if (ctx.measureText(part + char).width > 940) { rows.push(part); part = ''; } part += char; }
    rows.push(part); return rows;
  });
  canvas.height = Math.max(1350, 560 + wrapped.reduce((height, rows) => height + rows.length * 45 + 12, 0));
  ctx.fillStyle = '#fff9ed'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#c52d36'; ctx.fillRect(0,0,1080,24); ctx.fillRect(64,90,90,90);
  ctx.fillStyle = '#f9cd54'; ctx.font = 'bold 66px Georgia'; ctx.fillText('?',91,159);
  ctx.fillStyle = '#c52d36'; ctx.font = 'bold 47px "Microsoft YaHei",sans-serif'; ctx.fillText('麦麦谁是卧底',183,151);
  ctx.fillStyle = '#8c7c62'; ctx.font = '22px monospace'; ctx.fillText('THE LUNCH BREAK CLUB / CASE CLOSED',67,226);
  ctx.fillStyle = '#292922'; ctx.font = 'bold 52px "Microsoft YaHei",sans-serif'; ctx.fillText(g.winner === 'civilian' ? '这一桌，默契满分。' : '这一桌，演技满分。',65,340);
  ctx.strokeStyle = '#cbbd9f'; ctx.setLineDash([8,9]); ctx.beginPath();ctx.moveTo(65,392);ctx.lineTo(1015,392);ctx.stroke();ctx.setLineDash([]);
  let y = 465;
  for (const [i,rows] of wrapped.entries()) {
    ctx.fillStyle = i < 3 ? '#c52d36' : '#564e40'; ctx.font = `${i < 3 ? 'bold ' : ''}29px "Microsoft YaHei",sans-serif`;
    for (const row of rows) { ctx.fillText(row,65,y); y += 45; }
    y += 12;
  }
  canvas.toBlob(blob => { if (!blob) return toast('战报生成失败，请复制文字'); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = `麦麦谁是卧底-第${g.round}轮战报.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); toast('战报已生成，正在下载'); }, 'image/png');
}

async function post(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(95000) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败'); return data;
}
async function showSource() {
  if (state.game && state.game.phase !== 'result') return toast('先完成这一局，再更换菜单，避免中途换词');
  openDialog(`<div class="eyebrow">MENU SUPPLY STATION</div><h2 id="dialog-title">换一本今天的菜单</h2><p>查询真实门店菜单，为下一局生成新词对。仅查询，不下单，也不读取你的订单历史。</p><div class="help-card"><b>本机连接麦当劳 MCP</b><p id="connection-state">正在检查本机连接…</p><div class="source-form"><input id="city" aria-label="城市" placeholder="城市，如上海" value="上海"><input id="keyword" aria-label="地点关键词" placeholder="地点关键词" value="人民广场"><button class="primary" id="search-stores">找门店</button></div></div><div class="source-status" id="source-status" role="status"></div><div id="store-list" class="store-list"></div><div class="source-divider">或者带上 WorkBuddy 准备的词库</div><input id="pack-file" type="file" accept="application/json,.json" hidden><button class="secondary" id="import-pack">导入菜单 JSON</button> <button class="button-link" id="use-demo">恢复示例菜单</button><p class="quiet">导入文件只在当前浏览器内使用；将标注为“导入菜单”，不冒充本机实时调用。Token 请配置在本机服务端，不要填写到网页。</p>`);
  try { const response = await fetch('/api/status'); const status = await response.json(); $('#connection-state').textContent = status.tokenConfigured ? '已配置 · 可以查找门店，Token 不会传给网页。' : '尚未配置。按项目说明启动本机服务并设置 Token，或先导入菜单文件。'; $('#search-stores').disabled = !status.tokenConfigured; }
  catch { $('#connection-state').textContent = '当前是静态演示，请通过“启动游戏.cmd”开启本机服务；也可以导入菜单文件。'; $('#search-stores').disabled = true; }
  $('#search-stores').onclick = async () => {
    const button = $('#search-stores'); button.disabled = true; $('#source-status').textContent = '正在查询真实门店…'; $('#store-list').innerHTML = '';
    try {
      const { stores } = await post('/api/stores', { city: $('#city').value, keyword: $('#keyword').value }); state.stores = stores;
      $('#source-status').textContent = stores.length ? `找到 ${stores.length} 家门店，选择一家载入菜单。` : '这个地点暂未返回门店，试试更具体的位置。';
      $('#store-list').innerHTML = stores.map((s,i) => `<button class="store-option" data-store="${i}">${esc(s.storeName)}<small>${esc(s.address || '地址未返回')}</small></button>`).join('');
      $('#store-list').onclick = async event => {
        const target = event.target.closest('[data-store]'); if (!target) return;
        $('#store-list').querySelectorAll('button').forEach(b => b.disabled = true); $('#source-status').textContent = '正在查询在售菜单与营养，生成本局词库…';
        try { const { pack, warning } = await post('/api/menu', state.stores[Number(target.dataset.store)]); setPack(pack); dialog.close(); toast(warning || `已载入 ${pack.items.length} 款真实餐品`); }
        catch (e) { $('#source-status').textContent = e.message; $('#store-list').querySelectorAll('button').forEach(b => b.disabled = false); }
      };
    } catch (e) { $('#source-status').textContent = e.message; }
    finally { button.disabled = false; }
  };
  $('#import-pack').onclick = () => $('#pack-file').click();
  $('#pack-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 1000000) throw new Error('文件过大，菜单包应小于 1 MB'); const pack = validatePack(JSON.parse(await file.text()), { imported: true }); setPack(pack); dialog.close(); toast('菜单已导入，下一局使用新词库'); }
    catch (e) { $('#source-status').textContent = `导入失败：${e.message}`; }
  };
  $('#use-demo').onclick = () => { setPack(demoPack); dialog.close(); toast('已恢复示例菜单'); };
}
function setPack(pack) { state.pack = validatePack(pack); state.game = null; state.category = 'all'; updateSourceChip(); setup(); }

document.addEventListener('input', event => { if (event.target.dataset.nameIndex !== undefined) state.names[Number(event.target.dataset.nameIndex)] = event.target.value; });
document.addEventListener('change', event => {
  if (event.target.id === 'blank-option') state.blank = event.target.checked;
  if (event.target.id === 'seconds-option') state.seconds = Number(event.target.value);
  if (event.target.id === 'category-option') state.category = event.target.value;
});
main.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.difficulty) { state.difficulty = button.dataset.difficulty; setup(); return; }
  if (button.dataset.vote !== undefined) {
    state.selected = Number(button.dataset.vote);
    main.querySelectorAll('[data-vote]').forEach(b => { const selected = Number(b.dataset.vote) === state.selected; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    main.querySelector('[data-action="confirm-vote"]').disabled = false; return;
  }
  if (button.id === 'setup-source') return showSource();
  const action = button.dataset.action, g = state.game;
  if (action === 'increase' || action === 'decrease') { state.count += action === 'increase' ? 1 : -1; if (state.count < 5) state.blank = false; setup(); }
  if (action === 'start') startGame();
  if (action === 'reveal') { state.revealed = !state.revealed; renderGame(); beep(); }
  if (action === 'next-card') { state.revealed = false; finishDeal(g); renderGame(); }
  if (action === 'next-speech') { finishSpeech(g, $('#quote').value); state.voterReady = false; state.selected = null; renderGame(); beep(); }
  if (action === 'timer-toggle') {
    if (interval) { clearInterval(interval); interval = null; button.textContent = '继续计时'; }
    else if (secondsLeft <= 0) { startTimer(); button.textContent = '暂停计时'; }
    else { interval = setInterval(startTimer.tick, 1000); button.textContent = '暂停计时'; }
  }
  if (action === 'ready-vote') { state.voterReady = true; state.selected = null; renderGame(); }
  if (action === 'confirm-vote') { try { state.last = castVote(g, state.selected); state.voterReady = false; state.selected = null; renderGame(); beep(); } catch (e) { toast(e.message); } }
  if (action === 'runoff') { beginRunoff(g); state.voterReady = false; state.selected = null; renderGame(); }
  if (action === 'next-round') { nextRound(g); renderGame(); }
  if (action === 'restart') requestRestart();
  if (action === 'share-text') copyReport();
  if (action === 'share-png') downloadReport();
  if (action === 'play-again') { state.game = null; startGame(); }
});
$('#nav-game').onclick = requestRestart;
$('#nav-rules').onclick = showRules;
$('#nav-source').onclick = showSource;
$('#source-chip').onclick = showSource;
$('#dialog-close').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const rect = dialog.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close(); } });
$('#sound-toggle').onclick = () => { state.sound = !state.sound; $('#sound-toggle').textContent = `♫ 音效${state.sound ? '开' : '关'}`; $('#sound-toggle').setAttribute('aria-pressed', String(state.sound)); $('#sound-toggle').setAttribute('aria-label', `${state.sound ? '关闭' : '开启'}音效`); beep(); };
addEventListener('beforeunload', event => { if (state.game && state.game.phase !== 'result') { event.preventDefault(); event.returnValue = ''; } });
updateSourceChip(); setup();
