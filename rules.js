// 無名之戰．雙盲推演 —— 規則引擎（純邏輯，不含畫面）

// side：camp＝某方營地（敵軍攻入即勝）；其餘點位雙方都能走。kind：river＝河中渡口
export const NODES = {
  S:  { name: '紅軍營地',   side: 'red',  kind: 'camp' },
  W1: { name: '南岸小徑',   side: 'both' },
  W2: { name: '上游淺灘',   side: 'both', kind: 'river' },
  W3: { name: '北岸西丘',   side: 'both' },
  W4: { name: '北岸小丘',   side: 'both' },
  W5: { name: '西路口',     side: 'both' },
  C1: { name: '南岸路口',   side: 'both' },
  C2: { name: '主渡口',     side: 'both', kind: 'river' },
  C3: { name: '主渡口北岸', side: 'both' },
  C4: { name: '中路',       side: 'both' },
  E1: { name: '南岸小丘',   side: 'both' },
  E2: { name: '下游渡口',   side: 'both', kind: 'river' },
  E3: { name: '下游北岸',   side: 'both' },
  E4: { name: '東路',       side: 'both' },
  E5: { name: '東路口',     side: 'both' },
  H:  { name: '藍軍本陣',   side: 'blue', kind: 'camp' },
};

// 棋盤：地圖上相鄰的兩個點位都相連，雙方都能走，一回合走一格
export const BOARD = [
  // 南岸
  ['S', 'W1'], ['S', 'C1'], ['W1', 'C1'], ['C1', 'E1'],
  // 三個渡口（南岸 ─ 河中 ─ 北岸）
  ['W1', 'W2'], ['W2', 'W3'], ['C1', 'C2'], ['C2', 'C3'], ['E1', 'E2'], ['E2', 'E3'],
  // 北岸沿河
  ['W3', 'C3'], ['C3', 'E3'],
  // 北岸往國都
  ['W3', 'W4'], ['W4', 'W5'], ['W5', 'H'], ['W5', 'C4'],
  ['C3', 'C4'], ['C4', 'H'], ['C4', 'E4'], ['C4', 'E5'],
  ['E3', 'E4'], ['E4', 'E5'], ['E5', 'H'],
];
export const SOUTH = new Set(['S', 'W1', 'C1', 'E1']);              // 南岸（紅軍這一岸）
const HOMEBANK = { red: 'S', blue: 'N' };
export const bankOf = n => (NODES[n].kind === 'river' ? 'W' : SOUTH.has(n) ? 'S' : 'N');

const NB = {};
for (const [a, b] of BOARD) { (NB[a] ||= []).push(b); (NB[b] ||= []).push(a); }
// 每一方能走的路：棋盤上的相鄰點位（雙方相同）
export const ADJ = { red: {}, blue: {} };
for (const s of ['red', 'blue']) for (const n of Object.keys(NODES)) ADJ[s][n] = Object.fromEntries((NB[n] || []).map(m => [m, [n, m]]));
export const EDGES = { red: BOARD, blue: BOARD };

// 兩點之間最少要走幾格（看得見的距離也用這個算）
const DIST = {};
for (const a of Object.keys(NODES)) {
  DIST[a] = { [a]: 0 }; const q = [a];
  while (q.length) { const n = q.shift(); for (const m of NB[n] || []) if (!(m in DIST[a])) { DIST[a][m] = DIST[a][n] + 1; q.push(m); } }
}
export const routeDistance = (a, b) => DIST[a]?.[b] ?? Infinity;

// 站在河岸點可以「出擊」渡口，打正在渡河的敵軍（雙方都可以）
export const STRIKE = { blue: { W3: 'W2', C3: 'C2', E3: 'E2' }, red: { W1: 'W2', C1: 'C2', E1: 'E2' } };
// 渡口兩岸：某一方被擊退時，退回自己這一岸
const OWN_BANK = { red: { W2: 'W1', C2: 'C1', E2: 'E1' }, blue: { W2: 'W3', C2: 'C3', E2: 'E3' } };
// 對岸登陸點對應的渡口
const LANDING = { red: { W3: 'W2', C3: 'C2', E3: 'E2' }, blue: { W1: 'W2', C1: 'C2', E1: 'E2' } };

// 戰敗且原本就守在該點時的撤退方向：往自己營地走一步
const HOME = { red: 'S', blue: 'H' };
const BACK = {};
for (const side of ['red', 'blue']) {
  // 每個點位走回營地要幾步（照這一方實際能走的方向算，含只能離開的出路）
  const dist = { [HOME[side]]: 0 };
  for (let changed = true; changed;) {
    changed = false;
    for (const n of Object.keys(ADJ[side])) for (const m of Object.keys(ADJ[side][n])) if (m in dist && !(dist[n] <= dist[m] + 1)) { dist[n] = dist[m] + 1; changed = true; }
  }
  BACK[side] = {};
  for (const n of Object.keys(NODES)) {
    if (n === HOME[side] || !(n in dist)) { BACK[side][n] = n; continue; }
    BACK[side][n] = Object.keys(ADJ[side][n]).filter(m => m in dist).sort((a, b) => dist[a] - dist[b])[0] || n;
  }
}

export const DEFAULTS = {
  redUnits: 6, blueUnits: 3, maxTurns: 12, sightRange: 2,
  disorderFactor: 0.5,   // 渡河中、未成列時的戰力倍數
  strikeBonus: 1.5,      // 藍軍打擊渡河中／未成列之敵的加成
  prestige: 10,          // 藍軍國君聲望起始值
  prestigeHit: 2,        // 藍軍主動攻擊渡河中／未成列之敵，每次交戰扣的聲望
};
// 裁判可調的參數範圍
export const LIMITS = { redUnits: [2, 12], blueUnits: [1, 9], maxTurns: [4, 30], sightRange: [1, 4], strikeBonus: [1, 3], prestigeHit: [0, 5] };

export const VERSION = 5;   // 資料格式版本：不同就不沿用舊房間的戰局
export const STATE_LABEL = { formed: '已成列', crossing: '渡河中', disordered: '未成列' };
export const sideName = s => (s === 'red' ? '紅軍' : '藍軍');
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

// 某部隊可下的命令
export function legalOrders(game, army) {
  const opts = [{ type: 'hold', label: '原地固守' }];
  if (army.state === 'disordered') opts.push({ type: 'regroup', label: '重新列陣（停一回合）' });
  for (const to of Object.keys(ADJ[army.side][army.node] || {})) opts.push({ type: 'move', to, label: `移動到 ${NODES[to].name}` });
  const sk = STRIKE[army.side][army.node];
  if (sk) opts.push({ type: 'strike', to: sk, label: `出擊 ${NODES[sk].name}` });
  return opts;
}

// 一支部隊的命令可以是一筆，也可以是好幾筆（分兵：每一隊各自的去處）。
// 回傳 { movers: [{type,to,count}], stay: 留在原地的兵力, regroup: 留下的是否重新列陣 }；不合法的一律當作留在原地
export function parseOrders(a, raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  let left = a.units, regroup = false;
  const movers = [];
  for (const o of list.slice(0, 12)) {
    if (!o || typeof o !== 'object') continue;
    if (o.type === 'regroup') { if (a.state === 'disordered') regroup = true; continue; }
    const okMove = o.type === 'move' && ADJ[a.side][a.node]?.[o.to];
    const okStrike = o.type === 'strike' && STRIKE[a.side][a.node] === o.to;
    if (!okMove && !okStrike) continue;
    if (left <= 0) break;
    let n = Math.floor(Number(o.count)); if (!(n >= 1)) n = left;
    n = Math.min(n, left); left -= n;
    const same = movers.find(m => m.type === o.type && m.to === o.to);
    if (same) same.count += n; else movers.push({ type: o.type, to: o.to, count: n });
  }
  return { movers, stay: left, regroup: regroup && left > 0 };
}

const eff = p => p.path.slice(0, p.cut + 1);
const endOf = p => p.path[p.cut];

// 一支紅軍與一支藍軍這回合會不會碰上；回傳碰上的點位與各自走到第幾步
function contact(r, b) {
  const rp = eff(r), bp = eff(b);
  const rEnd = rp[rp.length - 1], bEnd = bp[bp.length - 1];
  const at = n => ({ node: n, ri: rp.indexOf(n), bi: bp.indexOf(n) });
  if (r.strikeTo && b.strikeTo) return null;                                  // 隔河各自出擊，碰不到
  if (b.strikeTo) {
    if (rp.includes(bp[0])) return at(bp[0]);                                 // 紅軍走上出擊部隊所在的河岸
    if (rEnd === b.strikeTo) return { node: b.strikeTo, ri: rp.length - 1, bi: 0 };   // 紅軍在渡口被擊
    return null;
  }
  if (r.strikeTo) {
    if (bp.includes(rp[0])) return at(rp[0]);
    if (bEnd === r.strikeTo) return { node: r.strikeTo, ri: 0, bi: bp.length - 1 };
    return null;
  }
  const shared = rp.filter(n => bp.includes(n));
  if (!shared.length) return null;
  if (rEnd === bEnd) return at(rEnd);                                         // 走到同一點
  if (rp.length === 1 || bp.length === 1) return at(shared[0]);               // 一方不動，另一方經過或抵達
  if (shared.length === 1) {
    const n = shared[0];
    if (n === rp[0] || n === bp[0]) return null;                              // 一方離開、另一方才到：追不上
    return at(n);
  }
  const sameDir = bp.indexOf(shared[0]) < bp.indexOf(shared[1]);
  return sameDir ? null : at(shared[0]);                                      // 對向而行：路上相遇
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
    const { movers, stay, regroup } = parseOrders(a, orders?.[a.id]);
    const stayOrder = { type: regroup ? 'regroup' : 'hold' };
    if (!movers.length) { plans.push(mk(a, stayOrder)); continue; }
    const parts = movers.map(m => `${m.count} 個單位${m.type === 'strike' ? '出擊' : '前往'}${NODES[m.to].name}`);
    if (stay > 0) parts.push(`${stay} 個單位留守`);
    if (parts.length > 1) say(`${sideName(a.side)}在${NODES[a.node].name}分兵：${parts.join('、')}。`, a.side);
    movers.forEach((m, i) => {
      let army = a;
      if (stay > 0 || i > 0) { army = { ...a, id: (a.side === 'red' ? 'r' : 'b') + (g.seq++), units: m.count }; g.armies.push(army); }
      else a.units = m.count;
      plans.push(mk(army, m));
    });
    if (stay > 0) { a.units = stay; plans.push(mk(a, stayOrder)); }
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
    if (NODES[a.node].kind === 'river') a.state = 'crossing';
    else if (NODES[p.start].kind === 'river' && p.moved) a.state = bankOf(a.node) === HOMEBANK[a.side] ? 'formed' : 'disordered';
  }

  // 4. 找出交戰：同一點位的敵對部隊；以及藍軍出擊渡口
  const battles = [];
  const at = {};
  for (const p of plans) (at[p.army.node] ||= { rs: [], bs: [] })[p.army.side === 'red' ? 'rs' : 'bs'].push(p);
  for (const [node, grp] of Object.entries(at)) if (grp.rs.length && grp.bs.length) battles.push({ node, rs: grp.rs, bs: grp.bs, ford: false });
  for (const p of plans) {
    if (!p.strikeTo) continue;
    const foe = p.army.side === 'red' ? 'bs' : 'rs', mine = p.army.side === 'red' ? 'rs' : 'bs';
    if (at[p.army.node][foe].length) continue;                // 河岸上已有敵軍，就地接戰，不再出擊
    p.army.trail = [p.start, p.strikeTo, p.start];            // 畫面上衝到渡口再回來
    const there = at[p.strikeTo];
    if (!there || !there[foe].length) { say(`${sideName(p.army.side)}自${NODES[p.start].name}出擊${NODES[p.strikeTo].name}，渡口沒有敵軍，撲空而回。`, p.army.side); continue; }
    let bt = battles.find(x => x.node === p.strikeTo);
    if (!bt) battles.push(bt = { node: p.strikeTo, rs: [...there.rs], bs: [...there.bs], ford: true, strikers: [] });
    bt[mine].push(p); bt.ford = true; (bt.strikers ||= []).push(p);
  }

  // 5. 交戰
  const retreated = [];
  for (const bt of battles) fight(g, bt, say, retreated, plans);

  // 6. 重新列陣（沒被打斷才算完成）
  for (const p of plans) {
    if (p.order.type !== 'regroup' || p.army.units <= 0) continue;
    const sn = sideName(p.army.side);
    if (p.interrupted) say(`${sn}在${NODES[p.start].name}列陣被打斷，仍未成列。`);
    else if (p.army.node === p.start) { p.army.state = 'formed'; say(`${sn}在${NODES[p.army.node].name}重新列陣完畢。`, p.army.side); }
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

function fight(g, bt, say, retreated, plans) {
  const cfg = g.cfg, { node, rs, bs, ford } = bt;
  const sum = ps => ps.reduce((s, p) => s + p.army.units, 0);
  const weakOf = ps => ps.filter(p => isWeak(p.army)).reduce((s, p) => s + p.army.units, 0);
  const rU = sum(rs), bU = sum(bs), rW = weakOf(rs), bW = weakOf(bs);
  const label = (ps, U, W) => W === 0 ? '' : W < U ? '部分未成列' : ps.every(p => p.army.state === 'crossing') ? '渡河中' : '未成列';
  const rL = label(rs, rU, rW), bL = label(bs, bU, bW);
  // 未成列、渡河中的部隊戰力打折；打這種敵人的一方，依對方不整的比例加成
  const rBon = 1 + (cfg.strikeBonus - 1) * (bW / bU), bBon = 1 + (cfg.strikeBonus - 1) * (rW / rU);
  const redEff = ((rU - rW) + rW * cfg.disorderFactor) * rBon;
  const blueEff = ((bU - bW) + bW * cfg.disorderFactor) * bBon;
  const desc = (U, L, eff, bon) => `${U}（${L ? L + '，' : ''}戰力 ${fmt(eff)}${bon > 1 ? `，擊其不整 ×${fmt(bon)}` : ''}）`;
  say(`【${NODES[node].name}之戰】紅軍 ${desc(rU, rL, redEff, rBon)}對藍軍 ${desc(bU, bL, blueEff, bBon)}。`);

  // 聲望：藍軍和渡河中、未成列的紅軍交戰，不論誰先動手，都算「擊其未濟、擊其未陣」
  if (rW && cfg.prestigeHit > 0) {
    g.prestige = Math.max(0, g.prestige - cfg.prestigeHit);
    say(`藍軍趁紅軍${rL === '渡河中' ? '渡河未畢' : '尚未成列'}而擊，諸侯議論藍君不仁：國君聲望 −${cfg.prestigeHit}（剩 ${g.prestige}）。`);
  }
  for (const p of [...rs, ...bs]) { if (p.order.type === 'regroup') p.interrupted = true; p.fellAt = node; }

  const lose = (ps, n, side) => {
    let left = n;
    const arr = [...ps].sort((a, b) => b.army.units - a.army.units);
    while (left > 0 && arr.some(p => p.army.units > 0)) for (const p of arr) if (left > 0 && p.army.units > 0) { p.army.units--; left--; g.lost[side]++; }
  };
  const fallBack = (ps, side, onlyMovers) => {
    // 退路不能穿過任何敵軍：這回合所有敵軍走過的點位與所在位置（不只這一仗的對手）
    const foes = plans.filter(q => q.army.side !== side && q.army.units > 0);
    const foePath = new Set(foes.flatMap(q => [...q.army.trail, q.army.node]));
    foePath.delete(node);
    for (const p of ps) {
      const a = p.army;
      if (a.units <= 0) continue;
      if (p.strikeTo && ford) continue;                 // 出擊的部隊本來就在河岸，不必退
      if (onlyMovers && !p.moved) continue;
      // 在水中、或剛登上對岸還沒列陣就吃了敗仗：被逐回自己這一岸
      const ford0 = NODES[node].kind === 'river' ? node : isWeak(a) ? LANDING[side][node] : null;
      if (ford0) {
        const dest = OWN_BANK[side][ford0];
        if (foePath.has(dest) || (ford0 !== node && foePath.has(ford0))) {
          say(`${sideName(side)}退路被截，${a.units} 個單位潰散。`); g.lost[side] += a.units; a.units = 0; continue;
        }
        a.trail = [...a.trail, ...(ford0 !== node ? [ford0] : []), dest];
        a.node = dest; a.state = 'formed';
        say(`${sideName(side)}被逐回${NODES[dest].name}。`);
        retreated.push(p); continue;
      }
      // 其餘往遠離敵軍的方向退：不退向敵軍這回合走過的點位
      const cands = [...(p.moved ? [p.start] : []), BACK[side][node]];
      const dest = cands.find(d => !foePath.has(d));
      if (dest === undefined) { say(`${sideName(side)}在${NODES[node].name}退路被截，${a.units} 個單位潰散。`); g.lost[side] += a.units; a.units = 0; continue; }
      if (dest === a.node) continue;
      a.node = dest; a.trail = [...a.trail, dest];
      if (NODES[dest].kind === 'river') a.state = 'crossing';
      else if (NODES[node].kind === 'river') a.state = bankOf(dest) === HOMEBANK[side] ? 'formed' : 'disordered';
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
  say(`${sideName(wSide)}勝，${sideName(lSide)}${text}（損 ${n}${wn ? `，勝方亦損 ${wn}` : ''}）。`);
  fallBack(L, lSide, false);
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
  else if (blue.some(a => a.node === 'S')) { g.status = 'blue_win'; g.result = '藍軍渡河攻入紅軍營地，藍軍勝。'; }
  else if (!blue.length) { g.status = 'red_win'; g.result = '藍軍全軍覆沒，紅軍勝。'; }
  else if (!red.length) { g.status = 'blue_win'; g.result = '紅軍全軍覆沒，藍軍勝。'; }
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

// ===== 態勢提示 =====
// 依目前看得見的敵我位置，給這一方的提示。draft：還沒送出的移動 [{ from, to, n }]，用來提醒下令的風險
export function situation(view, side, draft = []) {
  const c = view.cfg, pct = Math.round(c.disorderFactor * 100), bonus = c.strikeBonus;
  const me = sideName(side), foe = sideName(side === 'red' ? 'blue' : 'red');
  const NN = n => NODES[n].name;
  const st = a => a.state === 'crossing' ? '正在渡河' : a.state === 'disordered' ? '剛登岸、尚未列陣' : '';
  const power = a => a.units * (isWeak(a) ? c.disorderFactor : 1);
  const out = [], seen = new Set();
  const add = (kind, t) => { if (!seen.has(t)) { seen.add(t); out.push({ kind, t }); } };
  const prestigeNote = side === 'blue' ? `；但和未成列的紅軍交戰，國君聲望 −${c.prestigeHit}` : '';
  for (const e of view.enemies) {
    const near = view.mine.filter(m => routeDistance(m.node, e.node) <= 1);
    if (!near.length) {
      const d = Math.min(...view.mine.map(m => routeDistance(m.node, e.node)));
      add('info', `發現${foe} ${e.units} 個單位在${NN(e.node)}${st(e) ? '（' + st(e) + '）' : ''}，距我軍 ${d} 格。`);
      continue;
    }
    if (isWeak(e)) add('chance', `${foe} ${e.units} 個單位在${NN(e.node)}${st(e)}，戰力只剩 ${pct}%。此時進攻對我有利（擊其不整，戰力 ×${bonus}）${prestigeNote}。`);
    for (const m of near) {
      if (isWeak(m)) add('danger', `我軍在${NN(m.node)}${st(m)}，戰力只剩 ${pct}%；${foe} ${e.units} 個單位就在${NN(e.node)}，對方此時進攻有利。${m.state === 'crossing' ? '可以繼續登岸、退回原岸，或撥兵接應。' : '建議原地重新列陣，或先退回。'}`);
      else if (!isWeak(e)) {
        const a = power(m), b = power(e);
        add(a >= b ? 'info' : 'danger', `${foe} ${e.units} 個單位已成列，在${NN(e.node)}，與我軍${NN(m.node)} ${m.units} 個單位相鄰；正面交戰戰力 ${fmt(a)} 對 ${fmt(b)}${a < b ? '，對我不利' : a > b ? '，對我有利' : '，勢均力敵'}。`);
      }
    }
  }
  // 下令提醒
  for (const d of draft) {
    const foes = view.enemies.filter(e => routeDistance(e.node, d.to) <= 1);
    if (!foes.length) continue;
    const f = foes.map(e => `${NN(e.node)}的${foe} ${e.units} 個單位`).join('、');
    if (NODES[d.to].kind === 'river') add('order', `命令提醒：${d.n} 個單位要進入${NN(d.to)}渡河，渡河時戰力只剩 ${pct}%；${f}可以趁你半渡出擊。`);
    else if (bankOf(d.to) !== HOMEBANK[side] && NODES[d.from].kind === 'river') add('order', `命令提醒：${d.n} 個單位登上${NN(d.to)}後尚未列陣，戰力只剩 ${pct}%；${f}就在附近。`);
    const target = view.enemies.find(e => e.node === d.to);
    if (target && isWeak(target) && side === 'blue') add('order', `命令提醒：攻擊${NN(d.to)}${st(target)}的紅軍，國君聲望會 −${c.prestigeHit}。`);
  }
  const rank = { danger: 0, order: 1, chance: 2, info: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
