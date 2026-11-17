import * as R from './rules.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
let role = params.get('role');            // red | blue | ref | screen
let room = (params.get('room') || '').toUpperCase();
const SIDE_NAME = { red: '楚軍（紅）', blue: '宋軍（藍）', ref: '裁判', screen: '投影' };
const ROLE_SIDE = { red: 'red', blue: 'blue' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
const parse = v => (v == null ? null : typeof v === 'string' ? JSON.parse(v) : v);

// ====================== 首頁 ======================
if (!role || (!room && role !== 'ref')) {
  document.getElementById('loading')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
  <div id="home"><div class="card">
    <h1>泓水之戰</h1><div class="muted">雙盲推演．楚軍渡河，宋軍守國</div>
    <p style="margin-top:16px">學生請掃描老師畫面上的 QR 碼。或輸入房號：</p>
    <input id="hroom" placeholder="房號（四碼）" maxlength="6">
    <div class="row"><button class="btn" id="hr" style="flex:1;background:var(--red);color:#fff">加入楚軍（紅）</button>
    <button class="btn" id="hb" style="flex:1;background:var(--blue);color:#fff">加入宋軍（藍）</button></div>
    <hr style="border:none;border-top:1px solid var(--line);margin:16px 0">
    <button class="btn main" id="hk">我是老師：開一局新推演</button>
  </div></div>`);
  const go = r => { const code = $('#hroom').value.trim().toUpperCase(); if (!code) return alert('請輸入房號'); location.search = `?role=${r}&room=${code}`; };
  $('#hr').onclick = () => go('red'); $('#hb').onclick = () => go('blue');
  $('#hk').onclick = () => { location.search = '?role=ref'; };
  throw new Error('home');
}
if (role === 'ref' && !room) {
  room = Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[O0I1]/g, 'X');
  history.replaceState(null, '', `?role=ref&room=${room}`);
}

// ====================== 立體場景（立體戰場移植自《國君的抉擇》，見 world.js） ======================
const THREE = window.THREE;
const COLORS = { red: '#b3261e', blue: '#1f4e9c', both: '#c9962c' };
const VIEW_SIDE = ROLE_SIDE[role] || 'red';
window.SOLDIERS_PER = { inf: 12 };
bootScene();
const canvas = SCN.canvas;
const NODE_IDS = Object.keys(R.NODES);
const wp = id => { const n = RULES.NODES[id]; return new THREE.Vector3(n.x, Math.max(SCN.H(n.x, n.z), 0.05), n.z); };

// 鏡頭：紅軍從南往北看，宋軍從北往南看
const TH = VIEW_SIDE === 'blue' ? Math.PI : 0;
function focusNodes(ids, instant) {
  if (!ids.length) return;
  const ps = ids.map(wp);
  const c = ps.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / ps.length);
  let span = 0; for (const p of ps) span = Math.max(span, Math.hypot(p.x - c.x, p.z - c.z));
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const r = Math.max(42, Math.min(230, (span * 2 + 22) / Math.min(1.1, Math.max(0.55, aspect)) * 1.05));
  SCN.flyOrbit({ target: new THREE.Vector3(c.x, 0, c.z), r, th: TH, ph: 0.85 }, instant);
}
function resetCamera(instant) { SCN.flyOrbit({ target: new THREE.Vector3(0, 0, -2), r: canvas.clientWidth < canvas.clientHeight ? 230 : 160, th: TH, ph: 0.82 }, instant); }

// 部隊：沿用原遊戲的立體士兵（每個兵力單位畫 12 人）
function setTokens(list, animate = true) {
  SCN.setUnits(list.map(t => {
    const a = t.army, ch = a.side === 'red' ? '楚' : '宋';
    const st = a.side === 'red' && a.state && a.state !== 'formed' ? ' ' + R.STATE_LABEL[a.state] : '';
    const label = t.ghost ? `${ch} ${a.units}？ 第${a.turn}回合目擊` : `${ch} ${a.units}${st}`;
    return { key: (t.ghost ? 'g' : 'a') + a.id, side: a.side, type: 'inf', s: a.units, pos: { n: a.node }, label, labelCls: t.ghost ? 'ghost' : '', ghost: !!t.ghost, mine: a.side === VIEW_SIDE };
  }), animate);
}

// 命令箭頭（沿地面起伏）
const arrowLayer = new THREE.Group(); SCN.scene.add(arrowLayer);
function drawArrows(items) {
  arrowLayer.children.slice().forEach(o => { arrowLayer.remove(o); o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); });
  flows.length = 0;
  for (const it of items) {
    const A = wp(it.from), B = wp(it.to);
    const dir = B.clone().sub(A); dir.y = 0; const len = dir.length(); dir.normalize();
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, d = 3 + (len - 10) * t;
      const x = A.x + dir.x * d, z = A.z + dir.z * d;
      pts.push(new THREE.Vector3(x, Math.max(SCN.H(x, z), 0.05) + 2.2 + Math.sin(t * Math.PI) * 3.5, z));
    }
    const col = it.strike ? MK_COL.attack : MK_COL[it.side];
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(pts);
    // 白色外框＋彩色主體，濾鏡下也看得清楚
    const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 1.15, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, fog: false }));
    edge.renderOrder = 22; g.add(edge);
    const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.8, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false, fog: false }));
    body.renderOrder = 23; g.add(body);
    const end = pts[pts.length - 1], prev = pts[pts.length - 3];
    const dirE = end.clone().sub(prev).normalize();
    const headE = new THREE.Mesh(new THREE.ConeGeometry(3.0, 6.0, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, fog: false }));
    headE.position.copy(end); headE.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirE); headE.renderOrder = 22; g.add(headE);
    const head = new THREE.Mesh(new THREE.ConeGeometry(2.3, 5.0, 16), new THREE.MeshBasicMaterial({ color: col, depthTest: false, fog: false }));
    head.position.copy(end).addScaledVector(dirE, 0.3); head.quaternion.copy(headE.quaternion); head.renderOrder = 23; g.add(head);
    // 沿路流動的小箭頭，表示行進方向
    const dense = curve.getPoints(80); const chev = [];
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, fog: false })); c.renderOrder = 24; g.add(c); chev.push(c); }
    flows.push({ pts: dense, chev });
    arrowLayer.add(g);
  }
  SCN.dirty();
}

// 點位標記：黃＝本軍所在、綠＝可前往、橘紅＝出擊目標、白＝本軍能走的點位
const MK_COL = { here: '#ffd23f', move: '#2ee86b', attack: '#ff5a1f', idle: '#ffffff', red: '#ff4a3d', blue: '#4a9bff' };
const markLayer = new THREE.Group(); SCN.scene.add(markLayer);
const bobbers = [];
function drawMarkers(map, idleNodes = []) {
  const all = { ...Object.fromEntries(idleNodes.map(n => [n, 'idle'])), ...map };
  SCN.setMarkers(all, false);
  markLayer.children.slice().forEach(o => { markLayer.remove(o); o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); });
  bobbers.length = 0;
  for (const [n, st] of Object.entries(all)) {
    const p = wp(n); const col = MK_COL[st] || '#ffffff';
    const strong = st !== 'idle';
    const g = new THREE.Group(); g.position.set(p.x, p.y + 0.35, p.z);
    const ringG = new THREE.RingGeometry(strong ? 3.6 : 3.2, strong ? 5.4 : 4.3, 48); ringG.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: strong ? 0.95 : 0.75, depthTest: false, side: THREE.DoubleSide, fog: false }));
    ring.renderOrder = 20; g.add(ring);
    const discG = new THREE.CircleGeometry(strong ? 3.6 : 3.2, 40); discG.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: strong ? 0.28 : 0.12, depthTest: false, fog: false }));
    disc.renderOrder = 19; g.add(disc);
    if (st === 'move' || st === 'attack') {
      // 目標點上方浮動的菱形指標（不做直衝天際的光柱）
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), new THREE.MeshBasicMaterial({ color: col, depthTest: false, fog: false }));
      gem.scale.set(1, 1.6, 1); gem.position.y = 6; gem.renderOrder = 21; g.add(gem);
      bobbers.push({ gem, ring, base: 6 });
    }
    markLayer.add(g);
  }
  SCN.dirty();
}
// 點位與箭頭的動態（只在有東西要動時才持續重畫）
const flows = [];
(function anim(t) {
  requestAnimationFrame(anim);
  if (!bobbers.length && !flows.length) return;
  const s = t / 1000;
  for (const b of bobbers) {
    b.ring.scale.setScalar(1 + 0.12 * Math.sin(s * 4));
    if (b.gem) { b.gem.position.y = b.base + Math.sin(s * 3) * 0.8; b.gem.rotation.y = s * 1.5; }
  }
  for (const f of flows) f.chev.forEach((c, i) => { const u = ((s * 0.35 + i / f.chev.length) % 1); const k = Math.floor(u * (f.pts.length - 1)); c.position.copy(f.pts[k]); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.pts[Math.min(k + 1, f.pts.length - 1)].clone().sub(f.pts[Math.max(k - 1, 0)]).normalize()); });
  SCN.dirty();
})(0);
// 學生只看本軍能走的點位
const myNodes = side => NODE_IDS.filter(n => R.NODES[n].side === side || R.NODES[n].side === 'both');

// 點選地圖上的點位
let onNodeTap = null;
SCN.onNodeClick = n => onNodeTap?.(n);

// 版面：地圖只佔面板以外的區域
const SIDE_MQ = matchMedia('(orientation: landscape) and (max-height: 520px)');
function resize() {
  const p = document.getElementById('panel');
  let w = innerWidth, h = innerHeight;
  if (p) { if (SIDE_MQ.matches) w -= p.offsetWidth; else h -= p.offsetHeight; }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  SCN.resize();
}
addEventListener('resize', resize);
new ResizeObserver(() => resize()).observe(document.body);
let sty = 'B'; try { sty = localStorage.getItem('hong-style') || 'B'; } catch (e) { }
SCN.start(); if (sty === 'D') SCN.applyStyle('D');
resize(); resetCamera(true);
document.getElementById('loading')?.remove();

// 交戰處冒出「接戰」字樣
function battleBursts(lines) {
  for (const t of lines) { const m = t.match(/^【(.+)之戰】/); if (!m) continue; const id = NODE_IDS.find(k => R.NODES[k].name === m[1]); if (id) SCN.battleFx(id, m[1] + '接戰'); }
}

// ====================== 共用介面 ======================
function topBar(extra = '') {
  $('#top').innerHTML = `<span class="side ${role === 'red' || role === 'blue' ? role : 'ref'}">${SIDE_NAME[role]}</span>
    <span class="room">房號 <b>${esc(room)}</b></span><span class="grow"></span>${extra}
    <button id="sty">換畫風</button><button id="cam">全圖</button>`;
  $('#cam').onclick = () => resetCamera();
  $('#sty').onclick = () => { const k = document.body.dataset.style === 'B' ? 'D' : 'B'; SCN.applyStyle(k); try { localStorage.setItem('hong-style', k); } catch (e) { } };
}
function modal(html, onClose) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card">${html}<button class="btn main" style="margin-top:12px">知道了</button></div>`;
  m.querySelector('.btn.main').onclick = () => { m.remove(); onClose?.(); };
  document.body.appendChild(m);
}
function logHtml(log, fromTurn = 0) {
  return log.filter(l => l.turn >= fromTurn).map(l => `<div class="log-turn">第 ${l.turn} 回合</div>${l.lines.map(x => `<p>${esc(x)}</p>`).join('')}`).join('') || '<p class="muted">尚無紀錄。</p>';
}
function orderText(o, a) {
  if (!o || o.type === 'hold') return '原地固守';
  if (o.type === 'regroup') return '重新列陣';
  const n = o.count && o.count < a.units ? `（派 ${o.count}）` : '';
  if (o.type === 'strike') return `出擊${R.NODES[o.to].name}${n}`;
  return `前往${R.NODES[o.to].name}${n}`;
}
function armyName(a, list) { const i = list.filter(x => x.side === a.side).indexOf(a); return ['第一軍', '第二軍', '第三軍', '第四軍', '第五軍', '第六軍'][i] || '部隊'; }

const be = await makeBackend();
if (be.mode === 'local') document.body.insertAdjacentHTML('beforeend', `<div id="banner">${innerWidth < 700 ? '單機測試模式' : '單機測試模式：尚未設定 Firebase，僅同一瀏覽器的分頁互相同步'}</div>`);

// ====================== 學生（紅／藍） ======================
if (role === 'red' || role === 'blue') {
  const side = role;
  document.body.classList.add(side);

  topBar('<button id="logb">戰報</button><button id="helpb">規則</button><button id="mineb">我軍</button>');
  $('#ui').innerHTML = '<div id="panel"><div class="muted">連線中…</div></div>';
  let view = null, draft = {}, sel = null, submitted = null, lastTurn = null;

  const focusMine = instant => view && focusNodes(view.mine.flatMap(a => [a.node, ...Object.keys(R.ADJ[side][a.node] || {})]), instant);
  $('#mineb').onclick = () => focusMine();
  $('#logb').onclick = () => view && modal(`<h2>戰報</h2>${logHtml(view.log)}`);
  $('#helpb').onclick = () => modal(side === 'red' ? `<h2>楚軍須知</h2>
    <p>你率楚軍 6 個步兵單位自南方來，必須渡過南河，攻入宋營即勝。</p>
    <p>• 每回合每支部隊可移動一格，也可以分兵走不同路線。</p>
    <p>• 站在河中（渡口）時戰力只剩一半；上岸後也只有一半，要按「重新列陣」停一回合才恢復。</p>
    <p>• 只看得到同一條路線上相距兩格以內的宋軍。</p>
    <p>• 折損 3 個單位即敗；12 回合內未能攻入宋營也算敗。</p>` : `<h2>宋軍須知</h2>
    <p>你率宋軍 3 個步兵單位守國都，敵眾我寡。</p>
    <p>• 每回合每支部隊可移動一格，也可以分兵。只能在北岸行動，不渡河。</p>
    <p>• 只看得到同一條路線上相距兩格以內的楚軍。</p>
    <p>• 楚軍在河中或上岸未成列時，戰力只剩一半，而你打擊這種敵人戰力 ×1.5。站在河岸點可以「出擊」對岸渡口。</p>
    <p>• 楚軍列好陣後與你正面交戰，你幾乎必敗。</p>
    <p>• 讓楚軍折損 3 個單位，或守住 12 回合，即勝。</p>`);

  be.on(`view/${side}`, v => {
    v = parse(v);
    if (!v) { $('#panel').innerHTML = '<div class="muted">等待老師開局…</div>'; return; }
    const newTurn = lastTurn !== null && v.turn !== lastTurn;
    const ended = v.status !== 'playing' && view?.status === 'playing';
    if (newTurn) { draft = {}; sel = null; }
    const prevTurn = lastTurn;
    const first = !view;
    view = v; lastTurn = v.turn;
    render();
    if (first || newTurn) focusMine(first);
    if (ended) modal(`<h2>${esc(v.result)}</h2><p class="muted">地圖上已顯示敵軍全部位置。</p>${logHtml(v.log, (prevTurn ?? v.turn))}`);
    else if (newTurn) {
      const rep = v.log.filter(l => l.turn === prevTurn);
      if (rep.length) battleBursts(rep[0].lines);
      if (rep.length && !(rep[0].lines.length === 1 && rep[0].lines[0] === '雙方未接觸。')) modal(`<h2>第 ${prevTurn} 回合戰報</h2>${logHtml(rep)}`);
    }
  });
  be.on(`orders/${side}`, v => { v = parse(v); submitted = v && view && v.turn === view.turn ? v : (v && !view ? v : null); render(); });

  const focusSel = () => { const a = view.mine.find(x => x.id === sel); if (a) focusNodes([a.node, ...Object.keys(R.ADJ[side][a.node] || {})]); };
  onNodeTap = n => {
    if (!view || view.status !== 'playing') return;
    const sa = view.mine.find(x => x.id === sel);
    const o = sa && R.legalOrders(null, sa).find(x => x.to === n);
    if (o) { draft[sel] = { ...o, count: draft[sel]?.count && draft[sel].type === o.type ? draft[sel].count : sa.units }; render(); return; }
    const mine = view.mine.find(x => x.node === n);
    if (mine) { sel = mine.id; render(); focusSel(); return; }
    sel = null; render();
  };
  function render() {
    if (!view) return;
    const sub = submitted && submitted.turn === view.turn;
    setTokens([...view.mine.map(a => ({ army: a })), ...view.enemies.map(a => ({ army: a })), ...view.ghosts.map(a => ({ army: { ...a, side: side === 'red' ? 'blue' : 'red' }, ghost: true }))]);
    const sa = view.mine.find(a => a.id === sel);
    drawArrows(view.mine.filter(a => draft[a.id] && draft[a.id].to).map(a => ({ from: a.node, to: draft[a.id].to, side, strike: draft[a.id].type === 'strike' })));
    const mk = {};
    if (view.status === 'playing') {
      for (const a of view.mine) mk[a.node] = 'here';
      if (sa) for (const o of R.legalOrders(null, sa)) if (o.to) mk[o.to] = o.type === 'strike' ? 'attack' : 'move';
    }
    drawMarkers(mk, view.status === 'playing' ? myNodes(side) : []);
    const lost = view.lost[side];
    const lim = Math.ceil(view.cfg.redUnits / 2);
    let h = `<div class="phead"><b>第 ${view.turn} 回合</b><span class="muted">已損 ${lost}${side === 'red' ? `／損 ${lim} 即敗` : ''}</span></div>`;
    if (view.status !== 'playing') {
      h += `<p><b>${esc(view.result)}</b></p><p class="muted">推演結束。請看老師的投影畫面。</p>`;
      $('#panel').innerHTML = h; resize(); return;
    }
    h += '<div class="chips">';
    for (const a of view.mine) {
      const st = side === 'red' && a.state !== 'formed' ? `<span class="badge warn">${R.STATE_LABEL[a.state]}</span>` : '';
      h += `<div class="chip ${a.id === sel ? 'sel' : ''}" data-id="${a.id}"><b>${armyName(a, view.mine)}</b> ${a.units}${st}<br><span class="where">${R.NODES[a.node].name}</span><span class="ord">→ ${orderText(draft[a.id], a)}</span></div>`;
    }
    if (!view.mine.length) h += '<span class="muted">你已沒有部隊。</span>';
    h += '</div>';
    if (sa) {
      const o = draft[sa.id] || { type: 'hold' };
      const short = x => x.type === 'hold' ? '固守' : x.type === 'regroup' ? '重新列陣' : x.type === 'strike' ? `出擊${R.NODES[x.to].name}` : `→ ${R.NODES[x.to].name}`;
      h += `<div class="opts">${R.legalOrders(null, sa).map((x, i) => `<button data-i="${i}" class="${x.type === o.type && x.to === o.to ? 'on' : ''} ${x.type === 'strike' ? 'strike' : ''}">${esc(short(x))}</button>`).join('')}</div>`;
      if ((o.type === 'move' || o.type === 'strike') && sa.units > 1) {
        const c = o.count || sa.units;
        h += `<div class="count">派出 <button data-c="-1">－</button><b>${c}</b><button data-c="1">＋</button> <span class="muted">${c < sa.units ? `其餘 ${sa.units - c} 留守` : '全軍'}</span></div>`;
      }
    } else if (view.mine.length) h += '<div class="muted hint">點部隊（下方或地圖上）下令，沒下令的原地固守。</div>';
    h += `<button class="btn main" id="send">${sub ? '已送出（可修改再送）' : '送出本回合命令'}</button>`;
    if (sub) h += `<div class="waitnote">命令已送達。<b>老師按下「結算本回合」後，雙方部隊才會同時行動</b>，在那之前部隊會留在原地。</div>`;
    $('#panel').innerHTML = h;
    resize();
    $('#panel').querySelectorAll('.chip').forEach(el => el.onclick = () => { sel = sel === el.dataset.id ? null : el.dataset.id; render(); if (sel) focusSel(); else focusMine(); });
    $('#panel').querySelectorAll('.opts button').forEach(el => el.onclick = () => {
      const x = R.legalOrders(null, sa)[+el.dataset.i];
      draft[sa.id] = x.type === 'hold' ? undefined : { type: x.type, to: x.to, count: sa.units };
      if (!draft[sa.id]) delete draft[sa.id];
      render();
    });
    $('#panel').querySelectorAll('.count button').forEach(el => el.onclick = () => {
      const o = draft[sa.id]; o.count = Math.max(1, Math.min(sa.units, (o.count || sa.units) + +el.dataset.c)); render();
    });
    $('#send').onclick = async () => {
      const clean = {};
      for (const [k, o] of Object.entries(draft)) if (o) clean[k] = { type: o.type, ...(o.to ? { to: o.to } : {}), ...(o.count ? { count: o.count } : {}) };
      await be.set(`orders/${side}`, JSON.stringify({ turn: view.turn, orders: clean, at: Date.now() }));
      sel = null; render();
    };
  }
}

// ====================== 裁判 ======================
if (role === 'ref') {

  topBar('<button id="hide">收合面板</button>');
  $('#ui').innerHTML = '<div id="refbox"></div>';
  let game = null, ord = { red: null, blue: null }, hist = [], showQR = true, autoRes = false, resolving = false;
  try { autoRes = localStorage.getItem('hong-auto') === '1'; } catch (e) { }
  $('#hide').onclick = () => { const b = $('#refbox'); b.style.display = b.style.display === 'none' ? '' : 'none'; };

  const base = location.href.split('?')[0];
  const link = r => `${base}?role=${r}&room=${room}`;
  const qr = txt => { const q = qrcode(0, 'M'); q.addData(txt); q.make(); return q.createSvgTag({ cellSize: 3, margin: 1 }); };

  async function publish(g, pushHist = true) {
    if (pushHist && game) hist = [...hist, game].slice(-30);
    game = g;
    await be.set('history', JSON.stringify(hist));
    await be.set('full', JSON.stringify(g));
    await be.set('view/red', JSON.stringify(R.viewFor(g, 'red')));
    await be.set('view/blue', JSON.stringify(R.viewFor(g, 'blue')));
    await be.set('view/public', JSON.stringify({ turn: g.turn, status: g.status, result: g.result, log: g.log, lost: g.lost, armies: g.status === 'playing' ? [] : g.armies }));
  }
  be.on('history', v => { hist = parse(v) || []; });
  let started = false;
  be.on('full', v => {
    v = parse(v);
    if (!v && !started) { started = true; publish(R.newGame(), false); return; }
    started = true;
    if (v) { game = v; render(); }
  });
  be.on('orders/red', v => { ord.red = parse(v); render(); });
  be.on('orders/blue', v => { ord.blue = parse(v); render(); });

  function render() {
    if (!game) return;
    setTokens(game.armies.map(a => ({ army: a })));
    drawMarkers({});
    const cur = s => ord[s] && ord[s].turn === game.turn ? ord[s] : null;
    const arrows = [];
    for (const s of ['red', 'blue']) {
      const o = cur(s); if (!o) continue;
      for (const [id, x] of Object.entries(o.orders)) {
        const a = game.armies.find(y => y.id === id);
        if (a && x.to) arrows.push({ from: a.node, to: x.to, side: s, strike: x.type === 'strike', text: x.count && x.count < a.units ? `派 ${x.count}` : '' });
      }
    }
    drawArrows(arrows);
    const ordList = s => {
      const o = cur(s);
      const mine = game.armies.filter(a => a.side === s);
      if (!o) return '<div class="muted">尚未送出</div>';
      return mine.map(a => `<div>• ${armyName(a, mine)}（${R.NODES[a.node].name}，${a.units}${s === 'red' ? '，' + R.STATE_LABEL[a.state] : ''}）：${orderText(o.orders[a.id], a)}</div>`).join('');
    };
    const both = cur('red') && cur('blue');
    let h = '';
    h += `<div class="row" style="justify-content:space-between"><b style="font-size:18px">第 ${game.turn} 回合</b><span class="muted">楚損 ${game.lost.red}／宋損 ${game.lost.blue}</span></div>`;
    if (game.status !== 'playing') h += `<p style="font-weight:700;color:var(--red)">${esc(game.result)}</p>`;
    h += `<h4>學生入口 <button class="btn" id="qrt" style="padding:2px 8px;font-size:12px">${showQR ? '隱藏' : '顯示'}</button></h4>`;
    if (showQR) h += `<div class="qrs"><div>${qr(link('red'))}<br><b style="color:var(--red)">楚軍（紅）</b></div><div>${qr(link('blue'))}<br><b style="color:var(--blue)">宋軍（藍）</b></div><div>${qr(link('screen'))}<br><b>投影畫面</b></div></div>
      <div class="muted" style="word-break:break-all;margin-top:4px">房號 ${esc(room)}</div>`;
    h += `<div class="stat"><span class="${cur('red') ? 'ok' : ''}">楚軍${cur('red') ? '已下令' : '未下令'}</span><span class="${cur('blue') ? 'ok' : ''}">宋軍${cur('blue') ? '已下令' : '未下令'}</span></div>`;
    h += `<h4 style="color:var(--red)">楚軍命令</h4>${ordList('red')}<h4 style="color:var(--blue)">宋軍命令</h4>${ordList('blue')}`;
    if (game.status === 'playing') h += `<button class="btn main" id="res">${both ? '結算本回合' : '結算本回合（未下令者原地固守）'}</button>
      <label class="auto"><input type="checkbox" id="autoR" ${autoRes ? 'checked' : ''}> 雙方都送出命令後，3 秒自動結算</label>`;
    h += `<div class="row" style="margin-top:8px"><button class="btn" id="undo" ${hist.length ? '' : 'disabled'}>回上一回合</button><button class="btn" id="new">重新開局</button><button class="btn" id="lg">完整戰報</button></div>`;
    h += `<details style="margin-top:8px"><summary>參數設定（重新開局時套用）</summary>
      <div class="count">楚軍兵力 <input id="sRed" type="number" value="${game.cfg.redUnits}" min="2" max="12" style="width:60px"></div>
      <div class="count">宋軍兵力 <input id="sBlue" type="number" value="${game.cfg.blueUnits}" min="1" max="9" style="width:60px"></div>
      <div class="count">回合上限 <input id="sMax" type="number" value="${game.cfg.maxTurns}" min="4" max="30" style="width:60px"></div>
      <div class="count">擊其不整加成 <input id="sBonus" type="number" step="0.25" value="${game.cfg.strikeBonus}" min="1" max="3" style="width:70px"></div>
      <div class="count">發現距離 <input id="sSight" type="number" value="${game.cfg.sightRange}" min="1" max="4" style="width:60px"> 格</div></details>`;
    const last = game.log.at(-1);
    if (last) h += `<h4>最近戰報</h4>${logHtml([last])}`;
    $('#refbox').innerHTML = h;
    $('#qrt').onclick = () => { showQR = !showQR; render(); };
    const ar = $('#autoR'); if (ar) ar.onchange = () => { autoRes = ar.checked; try { localStorage.setItem('hong-auto', autoRes ? '1' : '0'); } catch (e) { } render(); };
    if (autoRes && both && game.status === 'playing' && !resolving) {
      resolving = true; const t0 = game.turn;
      setTimeout(async () => { if (game.turn === t0 && cur('red') && cur('blue')) await publish(R.resolveTurn(game, { ...cur('red').orders, ...cur('blue').orders })); resolving = false; }, 3000);
    }
    $('#lg').onclick = () => modal(`<h2>完整戰報</h2>${logHtml(game.log)}`);
    const res = $('#res'); if (res) res.onclick = async () => {
      if (!both && !confirm('還有一方沒下令，未下令的部隊將原地固守。確定結算？')) return;
      const orders = { ...(cur('red')?.orders || {}), ...(cur('blue')?.orders || {}) };
      await publish(R.resolveTurn(game, orders));
    };
    $('#undo').onclick = async () => {
      if (!hist.length || !confirm('回到上一回合的局面？')) return;
      const prev = hist[hist.length - 1]; hist = hist.slice(0, -1);
      await publish(prev, false);
      await be.set('orders/red', null); await be.set('orders/blue', null);
    };
    $('#new').onclick = async () => {
      if (!confirm('重新開局？目前戰局會清除。')) return;
      const n = id => +$(id).value;
      hist = [];
      await be.set('orders/red', null); await be.set('orders/blue', null);
      await publish(R.newGame({ redUnits: n('#sRed'), blueUnits: n('#sBlue'), maxTurns: n('#sMax'), strikeBonus: n('#sBonus'), sightRange: n('#sSight') }), false);
    };
  }
}

// ====================== 投影畫面 ======================
if (role === 'screen') {

  topBar('');
  $('#ui').innerHTML = '<div id="screenbox"></div>';
  let pub = null, ord = { red: null, blue: null };
  be.on('view/public', v => { pub = parse(v); render(); });
  be.on('orders/red', v => { ord.red = parse(v); render(); });
  be.on('orders/blue', v => { ord.blue = parse(v); render(); });
  function render() {
    if (!pub) { $('#screenbox').innerHTML = '<div class="muted">等待開局…</div>'; return; }
    setTokens(pub.armies.map(a => ({ army: a })));
    drawMarkers({});
    const ok = s => ord[s] && ord[s].turn === pub.turn;
    let h = pub.status === 'playing'
      ? `<div class="big">第 ${pub.turn} 回合</div><div class="stat"><span class="${ok('red') ? 'ok' : ''}">楚軍${ok('red') ? '已下令' : '思考中'}</span><span class="${ok('blue') ? 'ok' : ''}">宋軍${ok('blue') ? '已下令' : '思考中'}</span></div>
         <div class="muted">戰場上的兵力只在各隊手機上顯示。</div>`
      : `<div class="big">${esc(pub.result)}</div><div class="muted">雙方全部部隊已揭曉。</div>`;
    const last = pub.log.at(-1);
    if (last) h += logHtml(pub.status === 'playing' ? [last] : pub.log);
    $('#screenbox').innerHTML = h;
  }
}
