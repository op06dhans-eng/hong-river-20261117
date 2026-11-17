import { newGame, resolveTurn, viewFor } from './rules.js';
const show = (g, t) => { console.log('==', t, '| turn', g.turn, g.status, g.result, '| 聲望', g.prestige); console.log(' ', g.armies.map(a => `${a.id}:${a.side}@${a.node}x${a.units}(${a.state})`).join('  ')); console.log('  log:', g.log.at(-1).lines.join(' / ')); };
function run(title, steps) {
  console.log('\n######', title);
  let g = newGame();
  for (const o of steps) { g = resolveTurn(g, o); show(g, ''); }
  return g;
}
// 1 宋襄公：等楚軍列陣再打
run('等成列', [
  { r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } },
  { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } },
  { r1: { type: 'hold' }, b1: { type: 'hold' } },
]);
// 2 半渡而擊
run('半渡而擊', [
  { r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } },
  { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } },
  { r1: { type: 'hold' }, b1: { type: 'strike', to: 'C2' } },
]);
// 3 既濟未成列：藍軍守在岸上，楚軍上岸
run('既濟未成列', [
  { r1: { type: 'move', to: 'C1' }, b1: { type: 'move', to: 'C4' } },
  { r1: { type: 'move', to: 'C2' }, b1: { type: 'move', to: 'C3' } },
  { r1: { type: 'move', to: 'C3' }, b1: { type: 'hold' } },
]);
// 4 楚軍上岸後列陣，藍軍按兵不動（宋襄公），再打
run('列陣後決戰', [
  { r1: { type: 'move', to: 'W1' }, b1: { type: 'move', to: 'W4' } },
  { r1: { type: 'move', to: 'W2' }, b1: { type: 'hold' } },
  { r1: { type: 'move', to: 'W3' }, b1: { type: 'hold' } },
  { r1: { type: 'regroup' }, b1: { type: 'hold' } },
  { r1: { type: 'move', to: 'W4' }, b1: { type: 'hold' } },
]);
// 5 分兵、東路攔截
const g = run('分兵＋攔截', [
  { r1: { type: 'move', to: 'C1', count: 3 }, b1: { type: 'move', to: 'E4' } },
  { r2: { type: 'move', to: 'E1' }, r1: { type: 'move', to: 'W1' }, b1: { type: 'move', to: 'E3' } },
  { r2: { type: 'move', to: 'E2' }, r1: { type: 'move', to: 'W2' }, b1: { type: 'strike', to: 'E2' } },
]);
console.log(JSON.stringify(viewFor(g, 'red'), null, 0).slice(0, 600));
// 6 擦身：紅 C3→H 經過 C4，藍 H→C4
run('攔截中路', [
  { r1: { type: 'move', to: 'C1' }, b1: { type: 'hold' } },
  { r1: { type: 'move', to: 'C2' }, b1: { type: 'hold' } },
  { r1: { type: 'move', to: 'C3' }, b1: { type: 'hold' } },
  { r1: { type: 'regroup' }, b1: { type: 'hold' } },
  { r1: { type: 'move', to: 'H' }, b1: { type: 'move', to: 'C4' } },
]);
