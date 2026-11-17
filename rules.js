// 無名之戰．雙盲推演 —— 規則引擎（純邏輯，不含畫面）
// 座標為地圖圖片上的像素位置（1920 × 1080）

export const NODES = {
  S:  { name: '紅軍營地',       x: 600, y: 882, side: 'red',  kind: 'camp' },
  W1: { name: '南岸小徑',   x: 292, y: 738, side: 'red'  },
  W2: { name: '上游淺灘',   x: 325, y: 472, side: 'red',  kind: 'river' },
  W3: { name: '北岸西丘',   x: 382, y: 376, side: 'both', kind: 'bank' },
  W4: { name: '北岸小丘',   x: 705, y: 258, side: 'both' },
  W5: { name: '西路口',     x: 955, y: 250, side: 'red'  },
  C1: { name: '南岸路口',   x: 835, y: 722, side: 'red'  },
  C2: { name: '主渡口',     x: 960, y: 577, side: 'red',  kind: 'river' },
  C3: { name: '主渡口北岸', x: 1010, y: 491, side: 'both', kind: 'bank' },
  C4: { name: '中路',       x: 1088, y: 358, side: 'blue' },
  E1: { name: '南岸小丘',   x: 1300, y: 738, side: 'red'  },
  E2: { name: '下游渡口',   x: 1555, y: 663, side: 'red',  kind: 'river' },
  E3: { name: '下游北岸',   x: 1530, y: 582, side: 'both', kind: 'bank' },
  E4: { name: '東路',       x: 1445, y: 415, side: 'blue' },
  E5: { name: '東路口',     x: 1335, y: 278, side: 'red'  },
  H:  { name: '藍軍本陣',       x: 1160, y: 238, side: 'blue', kind: 'camp' },
};

// 三條路線（依地理順序列出所有點，用來算距離與「經過」）
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
// 被攔在對方專用點位時的出路（單向：只能離開，不能走進去）
const RED_EXIT = [['C4', 'H'], ['C4', 'C3'], ['E4', 'E5'], ['E4', 'E3']];
const BLUE_EDGES = [
  ['H', 'W4', 'W5'], ['W4', 'W3'],
  ['H', 'C4'], ['C4', 'C3'],
  ['H', 'E4', 'E5'], ['E4', 'E3'],
];
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

// 撤退方向
const BACK = {
  red:  { W1: 'S', W2: 'W1', W3: 'W2', W4: 'W3', W5: 'W4', C1: 'S', C2: 'C1', C3: 'C2', C4: 'C3',
          E1: 'C1', E2: 'E1', E3: 'E2', E4: 'E3', E5: 'E4', S: 'S', H: 'W5' },
  blue: { W5: 'H', W4: 'H', W3: 'W4', C4: 'H', C3: 'C4', E4: 'H', E5: 'H', E3: 'E4', H: 'H',
          W2: 'W3', C2: 'C3', E2: 'E3' },
};

export const DEFAULTS = {
  redUnits: 6, blueUnits: 3, maxTurns: 12, sightRange: 2,
  disorderFactor: 0.5,   // 渡河中、未成列時的戰力倍數
  strikeBonus: 1.5,      // 藍軍打擊渡河中／未成列之敵的加成
  prestige: 10,          // 藍軍國君聲望起始值
  prestigeHit: 2,        // 藍軍主動攻擊渡河中／未成列之敵，每次交戰扣的聲望
};

export const STATE_LABEL = { formed: '已成列', crossing: '渡河中', disordered: '未成列' };

export function newGame(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  return {
    cfg,
    turn: 1,
    status: 'playing',   // playing | red_win | blue_win
    result: '',
    seq: 2,
    armies: [
      { id: 'r1', side: 'red',  node: 'S', units: cfg.redUnits,  state: 'formed' },
      { id: 'b1', side: 'blue', node: 'H', units: cfg.blueUnits, state: 'formed' },
    ],
    lost: { red: 0, blue: 0 },
    prestige: cfg.prestige,
    seen: { red: {}, blue: {} },  // 各方記得的敵軍最後位置 { armyId: {node, units, turn} }
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
  if (army.side === 'red' && (army.state === 'disordered')) opts.push({ type: 'regroup', label: '重新列陣（停一回合）' });
  for (const to of Object.keys(ADJ[army.side][army.node] || {})) {
    opts.push({ type: 'move', to, label: `移動到 ${NODES[to].name}` });
  }
  if (army.side === 'blue' && STRIKE[army.node]) {
    opts.push({ type: 'strike', to: STRIKE[army.node], label: `出擊 ${NODES[STRIKE[army.node]].name}（半渡而擊，聲望 −${game?.cfg?.prestigeHit ?? 2}）` });
  }
  return opts;
}

// ===== 回合結算 =====
// orders: { armyId: { type, to, count } }
export function resolveTurn(prev, orders) {
  const g = structuredClone(prev);
  if (g.status !== 'playing') return g;
  const log = [];
  const cfg = g.cfg;

  // 1. 分兵：count 小於兵力時，拆出新部隊執行命令，其餘原地固守
  const plans = [];
  for (const a of [...g.armies]) {
    const o = orders?.[a.id] || { type: 'hold' };
    let mover = a;
    if ((o.type === 'move' || o.type === 'strike') && o.count && o.count < a.units) {
      mover = { ...a, id: (a.side === 'red' ? 'r' : 'b') + (g.seq++), units: o.count };
      a.units -= o.count;
      g.armies.push(mover);
      plans.push({ army: a, order: { type: 'hold' } });
      log.push(`${sideName(a.side)}自${NODES[a.node].name}分兵 ${o.count} 個單位。`);
    }
    plans.push({ army: mover, order: o });
  }

  // 2. 每支部隊這回合的行經路徑
  for (const p of plans) {
    const { army: a, order: o } = p;
    p.start = a.node;
    p.prevState = a.state;
    if (o.type === 'move' && ADJ[a.side][a.node]?.[o.to]) p.path = ADJ[a.side][a.node][o.to];
    else if (o.type === 'strike' && STRIKE[a.node] === o.to) p.path = [a.node, o.to];
    else p.path = [a.node];
    p.end = o.type === 'strike' ? a.node : p.path[p.path.length - 1];
  }

  // 3. 找出接觸點：每一對敵對部隊，沿紅方路徑找第一個交會點
  const reds = plans.filter(p => p.army.side === 'red');
  const blues = plans.filter(p => p.army.side === 'blue');
  for (const r of reds) for (const b of blues) {
    const node = contactNode(r, b);
    if (!node) continue;
    for (const p of [r, b]) {
      const idx = p.order.type === 'strike' ? 0 : p.path.indexOf(node);
      if (p.stopAt == null || idx < p.stopIdx) { p.stopAt = node; p.stopIdx = idx; }
    }
  }

  // 4. 移動到位（被攔下者停在接觸點）
  for (const p of plans) {
    const a = p.army;
    const dest = p.stopAt ?? p.end;
    if (p.order.type !== 'strike') a.node = dest;
    a.side === 'red' && updateRedState(p, a);
  }

  // 5. 依地點合併交戰
  const battles = {};
  for (const p of plans) if (p.stopAt) (battles[p.stopAt] ||= []).push(p);
  for (const [node, ps] of Object.entries(battles)) {
    const rs = ps.filter(p => p.army.side === 'red');
    const bs = ps.filter(p => p.army.side === 'blue');
    if (!rs.length || !bs.length) continue;
    fight(g, node, rs, bs, log);
  }
  g.armies = g.armies.filter(a => a.units > 0);

  // 6. 同方同點合併
  mergeArmies(g);

  // 7. 發現
  updateSight(g);

  // 8. 勝負
  checkEnd(g, log);
  g.log.push({ turn: g.turn, lines: log.length ? log : ['雙方未接觸。'] });
  if (g.status === 'playing') g.turn++;
  return g;
}

function contactNode(r, b) {
  const rp = r.path, bp = b.path;
  // 藍軍出擊：渡口有紅軍停留、進入，或正要離開渡口上岸到藍軍所在處
  if (b.order.type === 'strike') {
    const ford = bp[1];
    if (r.end === ford) return ford;                 // 正在渡河（進入或停在河中）
    if (rp.includes(bp[0])) return bp[0];           // 上岸撞上出擊的藍軍
    return null;                                    // 紅軍退回南岸，脫離接觸
  }
  // 一般情形：路徑有共同點
  const shared = rp.filter(n => bp.includes(n));
  if (!shared.length) return null;
  const rEnd = rp[rp.length - 1], bEnd = bp[bp.length - 1];
  // 追擊不交戰：只是一方離開、另一方抵達同一點，雙方背向而行
  if (shared.length === 1) {
    const n = shared[0];
    if (n === r.start && n === bEnd && b.start !== rEnd && rp.length > 1) return null;
    if (n === b.start && n === rEnd && r.start !== bEnd && bp.length > 1) return null;
  }
  return shared[0]; // 依紅方前進順序的第一個交會點
}

function updateRedState(p, a) {
  const dest = a.node;
  if (NODES[dest].kind === 'river') { a.state = 'crossing'; return; }
  if (NODES[p.start].kind === 'river' && dest !== p.start) {
    // 從河中上岸（若退回南岸，視為已整隊）
    a.state = NODES[dest].kind === 'bank' ? 'disordered' : 'formed';
    return;
  }
  if (p.order.type === 'regroup' && !p.stopAt) { a.pendingRegroup = true; return; }
  // 其餘維持原狀態
}

function effective(p) {
  const a = p.army;
  // 交戰當下：重新列陣的那一回合仍算未成列
  const st = a.state;
  const f = (st === 'crossing' || st === 'disordered') ? 0.5 : 1;
  return { st, f };
}

function fight(g, node, rs, bs, log) {
  const cfg = g.cfg;
  const redUnits = rs.reduce((s, p) => s + p.army.units, 0);
  const blueUnits = bs.reduce((s, p) => s + p.army.units, 0);
  const redWeak = rs.some(p => p.army.state === 'crossing' || p.army.state === 'disordered');
  const redState = rs.some(p => p.army.state === 'crossing') ? 'crossing' : redWeak ? 'disordered' : 'formed';
  const redEff = redUnits * (redWeak ? cfg.disorderFactor : 1);
  const blueEff = blueUnits * (redWeak ? cfg.strikeBonus : 1);
  const head = `【${NODES[node].name}之戰】紅軍 ${redUnits}（${STATE_LABEL[redState]}，戰力 ${fmt(redEff)}）對藍軍 ${blueUnits}（戰力 ${fmt(blueEff)}${redWeak ? '，擊其不整 ×' + cfg.strikeBonus : ''}）。`;
  log.push(head);
  // 聲望：藍軍主動出手（出擊渡口，或自己走進交戰點）攻擊渡河中／未成列的紅軍
  const blueInit = bs.some(p => p.order.type === 'strike' || p.start !== node);
  if (redWeak && blueInit) {
    const hit = cfg.prestigeHit ?? 2;
    g.prestige = Math.max(0, (g.prestige ?? cfg.prestige ?? 10) - hit);
    log.push(`藍軍趁紅軍${redState === 'crossing' ? '渡河未畢' : '上岸未列陣'}而擊，諸侯議論藍君不仁：國君聲望 −${hit}（剩 ${g.prestige}）。`);
  }

  let winner, ratio;
  if (redEff > blueEff) { winner = 'red'; ratio = redEff / blueEff; }
  else if (blueEff > redEff) { winner = 'blue'; ratio = blueEff / redEff; }
  else { winner = null; ratio = 1; }

  if (!winner) {
    takeLoss(rs, 1, g, 'red'); takeLoss(bs, 1, g, 'blue');
    retreat(rs, 'red', node); // 勢均力敵，攻方紅軍退回
    log.push('勢均力敵，雙方各損 1 個單位，紅軍退回原處。');
    for (const p of rs) clearRegroup(p.army);
    return;
  }
  const [W, L] = winner === 'red' ? [rs, bs] : [bs, rs];
  const loserSide = winner === 'red' ? 'blue' : 'red';
  const loserUnits = winner === 'red' ? blueUnits : redUnits;
  let lose, winLose, text;
  if (ratio >= 2) { lose = loserUnits; winLose = 0; text = '潰滅'; }
  else if (ratio >= 1.5) { lose = Math.ceil(loserUnits / 2); winLose = 0; text = '大敗後撤'; }
  else { lose = 1; winLose = 1; text = '小挫後撤'; }
  takeLoss(L, lose, g, loserSide);
  if (winLose) takeLoss(W, winLose, g, winner);
  retreat(L, loserSide, node);
  log.push(`${sideName(winner)}勝，${sideName(loserSide)}${text}（損 ${lose}${winLose ? `，勝方亦損 ${winLose}` : ''}）。`);
  for (const p of rs) clearRegroup(p.army);
}

function clearRegroup(a) { delete a.pendingRegroup; }

function takeLoss(ps, n, g, side) {
  // 從兵力最多的部隊開始扣
  let left = n;
  const arr = [...ps].sort((a, b) => b.army.units - a.army.units);
  while (left > 0 && arr.some(p => p.army.units > 0)) {
    for (const p of arr) { if (left > 0 && p.army.units > 0) { p.army.units--; left--; g.lost[side]++; } }
  }
}

function retreat(ps, side, node) {
  for (const p of ps) {
    const a = p.army;
    if (a.units <= 0) continue;
    if (p.order.type === 'strike') { a.node = p.start; continue; }
    a.node = p.start !== node ? p.start : BACK[side][node];
    if (side === 'red') {
      if (NODES[a.node].kind === 'river') a.state = 'crossing';
      else if (NODES[node].kind === 'river' && NODES[a.node].kind !== 'bank') a.state = 'formed';
    }
  }
}

function mergeArmies(g) {
  // 重新列陣完成
  for (const a of g.armies) if (a.pendingRegroup) { a.state = 'formed'; delete a.pendingRegroup; }
  const out = [];
  for (const a of g.armies) {
    const m = out.find(o => o.side === a.side && o.node === a.node);
    if (m) {
      m.units += a.units;
      const rank = { formed: 0, disordered: 1, crossing: 2 };
      if (rank[a.state] > rank[m.state]) m.state = a.state;
    } else out.push(a);
  }
  g.armies = out;
}

export function visibleEnemies(g, side) {
  const mine = g.armies.filter(a => a.side === side);
  return g.armies.filter(e => e.side !== side &&
    mine.some(m => routeDistance(m.node, e.node) <= g.cfg.sightRange));
}

function updateSight(g) {
  for (const side of ['red', 'blue']) {
    for (const e of visibleEnemies(g, side)) {
      g.seen[side][e.id] = { node: e.node, units: e.units, state: e.state, turn: g.turn };
    }
    // 已不存在的敵軍或已確認不在原處者移除
    for (const id of Object.keys(g.seen[side])) {
      const rec = g.seen[side][id];
      const alive = g.armies.find(a => a.id === id);
      if (!alive) { delete g.seen[side][id]; continue; }
      const mine = g.armies.filter(a => a.side === side);
      const canSeeSpot = mine.some(m => routeDistance(m.node, rec.node) <= g.cfg.sightRange);
      if (canSeeSpot && alive.node !== rec.node && !visibleEnemies(g, side).includes(alive)) delete g.seen[side][id];
    }
  }
}

function checkEnd(g, log) {
  const red = g.armies.filter(a => a.side === 'red');
  const blue = g.armies.filter(a => a.side === 'blue');
  if (red.some(a => a.node === 'H')) { g.status = 'red_win'; g.result = '紅軍攻入藍軍本陣，紅軍勝。'; }
  else if (!blue.length) { g.status = 'red_win'; g.result = '藍軍全軍覆沒，紅軍勝。'; }
  else if (g.lost.red >= Math.ceil(g.cfg.redUnits / 2)) { g.status = 'blue_win'; g.result = `紅軍折損過半（${g.lost.red}／${g.cfg.redUnits}），藍軍勝。`; }
  else if (g.turn >= g.cfg.maxTurns) { g.status = 'blue_win'; g.result = `${g.cfg.maxTurns} 回合內紅軍未能攻入，藍軍守住國都。`; }
  if (g.status !== 'playing') { g.result += `藍軍國君聲望 ${g.prestige ?? 10}／${g.cfg.prestige ?? 10}。`; log.push(g.result); }
}

// 給某一方看的畫面資料（裁判寫入，學生只讀自己這份）
export function viewFor(g, side) {
  const vis = (g.status === 'playing' ? visibleEnemies(g, side) : g.armies.filter(a => a.side !== side)).map(e => e.id);
  return {
    turn: g.turn, status: g.status, result: g.status === 'playing' ? '' : g.result,
    cfg: g.cfg,
    mine: g.armies.filter(a => a.side === side),
    enemies: g.armies.filter(a => vis.includes(a.id)),
    ghosts: Object.entries(g.seen[side]).filter(([id]) => !vis.includes(id)).map(([id, r]) => ({ id, ...r })),
    lost: g.lost,
    prestige: side === 'blue' || g.status !== 'playing' ? g.prestige : undefined,
    log: g.log.filter(l => true).map(l => ({ turn: l.turn, lines: l.lines.filter(t => relevant(t, g, side, vis)) })).filter(l => l.lines.length),
  };
}
function relevant(t, g, side) {
  // 交戰訊息雙方都知道；分兵訊息只給本方
  if (t.includes('分兵')) return t.startsWith(sideName(side));
  return true;
}

export function sideName(s) { return s === 'red' ? '紅軍' : '藍軍'; }
function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
