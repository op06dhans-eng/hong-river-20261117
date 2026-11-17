// 規則測試：固定情境 ＋ 大量隨機對局檢查不變量。執行：node rules-test.mjs
import * as R from './rules.js';
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; if (fails < 30) console.log('  ✗', msg); } };
const play = (steps, opts) => { let g = R.newGame(opts); for (const o of steps) g = R.resolveTurn(g, o); return g; };
const lastLog = g => g.log.at(-1).lines.map(x => x.t).join(' / ');
const at = (g, side) => g.armies.filter(a => a.side === side).map(a => `${a.node}x${a.units}${a.side === 'red' ? ':' + a.state : ''}`).join(',');

console.log('== 固定情境');
let g;
g = play([{ r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } }, { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } }, { b1: { type: 'strike', to: 'C2' } }]);
ok(g.status === 'blue_win' && g.prestige === 8 && g.lost.red === 3, '半渡而擊：藍勝、聲望 8 → ' + lastLog(g));
g = play([{ r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } }, { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } }, { r1: { type: 'move', to: 'C3' } }]);
ok(g.status === 'blue_win' && g.prestige === 10, '紅軍自己衝上有人守的河岸：藍勝、不扣聲望 → ' + lastLog(g));
ok(at(g, 'red') === 'C2x3:crossing', '敗退回河中 → ' + at(g, 'red'));
g = play([{ r1: { type: 'move', to: 'W1' }, b1: { type: 'move', to: 'W4' } }, { r1: { type: 'move', to: 'W2' } }, { r1: { type: 'move', to: 'W3' } }, { r1: { type: 'regroup' } }, { r1: { type: 'move', to: 'W4' } }]);
ok(g.status === 'red_win' && g.prestige === 10, '等列陣後決戰：藍軍覆沒、聲望 10 → ' + lastLog(g));
// 未成列時藍軍走進去打：扣聲望
g = play([{ r1: { type: 'move', to: 'W1' }, b1: { type: 'move', to: 'W4' } }, { r1: { type: 'move', to: 'W2' } }, { r1: { type: 'move', to: 'W3' } }, { r1: { type: 'regroup' }, b1: { type: 'move', to: 'W3' } }]);
ok(g.prestige === 8 && g.lost.red === 3 && /列陣被打斷/.test(lastLog(g)), '擊其未陣：扣聲望、列陣被打斷 → ' + lastLog(g));
// 對向而行必定相遇
g = play([{ r1: { type: 'move', to: 'W1' }, b1: { type: 'move', to: 'W4' } }, { r1: { type: 'move', to: 'W2' } }, { r1: { type: 'move', to: 'W3' } }, { r1: { type: 'regroup' } }, { r1: { type: 'move', to: 'W4' }, b1: { type: 'move', to: 'W3' } }]);
ok(/之戰/.test(lastLog(g)), '對向而行會相遇 → ' + lastLog(g));
// 途經點攔截
g = play([{ r1: { type: 'move', to: 'C1' } }, { r1: { type: 'move', to: 'C2' } }, { r1: { type: 'move', to: 'C3' } }, { r1: { type: 'regroup' } }, { r1: { type: 'move', to: 'H' }, b1: { type: 'move', to: 'C4' } }]);
ok(/中路之戰/.test(lastLog(g)), '直奔本陣在中路被攔 → ' + lastLog(g));
// 追不上：藍軍離開、紅軍才到
g = play([{ r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } }, { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } }, { r1: { type: 'move', to: 'C3' }, b1: { type: 'move', to: 'C4' } }]);
ok(!/之戰/.test(lastLog(g)) && at(g, 'red') === 'C3x6:disordered' && at(g, 'blue') === 'C4x3', '藍軍後撤一步，紅軍上岸，未接觸 → ' + at(g, 'red') + ' ' + at(g, 'blue'));
// 出擊撲空只有藍軍知道
g = play([{ b1: { type: 'move', to: 'C4' } }, { b1: { type: 'move', to: 'C3' } }, { b1: { type: 'strike', to: 'C2' } }]);
ok(R.viewFor(g, 'blue').log.at(-1).lines.some(t => /撲空/.test(t)) && !R.viewFor(g, 'red').log.at(-1).lines.some(t => /撲空/.test(t)) && !R.publicView(g).log.at(-1).lines.some(t => /撲空/.test(t)), '撲空訊息不外洩');
// 分兵訊息不外洩
g = play([{ r1: { type: 'move', to: 'C1', count: 2 } }]);
ok(!R.viewFor(g, 'blue').log.some(l => l.lines.some(t => /分兵/.test(t))) && !R.publicView(g).log.some(l => l.lines.some(t => /分兵/.test(t))) && at(g, 'red').split(',').length === 2, '分兵訊息只有本方看得到');
// 不合法命令
g = play([{ r1: { type: 'move', to: 'H' }, b1: { type: 'move', to: 'W5' } }, { r1: { type: 'regroup' }, b1: { type: 'strike', to: 'C2' } }, { r1: { type: 'move', to: 'C1', count: -3 }, b1: { type: 'move', to: 'C4', count: 0.4 } }]);
ok(at(g, 'red') === 'C1x6:formed' && at(g, 'blue') === 'C4x3', '不合法命令當作固守、兵數自動修正 → ' + at(g, 'red') + ' ' + at(g, 'blue'));
// 回合上限
g = play(Array(12).fill({}));
ok(g.status === 'blue_win' && g.turn === 12, '12 回合到，藍軍勝 → ' + g.result);
g = play(Array(5).fill({}), { maxTurns: 5, redUnits: 99, prestigeHit: 9, sightRange: 0 });
ok(g.status === 'blue_win' && g.cfg.redUnits === 12 && g.cfg.prestigeHit === 5 && g.cfg.sightRange === 1, '參數超出範圍會被夾住');

console.log('== 每個點位能去的地方都屬於本方');
for (const s of ['red', 'blue']) for (const [n, nb] of Object.entries(R.ADJ[s])) for (const t of Object.keys(nb)) {
  const good = R.NODES[t].side === 'both' || R.NODES[t].side === s || (s === 'red' && t === 'H');
  ok(good, `${s} ${n}→${t}`);
}

console.log('== 隨機對局');
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const SOUTH = ['S', 'W1', 'C1', 'E1'];
const stats = { games: 0, red: 0, blue: 0, battles: 0, cut: 0, turns: 0, p10win: 0 };
for (let n = 0; n < 30000; n++) {
  const opts = n % 3 ? {} : { redUnits: 2 + Math.floor(rnd() * 11), blueUnits: 1 + Math.floor(rnd() * 9), sightRange: 1 + Math.floor(rnd() * 4), strikeBonus: 1 + rnd() * 2, prestigeHit: Math.floor(rnd() * 6), maxTurns: 4 + Math.floor(rnd() * 20) };
  let g = R.newGame(opts);
  const total = { red: g.cfg.redUnits, blue: g.cfg.blueUnits };
  const aggressive = rnd() < 0.5;
  while (g.status === 'playing') {
    const orders = {};
    for (const a of g.armies) {
      let opts2 = R.legalOrders(g, a);
      if (aggressive) { const adv = opts2.filter(o => o.type !== 'hold'); if (adv.length && rnd() < 0.85) opts2 = adv; }
      const o = pick(opts2);
      orders[a.id] = { type: o.type, to: o.to, count: rnd() < 0.3 ? 1 + Math.floor(rnd() * a.units) : a.units };
    }
    const before = g;
    try { g = R.resolveTurn(g, orders); } catch (e) { ok(false, '結算丟出例外：' + e.message + JSON.stringify(orders)); break; }
    const ctx = () => ` | 前:${at(before, 'red')} / ${at(before, 'blue')} 令:${JSON.stringify(orders)} 後:${at(g, 'red')} / ${at(g, 'blue')} | ${lastLog(g)}`;
    stats.turns++;
    if (lastLog(g).includes('之戰')) stats.battles++;
    if (lastLog(g).includes('退路被截')) stats.cut++;
    for (const s of ['red', 'blue']) {
      const mine = g.armies.filter(a => a.side === s);
      ok(mine.every(a => Number.isInteger(a.units) && a.units >= 1), '兵力必須是正整數' + ctx());
      ok(mine.reduce((x, a) => x + a.units, 0) + g.lost[s] === total[s], `${s} 兵力守恆` + ctx());
      ok(new Set(mine.map(a => a.node)).size === mine.length, `${s} 同點應已合併` + ctx());
    }
    for (const a of g.armies) {
      if (a.side === 'blue') ok(!SOUTH.includes(a.node) && R.NODES[a.node].kind !== 'river', '藍軍不得渡河或到南岸' + ctx());
      else {
        ok((a.state === 'crossing') === (R.NODES[a.node].kind === 'river'), '紅軍在河中才是渡河中' + ctx());
        ok(a.state !== 'disordered' || !SOUTH.includes(a.node), '南岸不會有未成列' + ctx());
      }
      ok(Array.isArray(a.trail) && a.trail[a.trail.length - 1] === a.node, '行軍軌跡終點要等於所在點' + ctx());
    }
    if (g.status === 'playing') {
      for (const r of g.armies.filter(a => a.side === 'red')) for (const b of g.armies.filter(a => a.side === 'blue')) {
        ok(r.node !== b.node, '敵對部隊不得同處一點而不分勝負' + ctx());
        // 不得交錯而過：同一路線上，回合前紅在藍之南，回合後不得變成紅在藍之北
        for (const list of Object.values(R.ROUTES)) {
          const i = [r.trail[0], b.trail[0], r.node, b.node].map(x => list.indexOf(x));
          if (i.every(x => x >= 0)) ok(!(i[0] < i[1] && i[2] > i[3]), '部隊交錯而過' + ctx());
        }
      }
      // 視野對稱
      ok((R.visibleEnemies(g, 'red').length > 0) === (R.visibleEnemies(g, 'blue').length > 0), '看得見應該是互相的' + ctx());
    }
    ok(g.prestige <= before.prestige && g.prestige >= 0, '聲望只減不增' + ctx());
    ok(g.turn <= g.cfg.maxTurns, '不得超過回合上限' + ctx());
    for (const s of ['red', 'blue']) {
      const v = R.viewFor(g, s);
      ok(v.enemies.every(e => e.side !== s) && v.mine.every(e => e.side === s), '視圖分邊');
      if (g.status === 'playing') ok(v.ghosts.every(gh => !v.enemies.some(e => e.id === gh.id)), '看得見的敵軍不該同時有目擊標記');
      if (s === 'red' && g.status === 'playing') ok(v.prestige === null, '紅軍推演中看不到聲望');
    }
    if (g.status === 'playing') ok(R.publicView(g).armies.length === 0, '投影幕推演中不露兵力');
  }
  stats.games++; stats[g.status === 'red_win' ? 'red' : 'blue']++;
  if (g.status === 'blue_win' && g.prestige === g.cfg.prestige && g.lost.red >= R.redLoseAt(g.cfg)) stats.p10win++;
}
console.log(stats);
console.log(fails ? `✗ 有 ${fails} 項不符` : '✓ 全部通過');
process.exit(fails ? 1 : 0);
