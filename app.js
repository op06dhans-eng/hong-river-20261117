import * as R from './rules.js?v=8';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const role = params.get('role');            // red | blue | ref | screen
let room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const SIDE_NAME = { red: '紅軍', blue: '藍軍', ref: '裁判', screen: '投影' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const parse = v => (v == null ? null : typeof v === 'string' ? JSON.parse(v) : v);
const NN = n => R.NODES[n].name;

// ====================== 同步層 ======================
async function makeBackend() {
  const cfg = window.FIREBASE_CONFIG;
  if (cfg) {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getDatabase, ref, onValue, set } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
    const db = getDatabase(initializeApp(cfg));
    return {
      mode: 'firebase',
      set: (p, v) => set(ref(db, `hong/${room}/${p}`), v ?? null),
      on: (p, cb) => onValue(ref(db, `hong/${room}/${p}`), s => cb(s.val())),
    };
  }
  const bc = new BroadcastChannel('hong-river');
  const key = p => `hong:${room}:${p}`;
  const subs = {};
  const read = p => { const v = localStorage.getItem(key(p)); return v == null ? null : JSON.parse(v); };
  const fire = p => (subs[p] || []).forEach(cb => cb(read(p)));
  bc.onmessage = e => { if (e.data.room === room) fire(e.data.p); };
  addEventListener('storage', e => { const pre = `hong:${room}:`; if (e.key && e.key.startsWith(pre)) fire(e.key.slice(pre.length)); });
  return {
    mode: 'local',
    set: (p, v) => { localStorage.setItem(key(p), JSON.stringify(v ?? null)); bc.postMessage({ room, p }); fire(p); return Promise.resolve(); },
    on: (p, cb) => { (subs[p] ||= []).push(cb); cb(read(p)); },
  };
}

// ====================== 首頁 ======================
if (!['red', 'blue', 'ref', 'screen'].includes(role) || (!room && role !== 'ref')) {
  document.getElementById('loading')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
  <div id="home"><div class="card">
    <h1>無名之戰</h1><div class="muted">雙盲推演．紅軍渡河，藍軍守國</div>
    <p style="margin-top:16px">同學請掃描老師畫面上的 QR 碼。或輸入房號：</p>
    <input id="hroom" placeholder="房號（四碼）" maxlength="8" autocapitalize="characters">
    <div class="row"><button class="btn" id="hr" style="flex:1;background:var(--red);color:#fff;border-color:var(--red)">加入紅軍</button>
    <button class="btn" id="hb" style="flex:1;background:var(--blue);color:#fff;border-color:var(--blue)">加入藍軍</button></div>
    <div class="hline"></div>
    <button class="btn main" id="hk">我是老師：開一局新推演</button>
  </div></div>`);
  const go = r => { const code = $('#hroom').value.trim().toUpperCase(); if (!code) { $('#hroom').focus(); $('#hroom').placeholder = '請先輸入房號'; return; } location.search = `?role=${r}&room=${encodeURIComponent(code)}`; };
  $('#hr').onclick = () => go('red'); $('#hb').onclick = () => go('blue');
  $('#hk').onclick = () => { location.search = '?role=ref'; };
  throw new Error('home');
}
if (role === 'ref' && !room) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  room = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  history.replaceState(null, '', `?role=ref&room=${room}`);
}
document.body.classList.add('role-' + role);

// ====================== 立體場景（world.js） ======================
const THREE = window.THREE;
const COLORS = { red: '#b3261e', blue: '#1f4e9c' };
const VIEW_SIDE = role === 'blue' ? 'blue' : 'red';
bootScene();
const canvas = SCN.canvas;
const NODE_IDS = Object.keys(R.NODES);
const wp = id => { const n = RULES.NODES[id]; return new THREE.Vector3(n.x, Math.max(SCN.H(n.x, n.z), 0.05), n.z); };

// 點位名稱放在點位下方，才不會和部隊標籤疊在一起；與點位同名的地名不重複顯示
for (const k of NODE_IDS) { const L = SCN.NODE_MARK[k].lab; L.below = true; L.pos.y -= 2.0; SCN.NODE_MARK[k].ring.material.opacity = 0; }
{ const names = new Set(NODE_IDS.map(NN)); for (const L of SCN.labels) if (L.cls === 'place' && names.has(L.text)) L.show = false; }

// 鏡頭：紅軍從南往北看，藍軍從北往南看
const TH = VIEW_SIDE === 'blue' ? Math.PI : 0;
function focusNodes(ids, instant) {
  ids = ids.filter(n => R.NODES[n]);
  if (!ids.length) return;
  const ps = ids.map(wp);
  const xs = ps.map(p => p.x), zs = ps.map(p => p.z);
  const c = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const wx = Math.max(...xs) - Math.min(...xs) + 40, wz = Math.max(...zs) - Math.min(...zs) + 30;
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  // 視角約 42 度、俯角固定：依畫面長寬算出剛好放得下的距離
  const r = Math.max(48, Math.min(300, Math.max(wz * 0.95, wx / aspect * 1.25)));
  SCN.flyOrbit({ target: new THREE.Vector3(c.x, 0, c.z), r, th: TH, ph: 0.85 }, instant);
}
function resetCamera(instant) { focusNodes(NODE_IDS, instant); }

// ---------- 部隊 ----------
// 步卒與戰車模型移植自《陣法立體版》。每個兵力單位畫 12 名步卒，每支部隊前面一乘將車（圖示，算法等同步兵）
const PER_UNIT = 12;
function infOffs(n, disorder) {
  const cols = Math.min(12, n), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols;
    const j = disorder ? 0.55 : 0.08, h = k => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return (v - Math.floor(v) - .5) * 2 * j; };
    out.push([(c - (inRow - 1) / 2) * 0.72 + h(1), -1.6 - r * 0.85 + h(2)]);
  }
  return out;
}
function tok(a, kind, animate) {
  const ch = a.side === 'red' ? '紅' : '藍';
  const weak = a.side === 'red' && a.state && a.state !== 'formed';
  const ghost = kind === 'ghost', fallen = kind === 'fallen';
  const label = ghost ? `${ch} ${a.units}？ 第${a.turn}回合目擊` : fallen ? `${ch} ${a.units} 潰散` : `${ch} ${a.units}${weak ? ' ' + R.STATE_LABEL[a.state] : ''}`;
  const trail = animate && !ghost && a.trail && a.trail.length > 1 ? a.trail : null;
  return {
    key: (ghost ? 'g' : 'a') + a.id, side: a.side, type: 'zinf_' + a.side, s: a.units * 100 + (weak ? 1 : 0), pos: { n: a.node },
    path: trail ? trail.slice(1, -1).map(n => ({ n })) : [], from: trail ? { n: trail[0] } : null,
    offs: infOffs(a.units * PER_UNIT, weak), extra: { type: 'zchr_' + a.side, offs: [[0, 1.4]] },
    label, labelCls: ghost ? 'ghost' : fallen ? 'ghost' : '', ghost, mine: a.side === VIEW_SIDE,
  };
}
// data: { armies, ghosts, fallen }；animate＝播放這回合的行軍（含戰敗退回、潰散的部隊先走到交戰點再消失）
let sceneGen = 0;
function syncScene(data, animate) {
  const gen = ++sceneGen;
  const live = [...data.armies.map(a => tok(a, 'live', animate)), ...(data.ghosts || []).map(a => tok(a, 'ghost', false))];
  const fallen = animate ? (data.fallen || []).map(a => tok(a, 'fallen', true)) : [];
  SCN.setUnits([...live, ...fallen], animate);
  if (fallen.length) setTimeout(() => { if (gen === sceneGen) SCN.setUnits(live.map(d => ({ ...d, path: [], from: null })), false); }, 3700);
}
function battleBursts(lines) {
  for (const t of lines) { const m = String(t).match(/^【(.+)之戰】/); if (!m) continue; const id = NODE_IDS.find(k => NN(k) === m[1]); if (id) SCN.battleFx(id, m[1] + '接戰'); }
}

// ---------- 點位標記與命令箭頭 ----------
const MK_COL = { here: '#ffd23f', move: '#2ee86b', attack: '#ff5a1f', idle: '#ffffff', red: '#ff4a3d', blue: '#4a9bff', both: '#f0c040' };
const markLayer = new THREE.Group(); SCN.scene.add(markLayer);
const arrowLayer = new THREE.Group(); SCN.scene.add(arrowLayer);
const bobbers = [], flows = [];
const clearLayer = L => L.children.slice().forEach(o => { L.remove(o); o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); });
// map: { 點位: 'here' | 'move' | 'attack' | 'idle' | 'red' | 'blue' | 'both' }
function drawMarkers(map) {
  clearLayer(markLayer); bobbers.length = 0;
  for (const k of NODE_IDS) {
    const st = map[k], L = SCN.NODE_MARK[k].lab;
    L.show = !!st; L.must = st === 'here' || st === 'move' || st === 'attack'; L.prio = st === 'move' || st === 'attack' ? 7 : st === 'here' ? 6 : 5;
    if (L.d) L.d.className = 'lab node ' + (st || '');
    if (!st) continue;
    const p = wp(k), col = MK_COL[st], strong = st === 'here' || st === 'move' || st === 'attack';
    const g = new THREE.Group(); g.position.set(p.x, p.y + 0.35, p.z);
    const ringG = new THREE.RingGeometry(strong ? 3.4 : 3.0, strong ? 5.8 : 4.8, 48); ringG.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide, fog: false }));
    ring.renderOrder = 20; g.add(ring);
    // 深色外緣，讓圈在草地和油畫濾鏡上都看得清楚
    const rimG = new THREE.RingGeometry(strong ? 5.8 : 4.8, strong ? 6.5 : 5.4, 48); rimG.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimG, new THREE.MeshBasicMaterial({ color: '#1d140c', transparent: true, opacity: 0.75, depthTest: false, side: THREE.DoubleSide, fog: false }));
    rim.renderOrder = 20; ring.add(rim);
    const discG = new THREE.CircleGeometry(strong ? 3.4 : 3.0, 40); discG.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: strong ? 0.28 : 0.12, depthTest: false, fog: false }));
    disc.renderOrder = 19; g.add(disc);
    if (st === 'move' || st === 'attack') {
      // 目標點上方浮動的菱形指標（不做直衝天際的光柱）
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), new THREE.MeshBasicMaterial({ color: col, depthTest: false, fog: false }));
      gem.scale.set(1, 1.6, 1); gem.position.y = 6; gem.renderOrder = 21; g.add(gem);
      bobbers.push({ gem, ring });
    }
    markLayer.add(g);
  }
  SCN.dirty();
}
// items: [{ from, to, side, strike }]
function drawArrows(items) {
  clearLayer(arrowLayer); flows.length = 0;
  const flat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, fog: false });
  for (const it of items) {
    if (!R.NODES[it.from] || !R.NODES[it.to]) continue;
    const A = wp(it.from), B = wp(it.to);
    const dir = B.clone().sub(A); dir.y = 0; const len = dir.length(); dir.normalize();
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const d0 = Math.min(3, len * 0.15), d1 = len - Math.min(7, len * 0.3);
      const t = i / 24, d = d0 + (d1 - d0) * t, x = A.x + dir.x * d, z = A.z + dir.z * d;
      pts.push(new THREE.Vector3(x, Math.max(SCN.H(x, z), 0.05) + 2.2 + Math.sin(t * Math.PI) * 3.5, z));
    }
    const col = it.strike ? MK_COL.attack : MK_COL[it.side];
    const g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(pts);
    const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 1.15, 8), flat('#ffffff')); edge.renderOrder = 22; g.add(edge);
    const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.8, 8), flat(col)); body.renderOrder = 23; g.add(body);
    const end = pts[pts.length - 1], dirE = end.clone().sub(pts[pts.length - 3]).normalize();
    const headE = new THREE.Mesh(new THREE.ConeGeometry(3.0, 6.0, 16), flat('#ffffff'));
    headE.position.copy(end); headE.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirE); headE.renderOrder = 22; g.add(headE);
    const head = new THREE.Mesh(new THREE.ConeGeometry(2.3, 5.0, 16), flat(col));
    head.position.copy(end).addScaledVector(dirE, 0.3); head.quaternion.copy(headE.quaternion); head.renderOrder = 23; g.add(head);
    const chev = [];
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 10), flat('#ffffff')); c.renderOrder = 24; g.add(c); chev.push(c); }
    flows.push({ pts: curve.getPoints(80), chev });
    arrowLayer.add(g);
  }
  SCN.dirty();
}
(function anim(t) {
  requestAnimationFrame(anim);
  if (!bobbers.length && !flows.length) return;
  const s = t / 1000, up = new THREE.Vector3(0, 1, 0);
  for (const b of bobbers) { b.ring.scale.setScalar(1 + 0.12 * Math.sin(s * 4)); b.gem.position.y = 6 + Math.sin(s * 3) * 0.8; b.gem.rotation.y = s * 1.5; }
  for (const f of flows) f.chev.forEach((c, i) => {
    const u = (s * 0.35 + i / f.chev.length) % 1, k = Math.floor(u * (f.pts.length - 1));
    c.position.copy(f.pts[k]); c.quaternion.setFromUnitVectors(up, f.pts[Math.min(k + 1, f.pts.length - 1)].clone().sub(f.pts[Math.max(k - 1, 0)]).normalize());
  });
  SCN.dirty();
})(0);
const myNodes = side => NODE_IDS.filter(n => R.NODES[n].side === side || R.NODES[n].side === 'both');
const allNodeMarks = () => Object.fromEntries(NODE_IDS.map(n => [n, n === 'H' ? 'blue' : n === 'S' ? 'red' : R.NODES[n].side]));

let onNodeTap = null;
SCN.onNodeClick = n => { if (R.NODES[n]) onNodeTap?.(n); };

// ---------- 版面：地圖只佔面板以外的區域，面板不蓋住戰場 ----------
let lastW = 0, lastH = 0;
function resize() {
  const dock = $('#panel,#refbox,#screenbox');
  let w = innerWidth, h = innerHeight, dr = 0;
  if (dock && getComputedStyle(dock).display !== 'none') {
    const r = dock.getBoundingClientRect();
    if (r.height >= innerHeight - 2 && r.width < innerWidth - 60) { dr = Math.round(r.width); w -= dr; } else h -= Math.round(r.height);
  }
  document.body.style.setProperty('--dockR', dr + 'px');
  window.LABEL_RESERVED = [[0, 0, w, 46]];
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const lab = $('#labels'); lab.style.width = w + 'px'; lab.style.height = h + 'px';
  SCN.resize();
}
addEventListener('resize', resize);
const dockWatch = new ResizeObserver(() => resize());
let sty = 'B'; try { sty = localStorage.getItem('hong-style') || 'B'; } catch (e) { }
SCN.start(); if (sty === 'D') SCN.applyStyle('D');
resize(); resetCamera(true);
document.getElementById('loading')?.remove();

// ====================== 共用介面 ======================
function topBar(extra = '') {
  $('#top').innerHTML = `<span class="side ${role === 'red' || role === 'blue' ? role : 'ref'}">${SIDE_NAME[role]}</span>
    <span class="room">房號 <b>${esc(room)}</b></span><span class="grow"></span>${extra}
    <button id="sty">換畫風</button><button id="cam">全圖</button>`;
  $('#cam').onclick = () => resetCamera();
  $('#sty').onclick = () => { const k = document.body.dataset.style === 'B' ? 'D' : 'B'; SCN.applyStyle(k); try { localStorage.setItem('hong-style', k); } catch (e) { } };
}
function modal(html, onClose) {
  document.querySelectorAll('.modal').forEach(m => m.remove());
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card">${html}<button class="btn main" style="margin-top:12px">知道了</button></div>`;
  m.querySelector('.btn.main').onclick = () => { m.remove(); onClose?.(); };
  document.body.appendChild(m);
}
function confirmBox(text, yes) {
  document.querySelectorAll('.modal').forEach(m => m.remove());
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><p style="font-size:16px">${esc(text)}</p><div class="row" style="margin-top:12px"><button class="btn main" id="cy" style="flex:1;margin:0">確定</button><button class="btn" id="cn" style="flex:1;padding:12px">取消</button></div></div>`;
  m.querySelector('#cy').onclick = () => { m.remove(); yes(); };
  m.querySelector('#cn').onclick = () => m.remove();
  document.body.appendChild(m);
}
function toast(t, ms = 2200) {
  let d = $('#toast'); if (!d) { d = document.createElement('div'); d.id = 'toast'; document.body.appendChild(d); }
  d.textContent = t; d.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => d.style.display = 'none', ms);
}
function prestigeBar(p, max) {
  let h = '<span class="pbar">';
  for (let i = 0; i < max; i++) h += `<i class="${i < p ? (p <= max * 0.6 ? 'on low' : 'on') : ''}"></i>`;
  return h + `</span><b class="pnum ${p <= max * 0.6 ? 'low' : ''}">國君聲望 ${p}／${max}</b>`;
}
function logHtml(log) {
  return log.map(l => `<div class="log-turn">第 ${l.turn} 回合</div>${l.lines.map(x => `<p>${esc(x.t ?? x)}</p>`).join('')}`).join('') || '<p class="muted">尚無紀錄。</p>';
}
function orderText(o, a) {
  if (!o || o.type === 'hold') return '原地固守';
  if (o.type === 'regroup') return '重新列陣';
  const n = o.count && o.count < a.units ? `（派 ${o.count}，留 ${a.units - o.count}）` : '';
  return (o.type === 'strike' ? `出擊${NN(o.to)}` : `前往${NN(o.to)}`) + n;
}
const stBadge = a => a.side === 'red' ? `<span class="badge ${a.state !== 'formed' ? 'warn' : ''}">${R.STATE_LABEL[a.state]}</span>` : '';
// 推演結束才揭曉是哪一場戰役
const REVEAL = `<div class="reveal"><h2>揭曉：這是泓之戰</h2>
  <p>西元前 638 年（魯僖公二十二年），楚國伐宋以救鄭，宋襄公迎戰於泓水。<b>紅軍是楚，藍軍是宋，藍軍國君就是宋襄公。</b></p>
  <p class="yw">「宋人既成列，楚人未既濟。司馬曰：『彼眾我寡，及其未既濟也，請擊之。』公曰：『不可。』既濟而未成列，又以告。公曰：『未可。』既陳而後擊之，宋師敗績。」（《左傳・僖公二十二年》）</p>
  <p class="muted">白話：宋軍已經列好陣，楚軍還沒渡完河。司馬子魚說：「敵眾我寡，趁他們還沒渡完，請下令攻擊。」襄公說：「不行。」楚軍渡完河還沒列陣，子魚又請戰，襄公說：「還不行。」等楚軍列好陣才進攻，宋軍大敗。</p>
  <p>想一想：剛才你們的藍軍在哪一刻出手？和宋襄公的選擇一樣嗎？如果「打贏」和「聲望滿分」只能選一個，你會選哪個？宋襄公又為什麼這樣選？</p></div>`;
// 須知的數字一律取自這一局的參數
function helpHtml(side, c) {
  const pct = Math.round(c.disorderFactor * 100);
  const common = `<p>• 每回合每支部隊可移動一格（一個圈到相鄰的圈），也可以分兵。</p>
    <p>• 只看得到同一條路線上相距 ${c.sightRange} 格以內的敵軍；看不到不代表沒有。</p>
    <p>• 送出命令後，要等老師結算，雙方才會<b>同時</b>行動。</p>`;
  if (side === 'red') return `<h2>你是紅軍</h2>
    <p>你率紅軍 ${c.redUnits} 個單位自南方來，必須渡過南河。<b>任何一支部隊攻入藍軍本陣就獲勝。</b></p>${common}
    <p>• 站在渡口（河中）時戰力只剩 ${pct}%；上岸後也只有 ${pct}%，要按「重新列陣」原地停一回合才恢復。列陣時被攻擊，列陣會被打斷。</p>
    <p>• 折損 ${R.redLoseAt(c)} 個單位就算戰敗；第 ${c.maxTurns} 回合結束還沒攻入藍軍本陣，也算戰敗。</p>`;
  return `<h2>你是藍軍</h2>
    <p>你率藍軍 ${c.blueUnits} 個單位守國都，敵眾我寡。<b>讓紅軍折損 ${R.redLoseAt(c)} 個單位，或守到第 ${c.maxTurns} 回合結束，就獲勝。</b></p>${common}
    <p>• 你只能在北岸行動，不渡河。</p>
    <p>• 紅軍在河中或上岸還沒列陣時，戰力只剩 ${pct}%，而你打這種敵人戰力 ×${c.strikeBonus}。站在河岸點可以「出擊」對岸渡口。</p>
    <p>• 紅軍列好陣後和你正面交戰，你多半打不過。</p>
    <p>• <b>聲望</b>：你是以諸侯盟主自居的國君，聲望滿分 ${c.prestige}。<b>主動攻擊</b>還在渡河、或上岸還沒列陣的紅軍（「出擊」渡口，或走進他們所在的點位），就算打贏，也會被諸侯議論不仁，每次交戰聲望 −${c.prestigeHit}。紅軍自己衝上你守住的點位則不扣。結算時同時看<b>戰果</b>與<b>聲望</b>。</p>`;
}

const be = await makeBackend();
if (be.mode === 'local') document.body.insertAdjacentHTML('beforeend', '<div id="banner">單機測試模式</div>');

// ====================== 學生（紅／藍） ======================
if (role === 'red' || role === 'blue') {
  const side = role;
  topBar('<button id="logb">戰報</button><button id="helpb">規則</button><button id="mineb">我軍</button>');
  $('#ui').innerHTML = '<div id="panel"><div class="muted">連線中…</div></div>';
  dockWatch.observe($('#panel'));
  let view = null, draft = {}, sel = null, submitted = null, pendingT = 0, helped = false;

  const reach = a => [a.node, ...R.legalOrders(null, a).filter(o => o.to).map(o => o.to)];
  const focusMine = instant => view && view.mine.length && focusNodes(view.mine.flatMap(reach), instant);
  const focusSel = () => { const a = view.mine.find(x => x.id === sel); if (a) focusNodes(reach(a)); };
  const showHelp = () => view && modal(helpHtml(side, view.cfg));
  $('#mineb').onclick = () => focusMine();
  $('#logb').onclick = () => view && modal(`<h2>戰報</h2>${logHtml(view.log)}`);
  $('#helpb').onclick = showHelp;

  be.on(`view/${side}`, v => {
    v = parse(v);
    if (!v || v.ver !== R.VERSION) { $('#panel').innerHTML = '<div class="muted">等待老師開局…（如果老師已經開局，請重新整理這個頁面）</div>'; resize(); return; }
    const prev = view; view = v;
    const first = !prev;
    const rewound = prev && (v.turn < prev.turn || (prev.status !== 'playing' && v.status === 'playing'));
    const advanced = prev && !rewound && (v.turn > prev.turn || (prev.status === 'playing' && v.status !== 'playing'));
    if (first || rewound || advanced) { draft = {}; sel = null; }
    if (submitted && submitted.turn === v.turn && v.status === 'playing' && !Object.keys(draft).length) draft = structuredClone(submitted.orders || {});
    syncScene({ armies: [...v.mine, ...v.enemies], ghosts: v.ghosts.map(gh => ({ ...gh, side: side === 'red' ? 'blue' : 'red' })), fallen: v.fallen }, !!advanced);
    render();
    clearTimeout(pendingT);
    if (first) {
      focusMine(true);
      try { if (!localStorage.getItem(`hong-help-${side}-${room}`)) { localStorage.setItem(`hong-help-${side}-${room}`, '1'); helped = true; setTimeout(showHelp, 300); } } catch (e) { }
      if (!helped && v.status !== 'playing') modal(`<h2>${esc(v.result)}</h2>${logHtml(v.log.slice(-1))}${REVEAL}`);
    } else if (rewound) {
      document.querySelectorAll('.modal').forEach(m => m.remove());
      toast('老師已重新開局或回到上一回合'); focusMine();
    } else if (advanced) {
      const rep = v.log.filter(l => l.turn === prev.turn), lines = rep.flatMap(l => l.lines);
      const battle = lines.some(t => /之戰】|潰散/.test(t));
      setTimeout(() => battleBursts(lines), 1500);
      // 先讓大家看完行軍，再跳出戰報，不擋住戰場
      if (v.status !== 'playing') pendingT = setTimeout(() => modal(`<h2>${esc(v.result)}</h2><p class="muted">地圖上已顯示雙方全部位置。</p>${logHtml(rep)}${REVEAL}`), 3900);
      else if (battle) pendingT = setTimeout(() => modal(`<h2>第 ${prev.turn} 回合戰報</h2>${logHtml(rep)}`, () => focusMine()), 3900);
      else { toast(`第 ${prev.turn} 回合：${lines.find(t => !/分兵/.test(t)) || '沒有發現敵軍'}`, 3200); pendingT = setTimeout(() => focusMine(), 2600); }
    }
  });
  be.on(`orders/${side}`, v => {
    submitted = parse(v);
    if (view && submitted && submitted.turn === view.turn && !Object.keys(draft).length) draft = structuredClone(submitted.orders || {});
    render();
  });

  onNodeTap = n => {
    if (!view || view.status !== 'playing') return;
    const sa = view.mine.find(x => x.id === sel);
    const o = sa && R.legalOrders(null, sa).find(x => x.to === n);
    if (o) { setOrder(sa, o); return; }
    const mine = view.mine.find(x => x.node === n);
    if (mine) { sel = mine.id; render(); focusSel(); return; }
    sel = null; render();
  };
  function setOrder(a, o) {
    if (o.type === 'hold') delete draft[a.id];
    else if (o.type === 'regroup') draft[a.id] = { type: 'regroup' };
    else { const keep = draft[a.id]; draft[a.id] = { type: o.type, to: o.to, count: keep && keep.type === o.type && keep.to === o.to ? keep.count : a.units }; }
    render();
  }
  const sameOrders = (x, y) => JSON.stringify(Object.entries(x || {}).sort()) === JSON.stringify(Object.entries(y || {}).sort());

  function render() {
    if (!view) return;
    const playing = view.status === 'playing';
    const sub = playing && submitted && submitted.turn === view.turn;
    const changed = sub && !sameOrders(draft, submitted.orders);
    const sa = playing ? view.mine.find(a => a.id === sel) : null;
    // 地圖標記
    const mk = {};
    if (playing) {
      for (const n of myNodes(side)) mk[n] = 'idle';
      for (const a of view.mine) mk[a.node] = 'here';
      if (sa) for (const o of R.legalOrders(null, sa)) if (o.to) mk[o.to] = o.type === 'strike' ? 'attack' : 'move';
    } else Object.assign(mk, allNodeMarks());
    drawMarkers(mk);
    drawArrows(playing ? view.mine.filter(a => draft[a.id]?.to).map(a => ({ from: a.node, to: draft[a.id].to, side, strike: draft[a.id].type === 'strike' })) : []);
    // 面板
    const c = view.cfg;
    let h = `<div class="phead"><b>第 ${view.turn}／${c.maxTurns} 回合</b><span class="muted">${side === 'red' ? `已折損 ${view.lost.red}（滿 ${R.redLoseAt(c)} 即敗）` : `紅軍已折損 ${view.lost.red}／${R.redLoseAt(c)}，我軍折損 ${view.lost.blue}`}</span></div>`;
    if (view.prestige != null) h += `<div class="prest">${prestigeBar(view.prestige, c.prestige)}</div>`;
    if (!playing) {
      h += `<p class="result"><b>${esc(view.result)}</b></p><button class="btn main" id="again">看結果與揭曉</button>`;
      $('#panel').innerHTML = h; resize();
      $('#again').onclick = () => modal(`<h2>${esc(view.result)}</h2>${logHtml(view.log.slice(-1))}${REVEAL}`);
      return;
    }
    h += '<div class="chips">';
    for (const a of view.mine) h += `<div class="chip ${a.id === sel ? 'sel' : ''}" data-id="${a.id}"><b>${NN(a.node)}</b>　${a.units} 單位${stBadge(a)}<br><span class="ord">命令：${orderText(draft[a.id], a)}</span></div>`;
    if (!view.mine.length) h += '<span class="muted">你已沒有部隊。</span>';
    h += '</div>';
    if (sa) {
      const o = draft[sa.id] || { type: 'hold' };
      const short = x => x.type === 'hold' ? '固守' : x.type === 'regroup' ? '重新列陣' : x.type === 'strike' ? `出擊${NN(x.to)}（聲望−${c.prestigeHit}）` : `→ ${NN(x.to)}`;
      h += `<div class="opts">${R.legalOrders(null, sa).map((x, i) => `<button data-i="${i}" class="${x.type === o.type && x.to === o.to ? 'on' : ''} ${x.type === 'strike' ? 'strike' : ''}">${esc(short(x))}</button>`).join('')}</div>`;
      if (o.to && sa.units > 1) {
        const n = o.count || sa.units;
        h += `<div class="count">派出 <button data-c="-1">－</button><b>${n}</b><button data-c="1">＋</button> <span class="muted">${n < sa.units ? `其餘 ${sa.units - n} 個單位留守` : '全軍出動'}</span></div>`;
      }
    } else if (view.mine.length) h += '<div class="muted hint">點部隊（上面的卡片，或地圖上的黃圈）再選去處。白圈是你能走的點位，綠圈是這支部隊現在能去的地方。</div>';
    h += `<button class="btn main ${sub && !changed ? 'sent' : ''}" id="send">${!sub ? '送出本回合命令' : changed ? '命令有修改：重新送出' : '✓ 已送出（可修改後再送）'}</button>`;
    if (sub && !changed) h += '<div class="waitnote">命令已送達。<b>老師結算後，雙方部隊才會同時行動</b>，在那之前部隊會留在原地。</div>';
    $('#panel').innerHTML = h;
    resize();
    $('#panel').querySelectorAll('.chip').forEach(el => el.onclick = () => { sel = sel === el.dataset.id ? null : el.dataset.id; render(); if (sel) focusSel(); else focusMine(); });
    $('#panel').querySelectorAll('.opts button').forEach(el => el.onclick = () => setOrder(sa, R.legalOrders(null, sa)[+el.dataset.i]));
    $('#panel').querySelectorAll('.count button').forEach(el => el.onclick = () => { const o = draft[sa.id]; o.count = Math.max(1, Math.min(sa.units, (o.count || sa.units) + +el.dataset.c)); render(); });
    $('#send').onclick = async () => {
      const clean = {};
      for (const a of view.mine) { const o = draft[a.id]; if (o) clean[a.id] = { type: o.type, ...(o.to ? { to: o.to, count: o.count || a.units } : {}) }; }
      const turn = view.turn;
      try { await be.set(`orders/${side}`, JSON.stringify({ turn, orders: clean, at: Date.now() })); sel = null; render(); toast('✓ 命令已送出'); focusMine(); }
      catch (e) { toast('送出失敗，請檢查網路後再試一次', 4000); }
    };
  }
}

// ====================== 裁判 ======================
if (role === 'ref') {
  topBar('<button id="hide">收合面板</button>');
  $('#ui').innerHTML = '<div id="refbox"></div>';
  dockWatch.observe($('#refbox')); resize(); resetCamera(true);
  let game = null, shown = null, ord = { red: null, blue: null }, hist = [], showQR = true, autoRes = false, busy = false, autoT = 0;
  try { autoRes = localStorage.getItem('hong-auto') === '1'; } catch (e) { }
  $('#hide').onclick = () => { const b = $('#refbox'), off = b.style.display === 'none'; b.style.display = off ? '' : 'none'; $('#hide').textContent = off ? '收合面板' : '顯示面板'; resize(); };

  const base = location.href.split('?')[0];
  const link = r => `${base}?role=${r}&room=${room}`;
  const qr = txt => { const q = qrcode(0, 'M'); q.addData(txt); q.make(); return q.createSvgTag({ cellSize: 3, margin: 1 }); };

  async function publish(g, pushHist = true) {
    if (pushHist && game) hist = [...hist, game].slice(-30);
    game = g;
    await be.set('history', JSON.stringify(hist));
    await be.set('view/red', JSON.stringify(R.viewFor(g, 'red')));
    await be.set('view/blue', JSON.stringify(R.viewFor(g, 'blue')));
    await be.set('view/public', JSON.stringify(R.publicView(g)));
    await be.set('full', JSON.stringify(g));
  }
  be.on('history', v => { hist = parse(v) || []; });
  let started = false;
  be.on('full', v => {
    v = parse(v);
    if (!v && !started) { started = true; publish(R.newGame(), false); return; }
    started = true;
    if (!v) return;
    if (v.ver !== R.VERSION) { toast('這個房號留有舊版的戰局，已自動重新開局', 4000); restart({}); return; }
    game = v;
    const advanced = shown && v.log.length > shown.log.length;
    syncScene({ armies: v.armies, fallen: v.fallen }, !!advanced);
    if (advanced) { const lines = v.log.at(-1).lines.map(x => x.t); setTimeout(() => battleBursts(lines), 1500); }
    shown = v;
    render();
  });
  be.on('orders/red', v => { ord.red = parse(v); render(); });
  be.on('orders/blue', v => { ord.blue = parse(v); render(); });

  function cur(s) { return game && ord[s] && ord[s].turn === game.turn ? ord[s] : null; }
  async function resolve() {
    if (busy || !game || game.status !== 'playing') return;
    busy = true; clearTimeout(autoT);
    try { await publish(R.resolveTurn(game, { ...(cur('red')?.orders || {}), ...(cur('blue')?.orders || {}) })); }
    catch (e) { toast('結算失敗：' + e.message, 5000); }
    busy = false; render();
  }
  async function restart(opts) {
    hist = []; clearTimeout(autoT);
    await be.set('orders/red', null); await be.set('orders/blue', null);
    shown = null;
    await publish(R.newGame(opts), false);
    toast('已重新開局');
  }

  function render() {
    if (!game) return;
    const playing = game.status === 'playing', c = game.cfg;
    drawMarkers(allNodeMarks());
    const arrows = [];
    for (const s of ['red', 'blue']) {
      const o = playing && cur(s); if (!o) continue;
      for (const [id, x] of Object.entries(o.orders || {})) { const a = game.armies.find(y => y.id === id && y.side === s); if (a && x.to && R.legalOrders(null, a).some(l => l.to === x.to && l.type === x.type)) arrows.push({ from: a.node, to: x.to, side: s, strike: x.type === 'strike' }); }
    }
    drawArrows(arrows);
    const armyList = s => game.armies.filter(a => a.side === s).map(a => {
      const o = cur(s)?.orders?.[a.id];
      return `<div class="arow"><b>${NN(a.node)}</b> ${a.units} 單位${stBadge(a)}${playing ? `<span class="ord">${cur(s) ? orderText(o, a) : '尚未下令'}</span>` : ''}</div>`;
    }).join('') || '<div class="muted">已無部隊</div>';
    const both = cur('red') && cur('blue');
    let h = `<div class="row" style="justify-content:space-between"><b style="font-size:18px">第 ${game.turn}／${c.maxTurns} 回合</b><span class="muted">紅軍折損 ${game.lost.red}／${R.redLoseAt(c)}　藍軍折損 ${game.lost.blue}</span></div>
      <div class="prest">${prestigeBar(game.prestige, c.prestige)}</div>`;
    if (!playing) h += `<p class="result"><b>${esc(game.result)}</b></p>`;
    h += `<h4>學生入口　房號 ${esc(room)} <button class="btn sm" id="qrt">${showQR ? '隱藏 QR 碼' : '顯示 QR 碼'}</button></h4>`;
    if (showQR) h += `<div class="qrs"><div>${qr(link('red'))}<br><b style="color:var(--red)">紅軍</b></div><div>${qr(link('blue'))}<br><b style="color:var(--blue)">藍軍</b></div><div>${qr(link('screen'))}<br><b>投影畫面</b></div></div>`;
    if (playing) h += `<div class="stat"><span class="${cur('red') ? 'ok' : 'wait'}">紅軍${cur('red') ? '已下令' : '尚未下令'}</span><span class="${cur('blue') ? 'ok' : 'wait'}">藍軍${cur('blue') ? '已下令' : '尚未下令'}</span></div>`;
    h += `<h4 style="color:var(--red)">紅軍</h4>${armyList('red')}<h4 style="color:var(--blue)">藍軍</h4>${armyList('blue')}`;
    if (playing) h += `<button class="btn main" id="res">${both ? '結算本回合' : '結算本回合（未下令的一方原地固守）'}</button>
      <label class="auto"><input type="checkbox" id="autoR" ${autoRes ? 'checked' : ''}> 雙方都送出命令後，3 秒自動結算</label>`;
    h += `<div class="row" style="margin-top:8px">${hist.length ? '<button class="btn" id="undo">回上一回合</button>' : ''}<button class="btn" id="new">重新開局</button><button class="btn" id="lg">完整戰報</button></div>`;
    const L = R.LIMITS, inp = (id, k, step = 1) => `<input id="${id}" type="number" step="${step}" value="${c[k]}" min="${L[k][0]}" max="${L[k][1]}">`;
    h += `<details id="cfg"><summary>參數設定（按「套用並重新開局」才生效）</summary>
      <div class="count">紅軍兵力 ${inp('sRed', 'redUnits')} 個單位</div>
      <div class="count">藍軍兵力 ${inp('sBlue', 'blueUnits')} 個單位</div>
      <div class="count">回合上限 ${inp('sMax', 'maxTurns')} 回合</div>
      <div class="count">擊其不整加成 ×${inp('sBonus', 'strikeBonus', 0.25)}</div>
      <div class="count">發現距離 ${inp('sSight', 'sightRange')} 格</div>
      <div class="count">聲望每次扣 ${inp('sPH', 'prestigeHit')} 點</div>
      <button class="btn" id="apply">套用並重新開局</button>
      <div class="muted">學生手機上的規則說明會自動跟著這些數字改。</div></details>
      <div class="muted legend">地圖圈色：紅＝只有紅軍能走，藍＝只有藍軍能走，金＝雙方都能走。</div>`;
    const last = game.log.at(-1);
    if (last) h += `<h4>最近戰報</h4>${logHtml([last])}`;
    if (!playing) h += REVEAL;
    const open = $('#cfg')?.open, sc = $('#refbox').scrollTop;
    $('#refbox').innerHTML = h;
    if (open) $('#cfg').open = true;
    $('#refbox').scrollTop = sc;
    resize();
    $('#qrt').onclick = () => { showQR = !showQR; render(); };
    $('#lg').onclick = () => modal(`<h2>完整戰報</h2>${logHtml(game.log)}`);
    if ($('#res')) $('#res').onclick = () => (both ? resolve() : confirmBox('還有一方沒下令，沒下令的部隊會原地固守。確定結算？', resolve));
    const ar = $('#autoR'); if (ar) ar.onchange = () => { autoRes = ar.checked; try { localStorage.setItem('hong-auto', autoRes ? '1' : '0'); } catch (e) { } render(); };
    clearTimeout(autoT);
    if (autoRes && both && playing && !busy) { const t0 = game.turn; autoT = setTimeout(() => { if (game.turn === t0 && cur('red') && cur('blue')) resolve(); }, 3000); }
    if ($('#undo')) $('#undo').onclick = () => confirmBox('回到上一回合的局面？雙方這回合已送出的命令會清掉。', async () => {
      if (!hist.length) return;
      const prev = hist[hist.length - 1]; hist = hist.slice(0, -1); shown = null;
      await be.set('orders/red', null); await be.set('orders/blue', null);
      await publish(prev, false); toast('已回到上一回合');
    });
    $('#new').onclick = () => confirmBox('重新開局？目前的戰局會清除，參數維持這一局的設定。', () => restart(c));
    $('#apply').onclick = () => {
      const n = id => Number($(id).value);
      confirmBox('套用新參數並重新開局？目前的戰局會清除。', () => restart({ redUnits: n('#sRed'), blueUnits: n('#sBlue'), maxTurns: n('#sMax'), strikeBonus: n('#sBonus'), sightRange: n('#sSight'), prestigeHit: n('#sPH') }));
    };
  }
}

// ====================== 投影畫面 ======================
if (role === 'screen') {
  topBar('');
  $('#ui').innerHTML = '<div id="screenbox"></div>';
  dockWatch.observe($('#screenbox')); resize(); resetCamera(true);
  let pub = null, shown = null, ord = { red: null, blue: null };
  be.on('view/public', v => {
    pub = parse(v);
    if (pub && pub.ver !== R.VERSION) pub = null;
    if (pub) {
      const advanced = shown && pub.log.length > shown.log.length;
      syncScene({ armies: pub.armies, fallen: pub.fallen }, false);
      if (advanced) battleBursts(pub.log.at(-1).lines);
      shown = pub;
    }
    render();
  });
  be.on('orders/red', v => { ord.red = parse(v); render(); });
  be.on('orders/blue', v => { ord.blue = parse(v); render(); });
  function render() {
    if (!pub) { $('#screenbox').innerHTML = '<div class="muted">等待老師開局…</div>'; resize(); return; }
    const playing = pub.status === 'playing', c = pub.cfg;
    drawMarkers(allNodeMarks());
    const ok = s => ord[s] && ord[s].turn === pub.turn;
    let h = playing
      ? `<div class="big">第 ${pub.turn}／${c.maxTurns} 回合</div><div class="stat"><span class="${ok('red') ? 'ok' : 'wait'}">紅軍${ok('red') ? '已下令' : '思考中'}</span><span class="${ok('blue') ? 'ok' : 'wait'}">藍軍${ok('blue') ? '已下令' : '思考中'}</span></div>
         <div class="muted">戰場上的兵力只在各隊手機上顯示。紅軍折損 ${pub.lost.red}／${R.redLoseAt(c)}，藍軍折損 ${pub.lost.blue}。</div>`
      : `<div class="big">${esc(pub.result)}</div><div class="prest">${prestigeBar(pub.prestige, c.prestige)}</div><div class="muted">雙方全部部隊已揭曉。</div>`;
    h += `<div class="muted legend">地圖圈色：紅＝只有紅軍能走，藍＝只有藍軍能走，金＝雙方都能走。</div>`;
    if (pub.log.length) h += logHtml(playing ? pub.log.slice(-1) : pub.log);
    if (!playing) h += REVEAL;
    $('#screenbox').innerHTML = h;
    resize();
  }
}
