import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
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

// ====================== 立體場景 ======================
const SC = 14.75 / 1920;
const pos = id => new THREE.Vector3((R.NODES[id].x - 960) * SC, 0, (R.NODES[id].y - 540) * SC);

const host = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const labelR = new CSS2DRenderer();
labelR.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
host.appendChild(labelR.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1a15');
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = 1.2; controls.minPolarAngle = 0.15;
controls.minDistance = 3; controls.maxDistance = 18;
controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

function resetCamera() {
  const portrait = innerHeight > innerWidth;
  camera.position.set(0, portrait ? 14 : 8.5, portrait ? 9.5 : 6.5);
  controls.target.set(0, 0, portrait ? 1.8 : 0.4);
  controls.update();
}

scene.add(new THREE.HemisphereLight('#fff6e0', '#4a3a28', 1.1));
const sun = new THREE.DirectionalLight('#fff1d6', 1.6);
sun.position.set(-5, 10, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6 });
scene.add(sun);

// 地圖板
const tex = new THREE.TextureLoader().load('map.jpg');
tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
const board = new THREE.Mesh(new THREE.PlaneGeometry(14.75, 1080 * SC), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
const base = new THREE.Mesh(new THREE.BoxGeometry(15.15, 0.4, 1080 * SC + 0.4), new THREE.MeshStandardMaterial({ color: '#5b3d22', roughness: 0.8 }));
base.position.y = -0.205; scene.add(base);

// 營地
function camp(id, color) {
  const g = new THREE.Group(); g.position.copy(pos(id));
  const mat = new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color });
  [[-0.42, -0.2], [-0.5, 0.18], [0.45, 0.15], [0.4, -0.25]].forEach(([x, z]) => {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), mat); t.position.set(x, 0.11, z); t.rotation.y = 0.6; t.castShadow = true; g.add(t);
    const r = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), trim); r.position.set(x, 0.24, z); g.add(r);
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), new THREE.MeshStandardMaterial({ color: '#3b2a18' }));
  pole.position.set(-0.2, 0.4, -0.38); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
  flag.position.set(-0.05, 0.7, -0.38); g.add(flag);
  scene.add(g);
}
camp('S', '#b3261e'); camp('H', '#1f4e9c');

// 點位與路線
const COLORS = { red: '#b3261e', blue: '#1f4e9c', both: '#c9962c' };
function addLabel(obj, html, cls, y = 0) {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
  const o = new CSS2DObject(d); o.position.y = y; obj.add(o); return o;
}
const nodeGroup = new THREE.Group(); scene.add(nodeGroup);
function drawNodes(viewSide) {
  nodeGroup.clear();
  // 路線
  const sides = viewSide ? [viewSide] : ['red', 'blue'];
  const done = new Set();
  for (const s of sides) for (const [a, b, via] of R.EDGES[s]) {
    const pts = via ? [a, via, b] : [a, b];
    for (let i = 0; i < pts.length - 1; i++) {
      const k = [pts[i], pts[i + 1]].sort().join('-');
      if (done.has(k)) continue; done.add(k);
      const p1 = pos(pts[i]), p2 = pos(pts[i + 1]);
      const len = p1.distanceTo(p2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.055),
        new THREE.MeshBasicMaterial({ color: '#f2d24b', transparent: true, opacity: 0.85 }));
      m.position.copy(p1).lerp(p2, 0.5); m.position.y = 0.01;
      m.rotation.y = -Math.atan2(p2.z - p1.z, p2.x - p1.x);
      nodeGroup.add(m);
    }
  }
  for (const [id, n] of Object.entries(R.NODES)) {
    if (viewSide && n.side !== 'both' && n.side !== viewSide && id !== 'H' && id !== 'S') continue;
    const g = new THREE.Group(); g.position.copy(pos(id));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: COLORS[n.side], side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: '#fff8e6', transparent: true, opacity: 0.55 }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.018; g.add(fill);
    addLabel(g, n.name, 'lbl' + (n.kind === 'river' ? ' river' : ''));
    nodeGroup.add(g);
  }
}

// 兵棋
const tokens = new Map();   // key -> { group, target }
const tokenLayer = new THREE.Group(); scene.add(tokenLayer);
function bannerTex(ch, color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 64, 96);
  x.strokeStyle = '#f4ecd8'; x.lineWidth = 4; x.strokeRect(4, 4, 56, 88);
  x.fillStyle = '#fff'; x.font = 'bold 44px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BANNER = { red: bannerTex('楚', COLORS.red), blue: bannerTex('宋', COLORS.blue) };
function makeToken(a, ghost) {
  const g = new THREE.Group();
  const op = ghost ? { transparent: true, opacity: 0.38 } : {};
  const col = COLORS[a.side];
  const baseM = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.06, 28), new THREE.MeshStandardMaterial({ color: col, ...op }));
  baseM.position.y = 0.03; baseM.castShadow = !ghost; g.add(baseM);
  const unitMat = new THREE.MeshStandardMaterial({ color: a.side === 'red' ? '#d9543f' : '#3b6fc4', ...op });
  for (let i = 0; i < a.units; i++) {
    const row = Math.floor(i / 3), colI = i % 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), unitMat);
    b.position.set((colI - 1) * 0.12, 0.13, (row - 0.5) * 0.13); b.castShadow = !ghost; g.add(b);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6), new THREE.MeshStandardMaterial({ color: '#3b2a18', ...op }));
  pole.position.set(0.22, 0.33, 0); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), new THREE.MeshStandardMaterial({ map: BANNER[a.side], side: THREE.DoubleSide, ...op }));
  flag.position.set(0.33, 0.5, 0); g.add(flag);
  const st = a.side === 'red' && a.state !== 'formed' ? `<small>${R.STATE_LABEL[a.state]}</small>` : '';
  const ex = ghost ? `<small>第${a.turn}回合目擊</small>` : '';
  addLabel(g, `${a.side === 'red' ? '楚' : '宋'} ${a.units}${st}${ex}`, `tok ${a.side}${ghost ? ' ghost' : ''}`, 0.85);
  g.userData = { army: a, ghost };
  return g;
}
function setTokens(list) {
  // list: [{army, ghost}]
  const byNode = {};
  for (const t of list) (byNode[t.army.node] ||= []).push(t);
  const keep = new Set();
  for (const [node, arr] of Object.entries(byNode)) {
    arr.forEach((t, i) => {
      const key = (t.ghost ? 'g' : 'a') + t.army.id;
      keep.add(key);
      const off = arr.length > 1 ? new THREE.Vector3(Math.cos(i * 2.4) * 0.3, 0, Math.sin(i * 2.4) * 0.3) : new THREE.Vector3();
      const target = pos(node).add(off);
      const sig = JSON.stringify([t.army.units, t.army.state, t.army.turn, t.ghost]);
      let rec = tokens.get(key);
      if (rec && rec.sig !== sig) { tokenLayer.remove(rec.group); disposeLabels(rec.group); const p = rec.group.position.clone(); rec = null; tokens.delete(key); const g = makeToken(t.army, t.ghost); g.position.copy(p); tokenLayer.add(g); tokens.set(key, { group: g, target, sig }); return; }
      if (!rec) { const g = makeToken(t.army, t.ghost); g.position.copy(target); tokenLayer.add(g); tokens.set(key, { group: g, target, sig }); }
      else rec.target = target;
    });
  }
  for (const [k, rec] of tokens) if (!keep.has(k)) { tokenLayer.remove(rec.group); disposeLabels(rec.group); tokens.delete(k); }
}
function disposeLabels(g) { g.traverse(o => { if (o.isCSS2DObject) o.element.remove(); }); }

// 命令箭頭、可選目標
const arrowLayer = new THREE.Group(); scene.add(arrowLayer);
function drawArrows(items) { // [{from,to,side,strike}]
  arrowLayer.children.slice().forEach(o => { disposeLabels(o); arrowLayer.remove(o); });
  for (const it of items) {
    const a = pos(it.from), b = pos(it.to);
    const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
    const col = it.strike ? '#ff8a00' : COLORS[it.side];
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, Math.max(len - 0.45, 0.05)), new THREE.MeshBasicMaterial({ color: col }));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), new THREE.MeshBasicMaterial({ color: col }));
    const grp = new THREE.Group();
    shaft.rotation.z = -Math.PI / 2; shaft.position.x = 0.2 + (len - 0.45) / 2; grp.add(shaft);
    head.rotation.z = -Math.PI / 2; head.position.x = len - 0.22; grp.add(head);
    grp.position.copy(a); grp.position.y = 0.32;
    grp.rotation.y = -Math.atan2(dir.z, dir.x);
    if (it.text) addLabel(grp, esc(it.text), 'lbl', 0.15).position.x = len / 2;
    arrowLayer.add(grp);
  }
}
const pickLayer = new THREE.Group(); scene.add(pickLayer);
function drawTargets(opts) { // [{node, order}]
  pickLayer.clear();
  for (const o of opts) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 40), new THREE.MeshBasicMaterial({ color: o.order.type === 'strike' ? '#ff8a00' : '#ffd84a', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos(o.node)); m.position.y = 0.03;
    m.userData = o; pickLayer.add(m);
  }
}

// 點選
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hitT = ray.intersectObjects(pickLayer.children)[0];
  if (hitT) return onPickTarget?.(hitT.object.userData);
  const hitA = ray.intersectObjects(tokenLayer.children, true)[0];
  if (hitA) { let o = hitA.object; while (o.parent && o.parent !== tokenLayer) o = o.parent; return onPickArmy?.(o.userData); }
  onPickNone?.();
});
let onPickTarget, onPickArmy, onPickNone;

function resize() {
  renderer.setSize(innerWidth, innerHeight); labelR.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize(); resetCamera();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta(), 0.05);
  for (const rec of tokens.values()) rec.group.position.lerp(rec.target, 0.08);
  pickLayer.children.forEach(m => m.scale.setScalar(1 + 0.12 * Math.sin(t * 5)));
  controls.update(); renderer.render(scene, camera); labelR.render(scene, camera);
});

// ====================== 共用介面 ======================
function topBar(extra = '') {
  $('#top').innerHTML = `<span class="side ${role === 'red' || role === 'blue' ? role : 'ref'}">${SIDE_NAME[role]}</span>
    <span class="room">房號 <b>${esc(room)}</b></span><span class="grow"></span>${extra}
    <button id="cam">視角歸位</button>`;
  $('#cam').onclick = resetCamera;
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
  drawNodes(side);
  topBar('<button id="logb">戰報</button><button id="helpb">規則</button>');
  $('#ui').innerHTML = '<div id="panel"><div class="muted">連線中…</div></div>';
  let view = null, draft = {}, sel = null, submitted = null, lastTurn = null;

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
    view = v; lastTurn = v.turn;
    render();
    if (ended) modal(`<h2>${esc(v.result)}</h2><p class="muted">地圖上已顯示敵軍全部位置。</p>${logHtml(v.log, (prevTurn ?? v.turn))}`);
    else if (newTurn) {
      const rep = v.log.filter(l => l.turn === prevTurn);
      if (rep.length && !(rep[0].lines.length === 1 && rep[0].lines[0] === '雙方未接觸。')) modal(`<h2>第 ${prevTurn} 回合戰報</h2>${logHtml(rep)}`);
    }
  });
  be.on(`orders/${side}`, v => { v = parse(v); submitted = v && view && v.turn === view.turn ? v : (v && !view ? v : null); render(); });

  onPickArmy = ud => { if (!ud.ghost && ud.army.side === side && view?.status === 'playing') { sel = ud.army.id; render(); } };
  onPickTarget = ud => { const a = view.mine.find(x => x.id === sel); draft[sel] = { ...ud.order, count: draft[sel]?.count && draft[sel].type === ud.order.type ? draft[sel].count : a.units }; render(); };
  onPickNone = () => { sel = null; render(); };

  function render() {
    if (!view) return;
    const sub = submitted && submitted.turn === view.turn;
    setTokens([...view.mine.map(a => ({ army: a })), ...view.enemies.map(a => ({ army: a })), ...view.ghosts.map(a => ({ army: { ...a, side: side === 'red' ? 'blue' : 'red' }, ghost: true }))]);
    const sa = view.mine.find(a => a.id === sel);
    drawArrows(view.mine.filter(a => draft[a.id] && draft[a.id].to).map(a => ({ from: a.node, to: draft[a.id].to, side, strike: draft[a.id].type === 'strike' })));
    drawTargets(sa && view.status === 'playing' ? R.legalOrders(null, sa).filter(o => o.to).map(o => ({ node: o.to, order: o })) : []);
    const lost = view.lost[side];
    let h = `<h3>第 ${view.turn} 回合 <span class="muted">已損 ${lost} 個單位${side === 'red' ? `（損 ${Math.ceil(view.cfg.redUnits / 2)} 即敗）` : ''}</span></h3>`;
    if (view.status !== 'playing') {
      h += `<p><b>${esc(view.result)}</b></p><p class="muted">推演結束。請看老師的投影畫面。</p>`;
      $('#panel').innerHTML = h; return;
    }
    for (const a of view.mine) {
      const st = side === 'red' ? `<span class="badge ${a.state !== 'formed' ? 'warn' : ''}">${R.STATE_LABEL[a.state]}</span>` : '';
      h += `<div class="army ${a.id === sel ? 'sel' : ''}" data-id="${a.id}"><span class="dot" style="background:${COLORS[side]}"></span>
        <div class="info"><b>${armyName(a, view.mine)}</b> ${a.units} 單位 · ${R.NODES[a.node].name}${st}<div class="ord">命令：${orderText(draft[a.id], a)}</div></div></div>`;
      if (a.id === sel) {
        const o = draft[a.id] || { type: 'hold' };
        h += `<div class="opts">${R.legalOrders(null, a).map((x, i) => `<button data-i="${i}" class="${x.type === o.type && x.to === o.to ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>`;
        if ((o.type === 'move' || o.type === 'strike') && a.units > 1) {
          const c = o.count || a.units;
          h += `<div class="count">派出 <button data-c="-1">－</button><b>${c}</b><button data-c="1">＋</button> 個單位 <span class="muted">${c < a.units ? `（其餘 ${a.units - c} 個留守）` : '（全軍）'}</span></div>`;
        }
        h += `<div class="muted">也可以直接點地圖上閃爍的黃圈。</div>`;
      }
    }
    if (!view.mine.length) h += '<p class="muted">你已沒有部隊。</p>';
    h += `<button class="btn main" id="send">${sub ? '已送出，可修改後再次送出' : '送出本回合命令'}</button>`;
    h += `<div class="muted" style="margin-top:6px">${sub ? '等待對方下令，由老師結算。' : '點選部隊下令；沒下令的部隊原地固守。'}</div>`;
    $('#panel').innerHTML = h;
    $('#panel').querySelectorAll('.army').forEach(el => el.onclick = () => { sel = sel === el.dataset.id ? null : el.dataset.id; render(); });
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
  drawNodes(null);
  topBar('<button id="hide">收合面板</button>');
  $('#ui').innerHTML = '<div id="refbox"></div>';
  let game = null, ord = { red: null, blue: null }, hist = [], showQR = true;
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
    if (game.status === 'playing') h += `<button class="btn main" id="res" ${both ? '' : ''}>${both ? '結算本回合' : '結算本回合（未下令者原地固守）'}</button>`;
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
  drawNodes(null);
  topBar('');
  $('#ui').innerHTML = '<div id="screenbox"></div>';
  let pub = null, ord = { red: null, blue: null };
  be.on('view/public', v => { pub = parse(v); render(); });
  be.on('orders/red', v => { ord.red = parse(v); render(); });
  be.on('orders/blue', v => { ord.blue = parse(v); render(); });
  function render() {
    if (!pub) { $('#screenbox').innerHTML = '<div class="muted">等待開局…</div>'; return; }
    setTokens(pub.armies.map(a => ({ army: a })));
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
