// 無名之戰．雙盲推演 —— 規則引擎（純邏輯，不含畫面）

export const NODES = {
  S:  { name: '紅軍營地',   side: 'red',  kind: 'camp' },
  W1: { name: '南岸小徑',   side: 'red'  },
  W2: { name: '上游淺灘',   side: 'red',  kind: 'river' },
  W3: { name: '北岸西丘',   side: 'both', kind: 'bank' },
  W4: { name: '北岸小丘',   side: 'both' },
  W5: { name: '西路口',     side: 'red'  },
  C1: { name: '南岸路口',   side: 'red'  },
  C2: { name: '主渡口',     side: 'red',  kind: 'river' },
  C3: { name: '主渡口北岸', side: 'both', kind: 'bank' },
  C4: { name: '中路',       side: 'blue' },
  E1: { name: '南岸小丘',   side: 'red'  },
  E2: { name: '下游渡口',   side: 'red',  kind: 'river' },
  E3: { name: '下游北岸',   side: 'both', kind: 'bank' },
  E4: { name: '東路',       side: 'blue' },
  E5: { name: '東路口',     side: 'red'  },
  H:  { name: '藍軍本陣',   side: 'blue', kind: 'camp' },
};

// 三條路線（依地理順序列出所有點，用來算距離）
export const ROUTES = {
  西路: ['S', 'W1', 'W2', 'W3', 'W4', 'W5', 'H'],
  中路: ['S', 'C1', 'C2', 'C3', 'C4', 'H'],
  東路: ['S', 'C1', 'E1', 'E2', 'E3', 'E4', 'E5', 'H'],
};

// 各方一回合可走的路段：[起, 迄, 途經點]
const RED_EDGES = [
  ['S', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'W4'], ['W4', 'W5'], ['W5', 'H'],
  ['S', 'C1'], ['C1', 'C2'], ['C2', 'C3'], ['C3', 'H', 'C4'],
  ['C1', 'E1'], ['E1', 'E2'], ['E2', 'E3'], ['E3', 'E5', 'E4'], ['E5', 'H'],
];
const BLUE_EDGES = [
  ['H', 'W4', 'W5'], ['W4', 'W3'],
  ['H', 'C4'], ['C4', 'C3'],
  ['H', 'E4', 'E5'], ['E4', 'E3'],
];
// 被攔在對方專用點位時的出路（單向：只能離開，不能走進去）
const RED_EXIT = [['C4', 'H'], ['C4', 'C3'], ['E4', 'E5'], ['E4', 'E3']];
const BLUE_EXIT = [['W5', 'H'], ['W5', 'W4'], ['E5', 'H'], ['E5', 'E4']];

function buildAdj(edges, exits) {
  const adj = {};
  for (const [a, b, via] of edges) {
    (adj[a] ||= {})[b] = via ? [a, via, b] : [a, b];
    (adj[b] ||= {})[a] = via ? [b, via, a] : [b, a];
  }
  for (const [a, b] of exits) (adj[a] ||= {})[b] = [a, b];
  return adj;
}
export const ADJ = { red: buildAdj(RED_EDGES, RED_EXIT), blue: buildAdj(BLUE_EDGES, BLUE_EXIT) };
export const EDGES = { red: RED_EDGES, blue: BLUE_EDGES };

// 河岸點與對岸渡口（藍軍「出擊」用）
export const STRIKE = { W3: 'W2', C3: 'C2', E3: 'E2' };

// 戰敗且原本就守在該點時的撤退方向
const BACK = {
  red:  { S: 'S', W1: 'S', W2: 'W1', W3: 'W2', W4: 'W3', W5: 'W4', C1: 'S', C2: 'C1', C3: 'C2', C4: 'C3',
          E1: 'C1', E2: 'E1', E3: 'E2', E4: 'E3', E5: 'E4', H: 'H' },
  blue: { H: 'H', W5: 'H', W4: 'H', W3: 'W4', C4: 'H', C3: 'C4', E4: 'H', E5: 'H', E3: 'E4' },
};

export const DEFAULTS = {
  redUnits: 6, blueUnits: 3, maxTurns: 12, sightRange: 2,
  disorderFactor: 0.5,   // 渡河中、未成列時的戰力倍數
  strikeBonus: 1.5,      // 藍軍打擊渡河中／未成列之敵的加成
  prestige: 10,          // 藍軍國君聲望起始值
  prestigeHit: 2,        // 藍軍主動攻擊渡河中／未成列之敵，每次交戰扣的聲望
};
// 裁判可調的參數範圍
export const LIMITS = { redUnits: [2, 12], blueUnits: [1, 9], maxTurns: [4, 30], sightRange: [1, 4], strikeBonus: [1, 3], prestigeHit: [0, 5] };

export const VERSION = 3;   // 資料格式版本：不同就不沿用舊房間的戰局
export const STATE_LABEL = { formed: '已成列', crossing: '渡河中', disordered: '未成列' };
export const sideName = s => (s === 'red' ? '紅軍' : '藍軍');
export const redLoseAt = cfg => Math.ceil(cfg.redUnits / 2);
const fmt = n => (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ''));
const isWeak = a => a.state === 'crossing' || a.state === 'disordered';

export function newGame(opts = {}) {
  const cfg = { ...DEFAULTS };
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
    const v = Number(opts[k]);
    if (Number.isFinite(v)) cfg[k] = Math.min(hi, Math.max(lo, k === 'strikeBonus' ? v : Math.round(v)));
  }
  return {
    ver: VERSION, cfg, turn: 1, status: 'playing', result: '', seq: 2,
    armies: [
      { id: 'r1', side: 'red',  node: 'S', units: cfg.redUnits,  state: 'formed' },
      { id: 'b1', side: 'blue', node: 'H', units: cfg.blueUnits, state: 'formed' },
    ],
    fallen: [],
    lost: { red: 0, blue: 0 },
    prestige: cfg.prestige,
    seen: { red: {}, blue: {} },  // 各方記得的敵軍最後位置
    log: [],
  };
}

export function routeDistance(a, b) {
  let best = Infinity;
  for (const list of Object.values(ROUTES)) {
    const i = list.indexOf(a), j = list.indexOf(b);
    if (i >= 0 && j >= 0) best = Math.min(best, Math.abs(i - j));
  }
  return best;
}

// 某部隊可下的命令
export function legalOrders(game, army) {
  const opts = [{ type: 'hold', label: '原地固守' }];
  if (army.side === 'red' && army.state === 'disordered') opts.push({ type: 'regroup', label: '重新列陣（停一回合）' });
  for (const to of Object.keys(ADJ[army.side][army.node] || {})) opts.push({ type: 'move', to, label: `移動到 ${NODES[to].name}` });
  if (army.side === 'blue' && STRIKE[army.node]) opts.push({ type: 'strike', to: STRIKE[army.node], label: `出擊 ${NODES[STRIKE[army.node]].name}` });
  return opts;
}

// 不合法的命令一律當作原地固守
function sanitize(a, o) {
  if (!o || typeof o !== 'object') return { type: 'hold' };
  const cnt = v => { const n = Math.floor(Number(v)); return n >= 1 && n < a.units ? n : a.units; };
  if (o.type === 'move' && ADJ[a.side][a.node]?.[o.to]) return { type: 'move', to: o.to, count: cnt(o.count) };
  if (o.type === 'strike' && a.side === 'blue' && STRIKE[a.node] === o.to) return { type: 'strike', to: o.to, count: cnt(o.count) };
  if (o.type === 'regroup' && a.side === 'red' && a.state === 'disordered') return { type: 'regroup' };
  return { type: 'hold' };
}

const eff = p => p.path.slice(0, p.cut + 1);
const endOf = p => p.path[p.cut];

// 一支紅軍與一支藍軍這回合會不會碰上；回傳碰上的點位與各自走到第幾步
function contact(r, b) {
  const rp = eff(r), bp = eff(b);
  const rEnd = rp[rp.length - 1], bEnd = bp[bp.length - 1];
  const at = n => ({ node: n, ri: rp.indexOf(n), bi: bp.indexOf(n) });
  if (b.strikeTo) {
    if (rp.includes(bp[0])) return at(bp[0]);                                   // 紅軍走上出擊部隊所在的河岸
    if (rEnd === b.strikeTo) return { node: b.strikeTo, ri: rp.length - 1, bi: 0, ford: true }; // 紅軍在渡口被擊
    return null;
  }
  const shared = rp.filter(n => bp.includes(n));
  if (!shared.length) return null;
  if (rEnd === bEnd) return at(rEnd);                                           // 走到同一點
  if (rp.length === 1 || bp.length === 1) return at(shared[0]);                 // 一方不動，另一方經過或抵達
  if (shared.length === 1) {
    const n = shared[0];
    if (n === rp[0] || n === bp[0]) return null;                                // 一方離開、另一方才到：追不上
    return at(n);
  }
  const sameDir = bp.indexOf(shared[0]) < bp.indexOf(shared[1]);
  return sameDir ? null : at(shared[0]);                                        // 對向而行：路上相遇
}

// ===== 回合結算 =====
// orders: { armyId: { type, to, count } }
export function resolveTurn(prev, orders) {
  const g = structuredClone(prev);
  if (g.status !== 'playing') return g;
  const cfg = g.cfg;
  const log = [];
  const say = (t, vis = 'all') => log.push({ t, vis });
  g.fallen = [];

  // 1. 讀命令、分兵
  const plans = [];
  const mk = (army, order) => {
    const start = army.node;
    const path = order.type === 'move' ? ADJ[army.side][start][order.to].slice() : [start];
    return { army, order, start, path, cut: path.length - 1, strikeTo: order.type === 'strike' ? order.to : null, units0: army.units, moved: false };
  };
  for (const a of [...g.armies]) {
    delete a.trail;
    const o = sanitize(a, orders?.[a.id]);
    let mover = a;
    if ((o.type === 'move' || o.type === 'strike') && o.count < a.units) {
      mover = { ...a, id: (a.side === 'red' ? 'r' : 'b') + (g.seq++), units: o.count };
      a.units -= o.count;
      g.armies.push(mover);
      plans.push(mk(a, { type: 'hold' }));
      say(`${sideName(a.side)}在${NODES[a.node].name}分兵：${o.count} 個單位${o.type === 'strike' ? '出擊' : '前往'}${NODES[o.to].name}，${a.units} 個單位留守。`, a.side);
    }
    plans.push(mk(mover, o));
  }
  const reds = plans.filter(p => p.army.side === 'red');
  const blues = plans.filter(p => p.army.side === 'blue');

  // 2. 依時間先後，一次處理一個相遇，被攔下的部隊就停在相遇點
  for (let guard = 0; guard < 60; guard++) {
    let best = null;
    for (const r of reds) for (const b of blues) {
      const c = contact(r, b);
      if (!c || (c.ri >= r.cut && c.bi >= b.cut)) continue;
      const t = Math.max(c.ri / Math.max(1, r.path.length - 1), c.bi / Math.max(1, b.path.length - 1));
      if (!best || t < best.t) best = { t, r, b, c };
    }
    if (!best) break;
    best.r.cut = Math.min(best.r.cut, best.c.ri);
    best.b.cut = Math.min(best.b.cut, best.c.bi);
  }

  // 3. 移動到位
  for (const p of plans) {
    const a = p.army;
    a.node = endOf(p);
    a.trail = eff(p);
    p.moved = a.node !== p.start;
    if (a.side === 'red') {
      if (NODES[a.node].kind === 'river') a.state = 'crossing';
      else if (NODES[p.start].kind === 'river' && p.moved) a.state = NODES[a.node].kind === 'bank' ? 'disordered' : 'formed';
    }
  }

  // 4. 找出交戰：同一點位的敵對部隊；以及藍軍出擊渡口
  const battles = [];
  const at = {};
  for (const p of plans) (at[p.army.node] ||= { rs: [], bs: [] })[p.army.side === 'red' ? 'rs' : 'bs'].push(p);
  for (const [node, grp] of Object.entries(at)) if (grp.rs.length && grp.bs.length) battles.push({ node, rs: grp.rs, bs: grp.bs, ford: false });
  const fords = {};
  for (const b of blues) {
    if (!b.strikeTo) continue;
    if (at[b.army.node].rs.length) continue;              // 河岸上已有敵軍，就地接戰，不再出擊
    b.army.trail = [b.start, b.strikeTo, b.start];        // 畫面上衝到渡口再回來
    (fords[b.strikeTo] ||= []).push(b);
  }
  for (const [ford, bs] of Object.entries(fords)) {
    const rs = at[ford]?.rs || [];
    if (rs.length) battles.push({ node: ford, rs, bs, ford: true });
    else say(`藍軍自${NODES[bs[0].start].name}出擊${NODES[ford].name}，渡口沒有敵軍，撲空而回。`, 'blue');
  }

  // 5. 交戰
  const retreated = [];
  for (const bt of battles) fight(g, bt, say, retreated);

  // 6. 重新列陣（沒被打斷才算完成）
  for (const p of reds) {
    if (p.order.type !== 'regroup' || p.army.units <= 0) continue;
    if (p.interrupted) say(`紅軍在${NODES[p.start].name}列陣被打斷，仍未成列。`);
    else { p.army.state = 'formed'; say(`紅軍在${NODES[p.army.node].name}重新列陣完畢。`, 'red'); }
  }

  // 7. 陣亡、退路被截
  const bury = (p, why) => { g.fallen.push({ id: p.army.id, side: p.army.side, units: p.units0, state: p.army.state, node: p.fellAt || p.army.node, trail: p.army.trail }); };
  for (const p of plans) if (p.army.units <= 0) bury(p);
  for (const p of retreated) {
    const a = p.army;
    if (a.units <= 0) continue;
    if (g.armies.some(e => e.side !== a.side && e.units > 0 && e.node === a.node)) {
      say(`${sideName(a.side)}退往${NODES[a.node].name}時退路被截，${a.units} 個單位潰散。`);
      g.lost[a.side] += a.units; p.units0 = a.units; a.units = 0; bury(p);
    }
  }
  g.armies = g.armies.filter(a => a.units > 0);

  // 8. 同方同點合併（保留有移動的那一支，畫面上才看得到行軍）
  const out = [];
  const rank = { formed: 0, disordered: 1, crossing: 2 };
  for (const a of [...g.armies].sort((x, y) => (y.trail.length > 1) - (x.trail.length > 1))) {
    const m = out.find(o => o.side === a.side && o.node === a.node);
    if (m) { m.units += a.units; if (rank[a.state] > rank[m.state]) m.state = a.state; }
    else out.push(a);
  }
  g.armies = out.sort((x, y) => (x.side < y.side ? 1 : x.side > y.side ? -1 : 0));

  // 9. 發現、勝負
  updateSight(g);
  if (!log.some(l => l.vis === 'all')) say('雙方未接觸。');
  checkEnd(g, say);
  g.log.push({ turn: g.turn, lines: log });
  if (g.status === 'playing') g.turn++;
  return g;
}

function fight(g, bt, say, retreated) {
  const cfg = g.cfg, { node, rs, bs, ford } = bt;
  const rU = rs.reduce((s, p) => s + p.army.units, 0), bU = bs.reduce((s, p) => s + p.army.units, 0);
  const weakU = rs.filter(p => isWeak(p.army)).reduce((s, p) => s + p.army.units, 0);
  const redEff = (rU - weakU) + weakU * cfg.disorderFactor;
  const mult = 1 + (cfg.strikeBonus - 1) * (weakU / rU);
  const blueEff = bU * mult;
  const stLabel = weakU === 0 ? '已成列' : weakU < rU ? '部分未成列' : rs.every(p => p.army.state === 'crossing') ? '渡河中' : '未成列';
  say(`【${NODES[node].name}之戰】紅軍 ${rU}（${stLabel}，戰力 ${fmt(redEff)}）對藍軍 ${bU}（戰力 ${fmt(blueEff)}${weakU && mult > 1 ? `，擊其不整 ×${fmt(mult)}` : ''}）。`);

  // 聲望：藍軍主動出手（出擊渡口，或自己走進交戰點）攻擊渡河中／未成列的紅軍
  const blueInit = ford || bs.some(p => p.moved);
  if (weakU && blueInit && cfg.prestigeHit > 0) {
    g.prestige = Math.max(0, g.prestige - cfg.prestigeHit);
    say(`藍軍趁紅軍${stLabel === '渡河中' ? '渡河未畢' : '尚未成列'}而擊，諸侯議論藍君不仁：國君聲望 −${cfg.prestigeHit}（剩 ${g.prestige}）。`);
  }
  for (const p of rs) if (p.order.type === 'regroup') p.interrupted = true;
  for (const p of [...rs, ...bs]) p.fellAt = node;

  const lose = (ps, n, side) => {
    let left = n;
    const arr = [...ps].sort((a, b) => b.army.units - a.army.units);
    while (left > 0 && arr.some(p => p.army.units > 0)) for (const p of arr) if (left > 0 && p.army.units > 0) { p.army.units--; left--; g.lost[side]++; }
  };
  const fallBack = (ps, side, onlyMovers) => {
    for (const p of ps) {
      const a = p.army;
      if (a.units <= 0 || p.strikeTo && ford) continue;        // 出擊的部隊本來就在河岸，不必退
      if (onlyMovers && !p.moved) continue;
      // 往遠離敵軍的方向退：不退向敵軍這回合走過的點位
      const foePath = new Set((side === 'red' ? bs : rs).flatMap(q => q.army.trail));
      foePath.delete(node);
      const cands = [...(p.moved ? [p.start] : []), BACK[side][node]];
      const dest = cands.find(d => !foePath.has(d));
      if (dest === undefined) {
        say(`${sideName(side)}在${NODES[node].name}退路被截，${a.units} 個單位潰散。`);
        g.lost[side] += a.units; a.units = 0; continue;
      }
      if (dest === a.node) continue;
      a.node = dest; a.trail = [...a.trail, dest];
      if (side === 'red') {
        if (NODES[dest].kind === 'river') a.state = 'crossing';
        else if (NODES[node].kind === 'river') a.state = 'formed';   // 從河裡退回南岸
      }
      retreated.push(p);
    }
  };

  if (Math.abs(redEff - blueEff) < 1e-9) {
    lose(rs, 1, 'red'); lose(bs, 1, 'blue');
    fallBack(rs, 'red', true); fallBack(bs, 'blue', true);
    say('勢均力敵，雙方各損 1 個單位，進攻的一方退回原處。');
    return;
  }
  const redWin = redEff > blueEff;
  const ratio = redWin ? redEff / blueEff : blueEff / redEff;
  const [W, L, wSide, lSide, lU] = redWin ? [rs, bs, 'red', 'blue', bU] : [bs, rs, 'blue', 'red', rU];
  let n, wn = 0, text;
  if (ratio >= 2) { n = lU; text = '潰滅'; }
  else if (ratio >= 1.5) { n = Math.ceil(lU / 2); text = '大敗後撤'; }
  else { n = 1; wn = 1; text = '小挫後撤'; }
  lose(L, n, lSide);
  if (wn) lose(W, wn, wSide);
  fallBack(L, lSide, false);
  say(`${sideName(wSide)}勝，${sideName(lSide)}${text}（損 ${n}${wn ? `，勝方亦損 ${wn}` : ''}）。`);
}

export function visibleEnemies(g, side) {
  const mine = g.armies.filter(a => a.side === side);
  return g.armies.filter(e => e.side !== side && mine.some(m => routeDistance(m.node, e.node) <= g.cfg.sightRange));
}

function updateSight(g) {
  for (const side of ['red', 'blue']) {
    const vis = visibleEnemies(g, side);
    for (const e of vis) g.seen[side][e.id] = { node: e.node, units: e.units, state: e.state, turn: g.turn };
    const mine = g.armies.filter(a => a.side === side);
    for (const id of Object.keys(g.seen[side])) {
      const rec = g.seen[side][id];
      const alive = g.armies.find(a => a.id === id);
      const canSeeSpot = mine.some(m => routeDistance(m.node, rec.node) <= g.cfg.sightRange);
      // 敵軍已不存在，或看得到那個地方卻沒人：把舊的目擊紀錄拿掉
      if (!alive || (canSeeSpot && !vis.includes(alive))) delete g.seen[side][id];
    }
  }
}

function checkEnd(g, say) {
  const red = g.armies.filter(a => a.side === 'red');
  const blue = g.armies.filter(a => a.side === 'blue');
  if (red.some(a => a.node === 'H')) { g.status = 'red_win'; g.result = '紅軍攻入藍軍本陣，紅軍勝。'; }
  else if (!blue.length) { g.status = 'red_win'; g.result = '藍軍全軍覆沒，紅軍勝。'; }
  else if (g.lost.red >= redLoseAt(g.cfg)) { g.status = 'blue_win'; g.result = `紅軍折損過半（${g.lost.red}／${g.cfg.redUnits}），藍軍勝。`; }
  else if (g.turn >= g.cfg.maxTurns) { g.status = 'blue_win'; g.result = `${g.cfg.maxTurns} 回合內紅軍未能攻入，藍軍守住國都，藍軍勝。`; }
  if (g.status !== 'playing') { g.result += `藍軍國君聲望 ${g.prestige}／${g.cfg.prestige}。`; say(g.result); }
}

const pickLog = (log, pred) => log.map(l => ({ turn: l.turn, lines: l.lines.filter(pred).map(x => x.t) })).filter(l => l.lines.length);

// 給某一方看的畫面資料（裁判寫入，學生只讀自己這份）
export function viewFor(g, side) {
  const over = g.status !== 'playing';
  const vis = (over ? g.armies.filter(a => a.side !== side) : visibleEnemies(g, side)).map(e => e.id);
  return {
    ver: VERSION, turn: g.turn, status: g.status, result: over ? g.result : '', cfg: g.cfg,
    mine: g.armies.filter(a => a.side === side),
    enemies: g.armies.filter(a => vis.includes(a.id)),
    ghosts: Object.entries(g.seen[side]).filter(([id]) => !vis.includes(id)).map(([id, r]) => ({ id, ...r })),
    fallen: g.fallen || [],
    lost: g.lost,
    prestige: side === 'blue' || over ? g.prestige : null,
    log: pickLog(g.log, x => over || x.vis === 'all' || x.vis === side),
  };
}

// 投影幕用：推演中不露兵力，也不露任何一方的私下動作
export function publicView(g) {
  const over = g.status !== 'playing';
  return { ver: VERSION, turn: g.turn, status: g.status, result: g.result, cfg: g.cfg, lost: g.lost, prestige: over ? g.prestige : null,
    armies: over ? g.armies : [], fallen: over ? (g.fallen || []) : [],
    log: pickLog(g.log, x => over || x.vis === 'all') };
}
