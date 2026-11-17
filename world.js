// 立體戰場（移植自《無名之戰：國君的抉擇》）
const MX = 100, MZ = 78;
function smoothPts(pts, it) { it = it || 3; for (let k = 0; k < it; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(pts[pts.length - 1]); pts = o; } return pts; }
function hash2(x, z) { let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, z) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= .5; } return s; }
function sstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); const x = ax + dx * t, z = az + dz * t; return Math.hypot(px - x, pz - z); }
function polyDist(px, pz, pts) { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) { const d = segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (d < m) m = d; } return m; }

// 河流（x 東西，z 南北；北為 -z）
const RIVERS = [
  { name: '北河', w: 2.4, pts: smoothPts([[-170, -40], [-104, -38], [-75, -38.5], [-50, -37], [-20, -37.5], [10, -36.5], [40, -35.5], [70, -35], [104, -34], [170, -31]]) },
  { name: '西溪', w: 1.25, pts: smoothPts([[-92, -38], [-93, -31], [-90.5, -24], [-91.5, -18], [-90, -12.5]]) },
  { name: '南河', w: 3.0, pts: smoothPts([[-170, -22], [-104, -14], [-82, -12], [-62, -8.5], [-40, -5], [-18, -1], [0, 3], [20, 6.5], [42, 10], [62, 13.5], [82, 16.5], [104, 20], [170, 30]]) },
];
const FORDS = [
  { name: '上游淺灘', x: -64, z: -8.4 },
  { name: '主渡口', x: 0, z: 3 },
  { name: '下游淺灘（蘆葦地）', x: 60, z: 13.2 },
];
const ROAD = smoothPts([[31, -46], [29.5, -40], [27, -35.5], [22, -27], [14, -14], [6, -4], [0, 3], [-6, 9], [-14, 17], [-24, 26], [-36, 35], [-50, 45], [-60, 58]], 2);
const PATHS = [
  smoothPts([[-64, -9], [-63, -17], [-58, -26], [-50, -33], [-36, -33.5], [-20, -33.5], [-6, -32], [8, -29.5], [16, -27]], 2), // 北岸小徑
  smoothPts([[60, 13], [58, 4], [52, -6], [46, -17], [40, -26], [36, -29]], 2), // 北岸東小徑
  smoothPts([[-42, 33], [-50, 25], [-56, 15], [-61, 4], [-64, -6]], 2), // 林間小徑（南岸西）
  smoothPts([[-22, 31], [-4, 27], [14, 23], [30, 19.5], [46, 16], [58, 14]], 2), // 南岸東小徑
];
const HILLS = [
  [-50, -27, 4.0, 5.5], [-39, -25.5, 6.0, 6.5], [-28, -26.5, 5.6, 6], [-18, -29.5, 3.6, 5], [-35, -20, 4.8, 4.5], // 北岸小丘
  [-78, -26.5, 5.0, 8], [-68, -31, 3.2, 6], // 北岸西丘
  [77, -27, 4.2, 9], [90, -22, 3.6, 8], [84, -42, 3, 9], // 東北崗地
  [-58, 4.5, 6.2, 8], [-47, 10, 4.6, 7], [-67, 13, 4.2, 7], // 南岸西丘
  [30, 27, 5.6, 7], [41, 31, 3.6, 6], // 南岸小丘
  [-85, 31, 3.6, 10], [-94, 47, 4.2, 10], [76, 43, 3.2, 12], [96, 34, 4.2, 10], [12, 49, 2.4, 10],
  [62, -50, 2.6, 10], [-40, -51, 3.2, 12], [2, -53, 2.2, 10], [-72, -50, 3, 9],
];
const CITY = { x0: 15, x1: 47, z0: -77, z1: -59, h: 1.6 };
const WALL_H = 5.4;
const FORESTS = [
  { x: -77, z: -28, rx: 13, rz: 7, n: 300, c: .7 }, // 北岸西丘林地
  { x: -46, z: -24.5, rx: 8.5, rz: 4.5, n: 120, c: .65 },
  { x: -59, z: -19, rx: 5.5, rz: 3.5, n: 60, c: .5 },
  { x: -35, z: -17, rx: 5, rz: 3, n: 45, c: .7 }, // 北岸小丘南麓小林
  { x: 29, z: -13, rx: 10, rz: 5.5, n: 230, c: .6 }, // 兩河之間林地
  { x: 80, z: -27, rx: 16, rz: 9, n: 380, c: .75 }, // 東北崗地
  { x: -55, z: 7, rx: 15, rz: 8, n: 420, c: .65 }, // 南岸西丘林地
  { x: 29, z: 16.5, rx: 9, rz: 4.3, n: 150, c: .5 }, // 南岸林地
  { x: -83, z: 32, rx: 16, rz: 10, n: 380, c: .6 },
  { x: 45, z: 33, rx: 7, rz: 4.5, n: 80, c: .4 },
  { x: -22, z: -47, rx: 13, rz: 4.5, n: 150, c: .7 },
  { x: 76, z: 45, rx: 18, rz: 8, n: 280, c: .6 },
  { x: 8, z: 46, rx: 10, rz: 5, n: 110, c: .5 },
];
const REEDS = [
  { x: 62, z: 17, rx: 9, rz: 4 }, { x: 52, z: 13.5, rx: 5, rz: 2.4 }, { x: 72, z: 18.5, rx: 5, rz: 2.5 },
  { x: 86, z: -49, rx: 9, rz: 4 },
];
const MARSH = { x: 86, z: -63, rx: 10, rz: 5 };
function inEll(f, x, z) { const a = (x - f.x) / f.rx, b = (z - f.z) / f.rz; return a * a + b * b <= 1; }
function riverD(x, z) { let best = { d: 1e9, w: 1, k: 0 }; for (const r of RIVERS) { const d = polyDist(x, z, r.pts); if (d - r.w < best.d - best.w) best = { d, w: r.w, name: r.name }; } return best; }
function fordNear(x, z) { let m = 1e9; for (const f of FORDS) m = Math.min(m, Math.hypot(x - f.x, z - f.z)); return m; }
function cityK(x, z) { const dx = Math.max(CITY.x0 - x, 0, x - CITY.x1), dz = Math.max(CITY.z0 - z, 0, z - CITY.z1); return 1 - sstep(0, 5, Math.hypot(dx, dz)); }
function rawH(x, z) {
  let h = 0.55 + 1.1 * fbm(x * .05 + 3, z * .05 - 2) - 0.45;
  for (const [hx, hz, hh, r] of HILLS) { const d2 = (x - hx) * (x - hx) + (z - hz) * (z - hz); h += 1.3 * hh * Math.exp(-d2 / (2 * r * r)); }
  const ox = Math.max(0, Math.abs(x) - MX), oz = Math.max(0, Math.abs(z) - MZ), od = Math.hypot(ox, oz); if (od > 0) h += sstep(0, 45, od) * (3 + 9 * fbm(x * .025 + 7, z * .025 + 3));
  const k = cityK(x, z); h = h + (CITY.h - h) * k;
  return h;
}
function Hexact(x, z) {
  let h = rawH(x, z);
  for (const r of RIVERS) {
    const d = polyDist(x, z, r.pts); if (d > r.w * 2.4) continue;
    const fd = fordNear(x, z); const bed = r.name === '西溪' ? -0.55 : -0.95 + 0.62 * (1 - sstep(2.5, 6, fd));
    const t = sstep(r.w * 0.55, r.w * 2.3, d);
    const nh = bed + (Math.max(h, 0.4) - bed) * t; if (nh < h) h = nh;
  }
  return h;
}
const WATER_Y = 0.05;
// 網格（每 0.5 單位）
const GS = 0.5, GW = Math.round(2 * MX / GS) + 1, GD = Math.round(2 * MZ / GS) + 1;
let HG = null, FG = null;
function buildGrids() {
  HG = new Float32Array(GW * GD); FG = new Uint8Array(GW * GD);
  for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) {
    const x = -MX + i * GS, z = -MZ + j * GS; HG[j * GW + i] = Hexact(x, z);
    let f = 0; const rd = riverD(x, z);
    if (rd.d > rd.w * 1.15) { for (const e of FORESTS) if (inEll(e, x, z)) { f = 1; break; } if (!f) for (const e of REEDS) if (inEll(e, x, z)) { f = 2; break; } }
    FG[j * GW + i] = f;
  }
}
function H(x, z) {
  const fx = (x + MX) / GS, fz = (z + MZ) / GS; let i = Math.floor(fx), j = Math.floor(fz);
  i = Math.max(0, Math.min(GW - 2, i)); j = Math.max(0, Math.min(GD - 2, j));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const a = HG[j * GW + i], b = HG[j * GW + i + 1], c = HG[(j + 1) * GW + i], d = HG[(j + 1) * GW + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function F(x, z) { const i = Math.round((x + MX) / GS), j = Math.round((z + MZ) / GS); if (i < 0 || j < 0 || i >= GW || j >= GD) return 0; return FG[j * GW + i]; }
const TREE_H = 2.9, REED_H = 1.35;
// 視線：o、t 皆為 {x,y,z}
function los(o, t) {
  const dx = t.x - o.x, dz = t.z - o.z, dist = Math.hypot(dx, dz); const n = Math.max(2, Math.ceil(dist / 0.5));
  for (let i = 1; i < n; i++) {
    const s = i / n, x = o.x + dx * s, z = o.z + dz * s, y = o.y + (t.y - o.y) * s, g = Math.max(H(x, z), WATER_Y);
    if (y < g + 0.05) return false;
    const dT = dist * (1 - s), dO = dist * s, f = F(x, z);
    if (f === 1 && dO > 2 && dT > 2.2 && y < g + TREE_H) return false;
      }
  return true;
}
// 部隊
const UNITS = [
  { id: 'B1', side: 'blue', x: 5, z: -30, yaw: 0, cols: 8, rows: 5, tag: '藍軍・左' },
  { id: 'B2', side: 'blue', x: 22.5, z: -30.5, yaw: 0, cols: 8, rows: 5, tag: '藍軍・中', lord: true },
  { id: 'B3', side: 'blue', x: 40, z: -30, yaw: 0, cols: 8, rows: 5, tag: '藍軍・右' },
  { id: 'R1', side: 'red', x: 0.5, z: 3.6, yaw: Math.PI + 0.35, cols: 6, rows: 4, tag: '紅一・正在渡河' , water: true },
  { id: 'R2', side: 'red', x: -9.5, z: 12.5, yaw: Math.PI + 0.75, cols: 3, rows: 10, tag: '紅二・大路上' },
  { id: 'R3', side: 'red', x: -68, z: -4.4, yaw: Math.PI - 0.3, cols: 6, rows: 3, tag: '紅三・上游佯動' },
  { id: 'R4', side: 'red', x: -55, z: 9.5, yaw: Math.PI - 0.5, cols: 3, rows: 9, tag: '紅四・林間小徑' },
  { id: 'R5', side: 'red', x: 40, z: 17.6, yaw: Math.PI + 1.15, cols: 3, rows: 9, tag: '紅五・南岸東小徑' },
  { id: 'R6', side: 'red', x: 63, z: 19.2, yaw: Math.PI + 0.2, cols: 5, rows: 4, tag: '紅六・蘆葦地' },
];
function unitPts(u) {
  const pts = []; const sp = 0.74, sz = 0.78; const c = Math.cos(u.yaw), s = Math.sin(u.yaw);
  for (let r = 0; r < u.rows; r++) for (let k = 0; k < u.cols; k++) {
    const lx = (k - (u.cols - 1) / 2) * sp + (hash2(k * 3.1 + r, u.x) - .5) * .12, lz = (r - (u.rows - 1) / 2) * sz + (hash2(r * 7.7 + k, u.z) - .5) * .12;
    // 本地 +z 為面向
    const x = u.x + lx * c + lz * s, z = u.z - lx * s + lz * c; pts.push([x, z]);
  }
  return pts;
}
const OBS = {
  city: { x: 42.5, z: -60.0, eye: 1.6, onWall: true },
  troop: { x: 22.5, z: -37.1, eye: 1.75 },
};
// ===== 兩河之間加寬 70%（以河道中段為準，沿南北方向拉伸） =====
const WZa = -37, WZb = 3, WZm = -17, WZk = 1.7;
function WZ(z) { if (z <= WZa) return z + (WZa - WZm) * (WZk - 1); if (z >= WZb) return z + (WZb - WZm) * (WZk - 1); return WZm + (z - WZm) * WZk; }
(function warpAll() {
  const inBand = z => z > WZa && z < WZb;
  for (const r of RIVERS) r.pts = r.pts.map(p => [p[0], WZ(p[1])]);
  for (const f of FORDS) f.z = WZ(f.z);
  for (let i = 0; i < ROAD.length; i++) ROAD[i] = [ROAD[i][0], WZ(ROAD[i][1])];
  for (const p of PATHS) for (let i = 0; i < p.length; i++) p[i] = [p[i][0], WZ(p[i][1])];
  for (const h of HILLS) { const b = inBand(h[1]); h[1] = WZ(h[1]); if (b) h[3] *= 1.2; }
  for (const f of FORESTS) { const b = inBand(f.z); f.z = WZ(f.z); if (b) { f.rz *= 1.45; f.n = Math.round(f.n * 1.4); } }
  for (const f of REEDS) f.z = WZ(f.z);
  for (const u of UNITS) u.z = WZ(u.z);
})();
function obsPos(k) { const o = OBS[k]; const g = o.onWall ? CITY.h + WALL_H : H(o.x, o.z); return { x: o.x, y: g + o.eye, z: o.z }; }
function unitVisible(u, o) {
  const pts = unitPts(u); const step = Math.max(1, Math.floor(pts.length / 10));
  for (let i = 0; i < pts.length; i += step) { const [x, z] = pts[i]; const t = { x, z, y: Math.max(H(x, z), WATER_Y - 0.3) + 0.95 }; if (los(o, t)) return true; }
  return false;
}
const VG = { cell: 1.0 }; VG.w = Math.round(2 * MX / VG.cell); VG.d = Math.round(2 * MZ / VG.cell);
function visGrid(o) {
  const g = new Uint8Array(VG.w * VG.d);
  for (let j = 0; j < VG.d; j++) for (let i = 0; i < VG.w; i++) {
    const x = -MX + (i + .5) * VG.cell, z = -MZ + (j + .5) * VG.cell; const t = { x, z, y: Math.max(H(x, z), WATER_Y) + 1.0 };
    g[j * VG.w + i] = los(o, t) ? 1 : 0;
  }
  return g;
}
if (typeof module !== 'undefined') module.exports = { OBS, WZ, los, polyDist, PATHS, ROAD, FORESTS, REEDS, CITY, WALL_H, WATER_Y, inEll, buildGrids, UNITS, unitVisible, obsPos, visGrid, H, F, VG };

// ===== 無名之戰：規則引擎（不依賴畫面，可在 node 測試） =====

// ===== 泓水之戰．雙盲推演：16 個點位在立體地形上的位置 =====
const RULES = (function () {
  const NODES = {
    S:  { name: '楚營',       x: -42, z: 53 },
    W1: { name: '南岸小徑',   x: -50, z: 39 },
    W2: { name: '上游淺灘',   x: -64, z: -2.4, water: 1 },
    W3: { name: '北岸西丘',   x: -61, z: -10.5 },
    W4: { name: '北岸小丘',   x: -34, z: -30.5 },
    W5: { name: '西路口',     x: -6,  z: -42.5 },
    C1: { name: '南岸路口',   x: -20, z: 37 },
    C2: { name: '主渡口',     x: 0,   z: 17, water: 1 },
    C3: { name: '主渡口北岸', x: 4.5, z: 9.5 },
    C4: { name: '中路',       x: 17,  z: -20 },
    E1: { name: '南岸小丘',   x: 28,  z: 34 },
    E2: { name: '下游渡口',   x: 60,  z: 27.2, water: 1 },
    E3: { name: '下游北岸',   x: 57,  z: 19.5 },
    E4: { name: '東路',       x: 49,  z: -8 },
    E5: { name: '東路口',     x: 40,  z: -32 },
    H:  { name: '宋營',       x: 22.5, z: -39 },
  };
  const isNode = p => p && p.n != null;
  const worldOf = p => [NODES[p.n].x, NODES[p.n].z];
  return { NODES, isNode, worldOf };
})();

function bootScene(){
// ===== 場景 =====
const $ = s => document.querySelector(s);
const hexA = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- 五種風格 ----------
const STY = {

  B: {
    key: 'B', name: '乙・印象油畫', sub: '厚塗筆觸、黃昏斜陽與暖色天空，像掛在牆上的戰場油畫',
    mat: 'lambert', post: 2,
    sky: { top: '#4f78ad', hor: '#f2c68e', cloud: '#fbe2bc', amt: .55, hard: 0, sun: '#ffd28a' },
    fog: ['#d9c6a4', 120, 420], sun: ['#ffd29a', 1.45, [-90, 55, 40]], hemi: ['#f4e6cc', '#4a4a3a', .7],
    P: { g1: '#7f9a4a', g2: '#5f7a3a', dry: '#a99a58', sand: '#dcb878', hill: '#9e8a4e', ff: '#4a5628', reed: '#cfa858', bed: '#5f8a9a', town: '#bc9a70', road: '#dcb97e', path: '#ead09e', water: '#3f78a8', con1: '#3c5a30', con2: '#2b4226', dec1: '#cc6f28', dec2: '#a88a2c', trunk: '#4a3020', wall: '#bfae8e', roof: '#4c3a38', house: '#dcc8a2', red: '#b8261c', blue: '#244e92', skin: '#e2b08a', iron: '#2e2a2a', mark: '#fff0c8', foam: '#fff4e0', flagTrim: '#e8c060' },
  },

  D: {
    key: 'D', name: '丁・全息推演室', sub: '黑底發光等高線與方格，像現代作戰中心的立體沙盤',
    mat: 'holo', post: 4,
    sky: { top: '#01040a', hor: '#052430', cloud: '#0a3a48', amt: 0, hard: 0, sun: '#000000' },
    fog: ['#03121a', 160, 460], sun: ['#ffffff', 0, [40, 90, 70]], hemi: ['#ffffff', '#000000', 0],
    P: { g1: '#04141c', g2: '#04141c', dry: '#04141c', sand: '#06202a', hill: '#04141c', ff: '#04141c', reed: '#2a2a10', bed: '#031a33', town: '#0a2030', road: '#7a5e1c', path: '#a07a20', water: '#0f62c8', con1: '#0b4a40', con2: '#0a3c36', dec1: '#0e5a4a', dec2: '#0b4a40', trunk: '#06302a', wall: '#1a5a7a', roof: '#2a7aa0', house: '#123e58', red: '#ff3b30', blue: '#2f9bff', skin: '#ff8a80', iron: '#ffffff', mark: '#ffd23f', foam: '#6ff', flagTrim: '#ffffff' },
  },

};
let CUR = STY.B;

// ---------- 渲染器 ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let PR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(PR);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 700);
const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, .6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -115; sc.right = 115; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 400; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

const reg = []; // {obj, role, vc}
function addMesh(geo, role, opt) {
  opt = opt || {}; const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.castShadow = opt.cast !== false; m.receiveShadow = opt.recv !== false;
  reg.push({ obj: m, role, vc: !!opt.vc, inst: false, op: opt.op }); (opt.parent || scene).add(m); return m;
}
function addInst(geo, n, role, opt) {
  opt = opt || {}; const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), n); m.castShadow = opt.cast !== false; m.receiveShadow = opt.recv !== false;
  m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  reg.push({ obj: m, role, inst: true, colorFn: opt.colorFn }); (opt.parent || scene).add(m); return m;
}
const GRAD = (() => { const d = new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
function holoColor(role) {
  const P = STY.D.P; const map = { trunk: P.trunk, con: P.con1, dec: P.dec1, wall: P.wall, roof: P.roof, house: P.house, water: P.water, road: P.road, path: P.path, mark: P.mark, red: P.red, blue: P.blue, iron: '#ffffff', skin: '#88aaff', foam: P.foam, bridge: P.road, reed: P.reed, flagTrim: '#ffffff', wood: '#2a5a6a' };
  return map[role] || '#0a3a48';
}
function roleColor(role) { const P = CUR.P; const m = { wood: '#6a4a2c', bridge: '#8a6a44', con: P.con1, dec: P.dec1 }; return P[role] || m[role] || '#888888'; }
function makeMat(e) {
  const s = CUR; const opq = e.role === 'water' ? { transparent: true, opacity: s.mat === 'holo' ? .55 : .8 } : {};
  if (e.role.startsWith('flag_')) opq.side = THREE.DoubleSide;
  if (s.mat === 'holo') {
    const c = e.inst && e.colorFn ? '#ffffff' : holoColor(e.role);
    return new THREE.MeshBasicMaterial(Object.assign({ color: c, vertexColors: !!e.vc }, opq));
  }
  const col = e.inst && e.colorFn ? '#ffffff' : (e.vc ? '#ffffff' : roleColor(e.role));
  if (s.mat === 'toon') return new THREE.MeshToonMaterial(Object.assign({ color: col, gradientMap: GRAD, vertexColors: !!e.vc }, opq));
  return new THREE.MeshLambertMaterial(Object.assign({ color: col, vertexColors: !!e.vc }, opq));
}

// ---------- 地形 ----------
buildGrids();
const TW = 300, TD = 260;
const tGeo = new THREE.PlaneGeometry(TW, TD, 270, 190); tGeo.rotateX(-Math.PI / 2);
const inMap = (x, z) => Math.abs(x) <= MX && Math.abs(z) <= MZ;
const TC = []; // 每頂點快取
{ const p = tGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const h = inMap(x, z) ? H(x, z) : Hexact(x, z); p.setY(i, h); const rd = riverD(x, z);
    TC.push({ x, z, h, rd, f: inMap(x, z) ? F(x, z) : (fbm(x * .04 + 11, z * .04) > .56 ? 1 : 0), ck: cityK(x, z), n1: sstep(.3, .7, fbm(x * .07, z * .07)), n2: sstep(.52, .72, fbm(x * .22 + 9, z * .22)), ms: inEll(MARSH, x, z) }); }
  tGeo.computeVertexNormals(); }
tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tGeo.attributes.position.count * 3), 3));
const terrain = addMesh(tGeo, 'terrain', { vc: true, cast: false });
const roadD = (x, z) => polyDist(x, z, ROAD);
function groundCol(t, P) {
  let c = mixA(hexA(P.g1), hexA(P.g2), t.n1);
  c = mixA(c, hexA(P.dry), t.n2 * .5);
  c = mixA(c, hexA(P.hill), sstep(2.6, 7.5, t.h) * .7);
  if (t.f === 1) c = mixA(c, hexA(P.ff), .7); if (t.f === 2 || t.ms) c = mixA(c, hexA(P.reed), .6);
  if (t.ck > .5) c = mixA(c, hexA(P.town), .8);
  const rd = t.rd; c = mixA(c, hexA(P.sand), 1 - sstep(rd.w * 1.2, rd.w * 2.1, rd.d));
  if (t.h < WATER_Y) c = mixA(hexA(P.sand), hexA(P.bed), sstep(WATER_Y, -0.6, t.h));
  return c;
}
function paintTerrain() {
  const col = tGeo.attributes.color, P = CUR.P;
  for (let i = 0; i < TC.length; i++) { const c = groundCol(TC[i], P); col.setXYZ(i, c[0], c[1], c[2]); }
  col.needsUpdate = true;
}
// 全息地形材質（等高線）
const holoTerrainMat = new THREE.ShaderMaterial({
  extensions: { derivatives: true },
  uniforms: { },
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vW;
  float line(float v,float w){ float d=abs(fract(v-.5)-.5)/fwidth(v); return 1.-min(d/w,1.); }
  void main(){ float h=vW.y; vec3 c=vec3(.012,.05,.07);
    float ct=line(h/0.7,1.0); float major=line(h/3.5,1.4);
    float gx=line(vW.x/10.,0.8), gz=line(vW.z/10.,0.8);
    c+=vec3(.1,.85,.95)*ct*.55 + vec3(.3,1.,1.)*major*.6;
    c+=vec3(.05,.35,.45)*max(gx,gz)*.6;
    if(h<0.06){ c=mix(c,vec3(.02,.25,.6),.7); c+=vec3(.2,.6,1.)*line(h/0.25,1.)*.4; }
    gl_FragColor=vec4(c,1.); }`,
});

// ---------- 水面 ----------
function ribbon(pts, half, yFn, dash) {
  const pos = [], idx = []; let n = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx; const [x, z] = pts[i];
    pos.push(x + nx * half, yFn(x + nx * half, z + nz * half), z + nz * half, x - nx * half, yFn(x - nx * half, z - nz * half), z - nz * half);
    if (i > 0) { const k = n - 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } n += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function resample(pts, step) { const o = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = step - acc; while (t <= l) { o.push([a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l]); t += step; } acc = l - (t - step); } o.push(pts[pts.length - 1]); return o; }
for (const r of RIVERS) { const g = ribbon(resample(r.pts, 0.8), r.w * 1.55, () => WATER_Y, 0); const m = addMesh(g, 'water', { cast: false }); m.renderOrder = 2; }
// 西溪急流白浪
{ const pts = resample(RIVERS[1].pts, .7); const R = rnd(7); const n = pts.length * 3; const im = addInst(new THREE.BoxGeometry(.5, .04, .12), n, 'foam', { cast: false }); const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const p = pts[i % pts.length]; o.position.set(p[0] + (R() - .5) * 1.6, WATER_Y + .03, p[1] + (R() - .5) * .8); o.rotation.set(0, (R() - .5) * .6, 0); o.scale.set(.6 + R(), 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } }

// ---------- 道路與小徑 ----------
{ const g = ribbon(resample(ROAD, .6), .8, (x, z) => Math.max(H(x, z), WATER_Y - .35) + .05); addMesh(g, 'road', { cast: false }); }
{ const dashes = []; for (const p of PATHS) { const r = resample(p, 1.15); for (let i = 0; i < r.length - 1; i += 1) if (i % 2 === 0) dashes.push([r[i], r[i + 1]]); }
  const im = addInst(new THREE.BoxGeometry(1, .06, .32), dashes.length, 'path', { cast: false }); const o = new THREE.Object3D();
  dashes.forEach((d, i) => { const [a, b] = d; const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2; o.position.set(x, Math.max(H(x, z), WATER_Y) + .07, z); o.rotation.set(0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0); o.scale.set(Math.hypot(b[0] - a[0], b[1] - a[1]) * .75, 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); }
// 北河上的木橋
{ const b = addMesh(new THREE.BoxGeometry(2.2, .3, 8.5), 'bridge'); const x = 28.2, z = WZ(-36.1); b.position.set(x, .55, z); b.rotation.y = 0.32;
  for (const s of [-1, 1]) { const rail = addMesh(new THREE.BoxGeometry(.12, .35, 8.5), 'wood'); rail.position.set(x + s * 1.0 * Math.cos(.32), .85, z - s * 1.0 * Math.sin(.32)); rail.rotation.y = .32; } }
// 渡口標記（圓環）
for (const f of FORDS) { const g = new THREE.RingGeometry(3.0, 3.6, 48); g.rotateX(-Math.PI / 2); const m = addMesh(g, 'mark', { cast: false, recv: false }); m.position.set(f.x, WATER_Y + .06, f.z); m.renderOrder = 3; }

// ---------- 樹林與蘆葦 ----------
const TY = t => t.out ? Hexact(t.x, t.z) : H(t.x, t.z);
const trees = []; {
  const R = rnd(11);
  const okSpot = (x, z, rr) => { const rd = riverD(x, z); if (rd.d < rd.w * 1.7) return false; if (roadD(x, z) < 1.4) return false; if (cityK(x, z) > .05) return false; for (const p of PATHS) if (polyDist(x, z, p) < .9) return false; for (const k in RULES.NODES) { const nd = RULES.NODES[k]; if (nd.forest || nd.water) continue; if (Math.hypot(x - nd.x, z - nd.z) < (nd.city ? 0 : 6)) return false; } return true; };
  for (const f of FORESTS) for (let i = 0; i < f.n; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * .97; const x = f.x + Math.cos(a) * r * f.rx, z = f.z + Math.sin(a) * r * f.rz; if (Math.abs(x) > MX - 1 || Math.abs(z) > MZ - 1) continue; if (!okSpot(x, z, f === FORESTS[5] ? 2.2 : 4)) continue; if (F(x, z) !== 1) continue; trees.push({ x, z, con: R() < f.c, s: .75 + R() * .6, t: R() }); }
  for (let i = 0; i < 1400; i++) { const x = (R() * 2 - 1) * TW / 2, z = (R() * 2 - 1) * TD / 2; if (inMap(x, z)) continue; if (fbm(x * .04 + 11, z * .04) < .53) continue; const rd = riverD(x, z); if (rd.d < rd.w * 2) continue; trees.push({ x, z, con: R() < .6, s: .8 + R() * .7, t: R(), out: true }); }
  for (let i = 0; i < 760; i++) { const x = (R() * 2 - 1) * (MX - 2), z = (R() * 2 - 1) * (MZ - 2); if (F(x, z) !== 0) continue; if (x > -8 && x < 48 && z > WZ(-34) && z < WZ(1)) continue; if (x > -30 && x < 10 && z > WZ(-6) && z < WZ(30) && R() < .7) continue; if (!okSpot(x, z, 6)) continue; if (inEll(MARSH, x, z)) continue; trees.push({ x, z, con: R() < .3, s: .6 + R() * .5, t: R() }); }
}
{
  const con = trees.filter(t => t.con), dec = trees.filter(t => !t.con); const o = new THREE.Object3D();
  const trunk = addInst(new THREE.CylinderGeometry(.09, .14, 1, 5), trees.length, 'trunk');
  trees.forEach((t, i) => { const y = TY(t); o.position.set(t.x, y + .45 * t.s, t.z); o.rotation.set(0, 0, 0); o.scale.set(t.s, t.s, t.s); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix); });
  const cg = new THREE.ConeGeometry(.95, 2.5, 7); cg.translate(0, 1.95, 0);
  const cm = addInst(cg, con.length, 'con', { colorFn: i => mixA(hexA(CUR.P.con1), hexA(CUR.P.con2), con[i].t) });
  con.forEach((t, i) => { const y = TY(t); o.position.set(t.x, y, t.z); o.rotation.set(0, t.t * 6, 0); o.scale.set(t.s, t.s * (0.9 + t.t * .3), t.s); o.updateMatrix(); cm.setMatrixAt(i, o.matrix); });
  const dg = new THREE.IcosahedronGeometry(1, 0); dg.scale(1, 1.1, 1); dg.translate(0, 1.85, 0);
  const dm = addInst(dg, dec.length, 'dec', { colorFn: i => mixA(hexA(CUR.P.dec1), hexA(CUR.P.dec2), dec[i].t) });
  dec.forEach((t, i) => { const y = TY(t); o.position.set(t.x, y, t.z); o.rotation.set(t.t, t.t * 9, 0); o.scale.setScalar(t.s); o.updateMatrix(); dm.setMatrixAt(i, o.matrix); });
}
{
  const R = rnd(23); const pts = [];
  for (const e of REEDS) for (let i = 0; i < 760; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()); const x = e.x + Math.cos(a) * r * e.rx, z = e.z + Math.sin(a) * r * e.rz; const h = H(x, z); if (h < WATER_Y - .25) continue; if (roadD(x, z) < 1) continue; let skip = false; for (const p of PATHS) if (polyDist(x, z, p) < .7) skip = true; if (skip) continue; pts.push([x, z, h, R()]); }
  const g = new THREE.ConeGeometry(.07, 1, 3); g.translate(0, .5, 0);
  const im = addInst(g, pts.length, 'reed', { cast: false, colorFn: i => mixA(hexA(CUR.P.reed), hexA(CUR.P.dry), pts[i][3] * .6) }); const o = new THREE.Object3D();
  pts.forEach((p, i) => { o.position.set(p[0], Math.max(p[2], WATER_Y - .2), p[1]); o.rotation.set((p[3] - .5) * .5, p[3] * 6, (p[3] - .3) * .4); o.scale.set(1, 1.0 + p[3] * .5, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
}

// 草叢與碎石
{ const R = rnd(41); const pts = []; for (let i = 0; i < 12000 && pts.length < 5200; i++) { const x = (R() * 2 - 1) * MX, z = (R() * 2 - 1) * MZ; const h = H(x, z); if (h < .25) continue; if (F(x, z) === 1) continue; if (roadD(x, z) < 1.2 || cityK(x, z) > .1) continue; pts.push([x, z, h, R()]); }
  const g = new THREE.IcosahedronGeometry(.22, 0); g.scale(1.3, .55, 1.3); g.translate(0, .06, 0);
  const im = addInst(g, pts.length, 'tuft', { cast: false, colorFn: i => mixA(hexA(CUR.P.g2), hexA(CUR.P.ff), .35 + pts[i][3] * .4) }); const o = new THREE.Object3D();
  pts.forEach((p, i) => { o.position.set(p[0], p[2], p[1]); o.rotation.set(0, p[3] * 6, 0); const s = .6 + p[3] * .7; o.scale.set(s, s, s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); }

// ---------- 城邑 ----------
{
  const cx = (CITY.x0 + CITY.x1) / 2, cz = (CITY.z0 + CITY.z1) / 2, W = CITY.x1 - CITY.x0, Dd = CITY.z1 - CITY.z0, y0 = CITY.h, WH = WALL_H, T = 2.0;
  const wall = (x, z, w, d) => { const m = addMesh(new THREE.BoxGeometry(w, WH, d), 'wall'); m.position.set(x, y0 + WH / 2, z); };
  wall(cx, CITY.z0, W, T); wall(CITY.x0, cz, T, Dd); wall(CITY.x1, cz, T, Dd);
  const gap = 4.4; wall((CITY.x0 + cx - gap / 2) / 2, CITY.z1, cx - gap / 2 - CITY.x0, T); wall((CITY.x1 + cx + gap / 2) / 2, CITY.z1, CITY.x1 - cx - gap / 2, T);
  // 垛口
  const merl = []; const add = (x, z, rot) => merl.push([x, z, rot]);
  for (let x = CITY.x0; x <= CITY.x1; x += 1.5) { add(x, CITY.z0 - T / 2 + .2, 0); if (Math.abs(x - cx) > 4.6 && Math.abs(x - OBS.city.x) > 5.5) add(x, CITY.z1 + T / 2 - .2, 0); }
  for (const [a, b] of [[CITY.x0, cx - 4.4], [cx + 4.4, CITY.x1]]) { const pp = addMesh(new THREE.BoxGeometry(b - a, .32, .3), 'wall'); pp.position.set((a + b) / 2, y0 + WH + .16, CITY.z1 + T / 2 - .15); }
  for (let z = CITY.z0; z <= CITY.z1; z += 1.5) { add(CITY.x0 - T / 2 + .2, z, 1); add(CITY.x1 + T / 2 - .2, z, 1); }
  const mi = addInst(new THREE.BoxGeometry(.8, .7, .35), merl.length, 'wall'); const o = new THREE.Object3D();
  merl.forEach((m, i) => { o.position.set(m[0], y0 + WH + .35, m[1]); o.rotation.set(0, m[2] ? Math.PI / 2 : 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); mi.setMatrixAt(i, o.matrix); });
  // 城門樓
  const gb = addMesh(new THREE.BoxGeometry(8.4, 3.0, 4.0), 'house'); gb.position.set(cx, y0 + WH + 1.5, CITY.z1);
  const roof = (x, y, z, w, d, h) => { const g = new THREE.ConeGeometry(1, 1, 4); g.rotateY(Math.PI / 4); const m = addMesh(g, 'roof'); m.position.set(x, y + h / 2, z); m.scale.set(w * .75, h, d * .75); };
  roof(cx, y0 + WH + 3.0, CITY.z1, 10.8, 6.0, 2.4);
  const gate = addMesh(new THREE.BoxGeometry(4.0, 4.0, 2.4), 'wood'); gate.position.set(cx, y0 + 2.0, CITY.z1 - .1);
  // 角樓
  for (const [x, z] of [[CITY.x0, CITY.z0], [CITY.x1, CITY.z0], [CITY.x0, CITY.z1], [CITY.x1, CITY.z1]]) { const t = addMesh(new THREE.BoxGeometry(4, WH + 1.8, 4), 'wall'); t.position.set(x, y0 + (WH + 1.8) / 2, z); roof(x, y0 + WH + 1.8, z, 5.2, 5.2, 1.8); }
  // 宮室與民居
  const pal = addMesh(new THREE.BoxGeometry(10, 3, 5.2), 'house'); pal.position.set(cx, y0 + 1.5, CITY.z0 + 5); roof(cx, y0 + 3, CITY.z0 + 5, 12.8, 7.2, 2.8);
  const pb = addMesh(new THREE.BoxGeometry(13, .6, 7), 'wall'); pb.position.set(cx, y0 + .3, CITY.z0 + 5);
  const R = rnd(31); const hs = [];
  for (let x = CITY.x0 + 2.4; x < CITY.x1 - 2.0; x += 2.4) for (let z = CITY.z0 + 2.4; z < CITY.z1 - 2.0; z += 2.2) { if (Math.abs(x - cx) < 7.5 && z < CITY.z0 + 9.5) continue; if (Math.abs(x - cx) < 2.2) continue; if (R() < .18) continue; hs.push([x + (R() - .5) * .4, z + (R() - .5) * .3, 1.4 + R() * .6, 1.2 + R() * .5, .9 + R() * .4]); }
  const hb = addInst(new THREE.BoxGeometry(1, 1, 1), hs.length, 'house'); const rg = new THREE.ConeGeometry(1, 1, 4); rg.rotateY(Math.PI / 4); const hr = addInst(rg, hs.length, 'roof');
  hs.forEach((h, i) => { o.position.set(h[0], y0 + h[4] / 2, h[1]); o.rotation.set(0, 0, 0); o.scale.set(h[2], h[4], h[3]); o.updateMatrix(); hb.setMatrixAt(i, o.matrix); o.position.set(h[0], y0 + h[4] + .32, h[1]); o.scale.set(h[2] * .78, .65, h[3] * .78); o.updateMatrix(); hr.setMatrixAt(i, o.matrix); });
}

const _rc = roleColor; roleColor = function (r) { if (r === 'flag_red') return CUR.P.red; if (r === 'flag_blue') return CUR.P.blue; return _rc(r); };
const _hc = holoColor; holoColor = function (r) { if (r === 'flag_red') return STY.D.P.red; if (r === 'flag_blue') return STY.D.P.blue; return _hc(r); };

// ---------- 天空 ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { topC: { value: new THREE.Color() }, horC: { value: new THREE.Color() }, cloudC: { value: new THREE.Color() }, sunC: { value: new THREE.Color() }, amt: { value: .4 }, hard: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
  vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
  fragmentShader: `uniform vec3 topC,horC,cloudC,sunC; uniform float amt,hard; uniform vec3 sunDir; varying vec3 vD;
  float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.02; a*=.5; } return s; }
  void main(){ vec3 d=normalize(vD); float h=max(d.y,0.); vec3 c=mix(horC,topC,pow(h,.5));
    vec2 p=d.xz/(d.y+.12)*1.3; float n=fbm(p+vec2(4.,1.));
    float th=1.-amt*0.62; float cl=(hard>.5? step(th,n) : smoothstep(th-.12,th+.12,n))*smoothstep(0.,.12,d.y);
    vec3 cc=cloudC; if(hard>.5){ float sh=step(th+.06,fbm(p+vec2(4.,1.)+vec2(.06,.08))); cc=mix(cloudC*vec3(.78,.84,.95),cloudC,sh);} else { cc=mix(cloudC*.9,cloudC,smoothstep(.4,.8,fbm(p*2.))); }
    c=mix(c,cc,cl*(amt>0.?1.:0.));
    float s=max(dot(d,normalize(sunDir)),0.); c+=sunC*(pow(s,40.)*.8+pow(s,6.)*.15);
    gl_FragColor=vec4(c,1.); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
// ---------- 後製 ----------
let rt = null;
function makeRT(w, h) {
  if (rt) { rt.depthTexture.dispose(); rt.dispose(); }
  rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
  rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType;
}
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); postScene.add(postQuad);
const POST_COMMON = `precision highp float;
uniform sampler2D tColor,tDepth; uniform vec2 res; uniform float cn,cf,time; varying vec2 vUv;
float ld(vec2 uv){ float z=texture2D(tDepth,uv).x*2.-1.; return 2.*cn*cf/(cf+cn-z*(cf-cn)); }
float iw(vec2 uv){ return 1./ld(uv); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }
float edgeAt(vec2 uv,float px){ vec2 o=px/res; float w=iw(uv); float l=iw(uv-vec2(o.x,0.)),r=iw(uv+vec2(o.x,0.)),u=iw(uv+vec2(0.,o.y)),b=iw(uv-vec2(0.,o.y));
  return (abs(l+r-2.*w)+abs(u+b-2.*w))/w; }
float luma(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
vec3 sat(vec3 c,float s){ float l=luma(c); return mix(vec3(l),c,s); }
vec3 tex(vec2 uv){ return texture2D(tColor,uv).rgb; }
`;
const POST = {
  1: `void main(){ vec2 uv=vUv; vec3 c=tex(uv); c=sat(c,1.12);
      float e=edgeAt(uv,1.4); float d=ld(uv); float thr=.012+d*.0003; float ln=smoothstep(thr,thr*2.2,e);
      vec2 o=1.2/res; float cl=length(tex(uv+vec2(o.x,0.))-tex(uv-vec2(o.x,0.)))+length(tex(uv+vec2(0.,o.y))-tex(uv-vec2(0.,o.y)));
      ln=max(ln,smoothstep(.55,.9,cl)*.7);
      c=mix(c,vec3(.08,.07,.12),ln*.9);
      gl_FragColor=vec4(c,1.); }`,
  2: `void main(){ vec2 uv=vUv; vec2 px=1./res; float jit=(fbm(uv*res/9.)-.5)*1.6; const int R=4;
      vec3 m[4]; vec3 s[4]; for(int k=0;k<4;k++){ m[k]=vec3(0.); s[k]=vec3(0.); }
      for(int j=-R;j<=0;j++) for(int i=-R;i<=0;i++){ vec3 c0=tex(uv+vec2(float(i),float(j))*px*1.5); m[0]+=c0; s[0]+=c0*c0;
         vec3 c1=tex(uv+vec2(float(i+R),float(j))*px*1.5); m[1]+=c1; s[1]+=c1*c1;
         vec3 c2=tex(uv+vec2(float(i),float(j+R))*px*1.5); m[2]+=c2; s[2]+=c2*c2;
         vec3 c3=tex(uv+vec2(float(i+R),float(j+R))*px*1.5); m[3]+=c3; s[3]+=c3*c3; }
      float n=float((R+1)*(R+1)); float best=1e9; vec3 col=vec3(0.);
      for(int k=0;k<4;k++){ vec3 mu=m[k]/n; vec3 v=abs(s[k]/n-mu*mu); float vv=v.r+v.g+v.b; if(vv<best){ best=vv; col=mu; } }
      col=sat(col,1.12); col=pow(col,vec3(.95));
      float e=edgeAt(uv,2.); col=mix(col,col*vec3(.45,.36,.28),smoothstep(.02,.06,e)*.45);
      vec2 q=uv*res; float weave=(sin(q.x*1.1)*sin(q.y*1.1))*.025+(fbm(q*.35)-.5)*.06;
      float stroke=(fbm(vec2(q.x*.05+q.y*.11,q.y*.02))-.5)*.08;
      col+=weave+stroke; vec2 cc=uv-.5; col*=1.-dot(cc,cc)*.5;
      gl_FragColor=vec4(col,1.); }`,
  3: `void main(){ vec2 uv=vUv; vec2 px=1./res; vec2 q=uv*res;
      vec2 wob=(vec2(fbm(q/38.),fbm(q/38.+7.3))-.5)*px*7.;
      vec3 c=tex(uv+wob); vec3 b=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*.785; b+=tex(uv+wob+vec2(cos(a),sin(a))*px*3.5); } b/=8.;
      vec3 bw=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*.785+.39; bw+=tex(uv+vec2(cos(a),sin(a))*px*9.); } bw/=8.;
      vec3 col=mix(c,b,.55);
      float pool=clamp(length(c-bw)*2.4,0.,1.); col*=1.-pool*.32;
      col=sat(col,.92); col=mix(col,vec3(1.),.06);
      float gran=fbm(q/5.)*.5+fbm(q/18.)*.5; col*=.9+.13*gran;
      float e=edgeAt(uv+wob*.5,1.5); col=mix(col,col*vec3(.55,.45,.4),smoothstep(.02,.08,e)*.4);
      vec3 paper=vec3(.975,.96,.93); float bd=min(min(uv.x,1.-uv.x)*res.x/res.y,min(uv.y,1.-uv.y)); float fade=smoothstep(.0,.08+fbm(q/60.)*.06,bd);
      col=mix(paper,col,fade); col*=.97+.03*h21(floor(q/2.));
      gl_FragColor=vec4(col,1.); }`,
  4: `void main(){ vec2 uv=vUv; vec2 px=1./res; vec3 c=tex(uv);
      float e=edgeAt(uv,1.); float ln=smoothstep(.006,.03,e);
      vec3 col=c+vec3(.15,.95,1.)*ln*.75;
      vec3 bl=vec3(0.); for(int i=0;i<12;i++){ float a=float(i)*.5236; vec3 s=tex(uv+vec2(cos(a),sin(a))*px*6.); bl+=max(s-.35,0.); } col+=bl/12.*1.4;
      col*=.9+.1*sin(uv.y*res.y*1.4); col+=vec3(.0,.03,.05)*h21(floor(uv*res)+time);
      vec2 cc=uv-.5; col*=1.-dot(cc,cc)*.9;
      gl_FragColor=vec4(col,1.); }`,
  5: `void main(){ vec2 uv=vUv; vec2 q=uv*res; vec3 c=tex(uv); float L=luma(c);
      vec3 paper=vec3(.975,.965,.94);
      float a1=.62, a2=-.9; vec2 r1=vec2(cos(a1)*q.x+sin(a1)*q.y,-sin(a1)*q.x+cos(a1)*q.y); vec2 r2=vec2(cos(a2)*q.x+sin(a2)*q.y,-sin(a2)*q.x+cos(a2)*q.y);
      float s1=fbm(vec2(r1.x*.045,r1.y*.9)); float s2=fbm(vec2(r2.x*.045,r2.y*.9)+5.);
      float dk=1.-L; float cov=clamp(dk*1.9+.25-s1*1.1,0.,1.); cov=max(cov,clamp((dk-.45)*2.4-s2*1.,0.,1.));
      cov=max(cov,.32); vec3 pc=sat(c,1.35)*.92;
      vec3 col=mix(paper,pc,cov);
      vec2 j=(vec2(fbm(q/14.),fbm(q/14.+3.))-.5)*3./res; float e=edgeAt(uv+j,1.3);
      col=mix(col,vec3(.22,.21,.24),smoothstep(.015,.06,e)*.75);
      col*=.94+.06*fbm(q/2.5);
      gl_FragColor=vec4(col,1.); }`,
};
const postMats = {};
function getPost(n) { if (!postMats[n]) postMats[n] = new THREE.ShaderMaterial({ uniforms: { tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2() }, cn: { value: camera.near }, cf: { value: camera.far }, time: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`, fragmentShader: POST_COMMON + POST[n], depthTest: false, depthWrite: false }); return postMats[n]; }

// ---------- 套用風格 ----------
function applyStyle(k) {
  CUR = STY[k];
  for (const e of reg) {
    if (e.obj === terrain && CUR.mat === 'holo') { if (e.obj.material !== holoTerrainMat) e.obj.material.dispose(); e.obj.material = holoTerrainMat; continue; }
    if (e.obj.material && e.obj.material !== holoTerrainMat) e.obj.material.dispose();
    e.obj.material = makeMat(e);
    if (e.inst && e.colorFn) { const c = new THREE.Color(); const mesh = e.obj; for (let i = 0; i < mesh.count; i++) { const a = CUR.mat === 'holo' ? hexA(holoColor(e.role)) : e.colorFn(i); c.setRGB(a[0], a[1], a[2]); mesh.setColorAt(i, c); } mesh.instanceColor.needsUpdate = true; }
  }
  if (CUR.mat !== 'holo') paintTerrain();
  const S = CUR.sky; skyMat.uniforms.topC.value.set(S.top); skyMat.uniforms.horC.value.set(S.hor); skyMat.uniforms.cloudC.value.set(S.cloud); skyMat.uniforms.sunC.value.set(S.sun); skyMat.uniforms.amt.value = S.amt; skyMat.uniforms.hard.value = S.hard;
  scene.fog = new THREE.Fog(CUR.fog[0], CUR.fog[1], CUR.fog[2]);
  sun.color.set(CUR.sun[0]); sun.intensity = CUR.sun[1]; sun.position.set(...CUR.sun[2]); sun.castShadow = CUR.mat !== 'holo';
  skyMat.uniforms.sunDir.value.set(...CUR.sun[2]).normalize();
  hemi.color.set(CUR.hemi[0]); hemi.groundColor.set(CUR.hemi[1]); hemi.intensity = CUR.hemi[2];
  postQuad.material = getPost(CUR.post);
  document.body.dataset.style = k;
  if (window.onStyleApplied) window.onStyleApplied(k);
  if (window.UNITS_RESTYLE) window.UNITS_RESTYLE();
  dirty = true;
}

// ---------- 標籤 ----------
const PLACES = [
  ['城邑（藍軍國都）', 31, -68, 10, 3], ['北河', -8, WZ(-37.3), .8, 1], ['南河', -84, WZ(-11.9), .8, 1], ['西溪（急流）', -91, WZ(-25), 1, 1],
  ['北岸西丘', -77, WZ(-27), 7, 2], ['東北崗地', 82, WZ(-27), 6.5, 2],
  ['南岸西丘林地', -57, WZ(4), 8, 2], ['南岸林地', 29, WZ(16.5), 4.2, 1], ['南岸小丘', 31, WZ(27), 7.5, 2], ['沼澤', 86, -63, 1.2, 1],
];
const labels = [];
const labLayer = $('#labels');
function mkLabel(text, cls, prio, pos) { const d = document.createElement('div'); d.className = 'lab ' + cls; d.textContent = text; labLayer.appendChild(d); const L = { d, prio, pos, text, cls, show: true }; labels.push(L); return L; }
for (const p of PLACES) mkLabel(p[0], p[5] || 'place', p[4], new THREE.Vector3(p[1], H(p[1], p[2]) + p[3], p[2]));
const _v = new THREE.Vector3();
function layoutLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight; const placed = [];
  const list = labels.filter(l => l.show).sort((a, b) => b.prio - a.prio);
  for (const l of labels) if (!l.show) l.d.style.display = 'none';
  for (const l of list) {
    _v.copy(l.pos).project(camera); const vis = _v.z < 1 && _v.x > -1.05 && _v.x < 1.05 && _v.y > -1.05 && _v.y < 1.05;
    if (!vis) { l.d.style.display = 'none'; continue; }
    const x = (_v.x * .5 + .5) * w, y = (-_v.y * .5 + .5) * h; l.d.style.display = 'block';
    const bw = l.d.offsetWidth, bh = l.d.offsetHeight; const r = [x - bw / 2, y - bh, x + bw / 2, y];
    let hit = false; for (const q of placed) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) { hit = true; break; }
    if (hit) { l.d.style.display = 'none'; continue; }
    placed.push(r); l.d.style.transform = `translate(${(x - bw / 2).toFixed(1)}px,${(y - bh).toFixed(1)}px)`;
  }
}
// ===== 場景擴充：鏡頭、操作、部隊、點位 =====
const SCN = {};
// ---------- 鏡頭 ----------
let mode = 'orbit';
const orb = { target: new THREE.Vector3(0, 0, -8), r: 150, th: 0.0, ph: 0.82, minR: 18, maxR: 260 };
const look = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 50 };
let tween = null, dirty = true;
function orbPos(o, out) { return out.set(o.target.x + o.r * Math.sin(o.ph) * Math.sin(o.th), o.target.y + o.r * Math.cos(o.ph), o.target.z + o.r * Math.sin(o.ph) * Math.cos(o.th)); }
function lookDir(l, out) { return out.set(Math.sin(l.yaw) * Math.cos(l.pitch), Math.sin(l.pitch), Math.cos(l.yaw) * Math.cos(l.pitch)); }
function applyCam() {
  if (mode === 'orbit') { orbPos(orb, camera.position); camera.lookAt(orb.target); camera.fov = 42; }
  else { camera.position.copy(look.pos); const d = lookDir(look, new THREE.Vector3()); camera.lookAt(look.pos.clone().add(d)); camera.fov = look.fov; }
  camera.updateProjectionMatrix(); dirty = true;
}
function camState() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return { pos: camera.position.clone(), at: camera.position.clone().add(d.multiplyScalar(30)), fov: camera.fov }; }
SCN.flyOrbit = function (o, instant) {
  const from = camState(); Object.assign(orb, o || {}); if (o && o.target) orb.target = o.target.clone();
  const to = { pos: orbPos(orb, new THREE.Vector3()), at: orb.target.clone(), fov: 42 };
  if (instant) { mode = 'orbit'; applyCam(); return; }
  tween = { from, to, t0: performance.now(), dur: 1100, end: 'orbit' }; dirty = true;
};
SCN.flyLook = function (pos, at, fov, instant) {
  const from = camState(); const d = at.clone().sub(pos); look.pos.copy(pos); look.yaw = Math.atan2(d.x, d.z); look.pitch = Math.asin(d.y / d.length()); look.fov = fov || 50;
  const to = { pos: pos.clone(), at: pos.clone().add(lookDir(look, new THREE.Vector3()).multiplyScalar(30)), fov: look.fov };
  if (instant) { mode = 'look'; applyCam(); return; }
  tween = { from, to, t0: performance.now(), dur: 1200, end: 'look' }; dirty = true;
};
function stepTween(now) {
  if (!tween) return; let t = Math.min(1, (now - tween.t0) / tween.dur); const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const { from, to } = tween; const lift = Math.sin(Math.PI * e) * 14 * (from.pos.distanceTo(to.pos) > 30 ? 1 : 0);
  camera.position.lerpVectors(from.pos, to.pos, e); camera.position.y += lift; camera.lookAt(new THREE.Vector3().lerpVectors(from.at, to.at, e)); camera.fov = from.fov + (to.fov - from.fov) * e; camera.updateProjectionMatrix();
  if (t >= 1) { mode = tween.end; tween = null; applyCam(); }
  dirty = true;
}
SCN.mode = () => mode;

// ---------- 操作 ----------
const ptrs = new Map(); let lastPinch = 0, lastMid = null, btn = 0, downAt = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); btn = e.button; downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; lastPinch = Math.hypot(a.x - b.x, a.y - b.y); lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; downAt = null; } });
canvas.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); lastMid = null; if (downAt && downAt.moved < 6 && performance.now() - downAt.t < 600 && btn === 0) pick(e.clientX, e.clientY); downAt = null; });
canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); lastMid = null; downAt = null; });
function pan(dx, dy) { const s = orb.r * .0018; const fx = -Math.sin(orb.th), fz = -Math.cos(orb.th); const rx = Math.cos(orb.th), rz = -Math.sin(orb.th); orb.target.x += (-dx * rx + dy * fx) * s; orb.target.z += (-dx * rz + dy * fz) * s; orb.target.x = Math.max(-95, Math.min(95, orb.target.x)); orb.target.z = Math.max(-75, Math.min(75, orb.target.z)); }
function zoom(f) { if (mode === 'orbit') orb.r = Math.max(orb.minR, Math.min(orb.maxR, orb.r * f)); else look.fov = Math.max(8, Math.min(64, look.fov * f)); }
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId) || tween) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; if (lastPinch) zoom(lastPinch / d); if (lastMid && mode === 'orbit') pan(mid.x - lastMid.x, mid.y - lastMid.y); lastPinch = d; lastMid = mid; applyCam(); return; }
  if (mode === 'orbit') { if (btn === 2 || e.shiftKey) pan(dx, dy); else { orb.th -= dx * .005; orb.ph = Math.max(.12, Math.min(1.42, orb.ph - dy * .004)); } }
  else { const k = look.fov / 60; look.yaw += dx * .004 * k; look.pitch = Math.max(-.7, Math.min(.5, look.pitch + dy * .004 * k)); }
  applyCam();
});
canvas.addEventListener('wheel', e => { e.preventDefault(); if (tween) return; zoom(Math.exp(e.deltaY * .0012)); applyCam(); }, { passive: false });

// ---------- 點位標記（可點擊） ----------
const NODE_MARK = {}; const hitList = [];
function nodeY(n) { const nd = RULES.NODES[n]; return nd.water ? WATER_Y + .12 : (nd.city ? CITY.h + .15 : H(nd.x, nd.z) + .15); }
for (const k in RULES.NODES) {
  const nd = RULES.NODES[k]; if (nd.city) continue;
  const g = new THREE.RingGeometry(3.4, 4.2, 48); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(nd.x, nodeY(k), nd.z); m.renderOrder = 6; scene.add(m);
  const hg = new THREE.CircleGeometry(5.5, 24); hg.rotateX(-Math.PI / 2);
  const hit = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.copy(m.position); hit.userData.node = k; scene.add(hit); hitList.push(hit);
  const lab = mkLabel(nd.name, 'node', 5, new THREE.Vector3(nd.x, nodeY(k) + 2.2, nd.z)); lab.show = false;
  NODE_MARK[k] = { ring: m, lab };
}
{ // 城邑點位：放在城門外
  const k = 'CT'; const g = new THREE.RingGeometry(3.4, 4.2, 48); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(31, H(31, -54.5) + .2, -54.5); m.renderOrder = 6; scene.add(m);
  const hg = new THREE.CircleGeometry(7, 24); hg.rotateX(-Math.PI / 2); const hit = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.copy(m.position); hit.userData.node = k; scene.add(hit); hitList.push(hit);
  NODE_MARK[k] = { ring: m, lab: { show: false } };
}
const MARK_COL = { move: '#3fd27a', attack: '#ff3b30', here: '#ffd23f', scout: '#c78bff', idle: '#ffffff' };
SCN.setMarkers = function (map, showIdle) {
  for (const k in NODE_MARK) {
    const M = NODE_MARK[k], st = map[k];
    if (st) { M.ring.material.color.set(MARK_COL[st]); M.ring.material.opacity = .95; M.lab.show = true; M.lab.d && (M.lab.d.className = 'lab node ' + st); M.ring.scale.setScalar(st === 'here' ? .8 : 1); }
    else if (showIdle) { M.ring.material.color.set('#ffffff'); M.ring.material.opacity = .35; M.lab.show = true; M.lab.d && (M.lab.d.className = 'lab node'); M.ring.scale.setScalar(.7); }
    else { M.ring.material.opacity = 0; M.lab.show = false; }
  }
  dirty = true;
};
const ray = new THREE.Raycaster(); const mv = new THREE.Vector2();
function pick(x, y) {
  const r = canvas.getBoundingClientRect(); mv.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, camera);
  const hits = ray.intersectObjects(hitList, false); if (hits.length && SCN.onNodeClick) SCN.onNodeClick(hits[0].object.userData.node);
}

// ---------- 部隊 ----------
const UG = {}; // key -> {group, meshes, data, cur:[x,z], anim}
const GEO = (() => {
  const body = new THREE.CylinderGeometry(.13, .19, .62, 6); body.translate(0, .31, 0);
  const torso = new THREE.BoxGeometry(.3, .26, .2); torso.translate(0, .62, 0);
  const head = new THREE.SphereGeometry(.1, 6, 5); head.translate(0, .84, 0);
  const helm = new THREE.SphereGeometry(.115, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); helm.translate(0, .86, 0);
  const tas = new THREE.ConeGeometry(.05, .14, 4); tas.translate(0, 1.02, 0);
  const spear = new THREE.CylinderGeometry(.018, .018, 1.75, 4); spear.translate(.2, .9, .02);
  const hbody = new THREE.BoxGeometry(.32, .34, .95); hbody.translate(0, .62, 0);
  const hneck = new THREE.BoxGeometry(.18, .42, .22); hneck.rotateX(-.5); hneck.translate(0, .9, .5);
  const hhead = new THREE.BoxGeometry(.16, .16, .34); hhead.translate(0, 1.08, .66);
  const hlegs = new THREE.BoxGeometry(.28, .46, .78); hlegs.translate(0, .23, 0);
  const rider = new THREE.CylinderGeometry(.11, .15, .5, 6); rider.translate(0, 1.0, -.05);
  const rhead = new THREE.SphereGeometry(.09, 6, 5); rhead.translate(0, 1.34, -.05);
  const rhelm = new THREE.SphereGeometry(.105, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); rhelm.translate(0, 1.36, -.05);
  const rtas = new THREE.ConeGeometry(.045, .13, 4); rtas.translate(0, 1.5, -.05);
  const lance = new THREE.CylinderGeometry(.016, .016, 2.1, 4); lance.rotateX(-.35); lance.translate(.2, 1.2, .25);
  // 戰車：兩匹馬、車廂、兩輪、車上三人（御者居中、左持弓、右持戈）
  const mk = (g, x, y, z) => { const q = g.clone(); q.translate(x, y, z); return q; };
  const merge = arr => { const pos = [], idx = []; let off = 0; for (const gg of arr) { const g2 = gg.index ? gg : gg; const p = g2.attributes.position.array; for (const v of p) pos.push(v); if (g2.index) for (const i of g2.index.array) idx.push(i + off); else for (let i = 0; i < p.length / 3; i++) idx.push(i + off); off += p.length / 3; } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx); m.computeVertexNormals(); return m; };
  const hB = new THREE.BoxGeometry(.3, .32, .9), hN = new THREE.BoxGeometry(.16, .4, .2), hH = new THREE.BoxGeometry(.15, .15, .32), hL = new THREE.BoxGeometry(.26, .44, .74);
  hN.rotateX(-.5);
  const horses = merge([mk(hB, -.2, .6, 1.15), mk(hB, .2, .6, 1.15), mk(hN, -.2, .88, 1.6), mk(hN, .2, .88, 1.6), mk(hH, -.2, 1.05, 1.76), mk(hH, .2, 1.05, 1.76)]);
  const hlegs2 = merge([mk(hL, -.2, .22, 1.15), mk(hL, .2, .22, 1.15)]);
  const box = new THREE.BoxGeometry(1.1, .3, .75), pole2 = new THREE.BoxGeometry(.06, .06, 1.5), axle = new THREE.CylinderGeometry(.03, .03, 1.5, 4); axle.rotateZ(Math.PI / 2);
  const cart = merge([mk(box, 0, .62, -.1), mk(pole2, 0, .55, .7), mk(axle, 0, .45, -.1)]);
  const wh = new THREE.TorusGeometry(.42, .05, 4, 12); wh.rotateY(Math.PI / 2);
  const wheels = merge([mk(wh, -.68, .45, -.1), mk(wh, .68, .45, -.1)]);
  const crewB = new THREE.CylinderGeometry(.1, .13, .5, 6), crewH = new THREE.SphereGeometry(.085, 6, 5), crewM = new THREE.SphereGeometry(.1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const crew = merge([mk(crewB, -.32, 1.02, -.15), mk(crewB, 0, 1.02, -.05), mk(crewB, .32, 1.02, -.15)]);
  const heads = merge([mk(crewH, -.32, 1.35, -.15), mk(crewH, 0, 1.35, -.05), mk(crewH, .32, 1.35, -.15)]);
  const helms = merge([mk(crewM, -.32, 1.37, -.15), mk(crewM, 0, 1.37, -.05), mk(crewM, .32, 1.37, -.15)]);
  const ge = new THREE.CylinderGeometry(.016, .016, 2.6, 4); ge.rotateX(-.25); const geHead = new THREE.BoxGeometry(.04, .05, .28);
  const weapons = merge([mk(ge, .42, 1.6, .05), mk(geHead, .42, 2.85, .4)]);
  const chr = [[horses, 'horse'], [hlegs2, 'horseLeg'], [cart, 'trunk'], [wheels, 'trunk'], [crew, 'side'], [heads, 'skin'], [helms, 'iron'], [weapons, 'trunk']];
  return { inf: [[body, 'side'], [torso, 'iron'], [head, 'skin'], [helm, 'iron'], [tas, 'red'], [spear, 'trunk']], cav: [[hbody, 'horse'], [hneck, 'horse'], [hhead, 'horse'], [hlegs, 'horseLeg'], [rider, 'side'], [rhead, 'skin'], [rhelm, 'iron'], [rtas, 'red'], [lance, 'trunk']], chr };
})();

// ===== 陣法遊戲的步卒與戰車（移植自《陣法立體版》：圓盔紅纓、札甲、肩甲、紅纓長槍、盾；戰車雙馬三人） =====
(function () {
  function mc(list) {
    const pos = [], nor = [], col = [];
    for (const [g, hex] of list) { const ng = g.index ? g.toNonIndexed() : g; const p = ng.attributes.position.array, n = ng.attributes.normal.array, c = new THREE.Color(hex);
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const bx = (w, h, d, px, py, pz, rx, ry, rz) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(px, py, pz); return g; };
  const TEAM = {
    red:  { torso: 0x7f3426, arms: 0x6e2a20, legs: 0x2c2420, helm: 0x3a2a24, brim: 0x8e1a10, crest: 0xd23a2b, pauld: 0x5a2a22, chest: 0x9a3a2c, belt: 0x2a1a10, shield: 0x7a2e22, body: 0x8e1a10 },
    blue: { torso: 0x1d3560, arms: 0x2a4a80, legs: 0x2c2420, helm: 0x2a4a80, brim: 0xd6c8a0, crest: 0xe8c870, pauld: 0x3f6bb0, chest: 0xd6c8a0, belt: 0x2a1a10, shield: 0x2a3f6a, body: 0x1d3560 },
  };
  const SKIN = 0xe0b48a, GOLD = 0xcfa64c;
  // 一名步卒（立正持槍、左手持盾），面向 +z；回傳 [幾何, 顏色] 清單
  function soldier(T, k, ox, oy, oz) {
    const L = [];
    const put = (g, hex, x, y, z) => { g.translate(x, y, z); g.scale(k, k, k); g.translate(ox, oy, oz); L.push([g, hex]); };
    const leg = () => { const g = new THREE.BoxGeometry(.22, .74, .26); g.translate(0, -.37, 0); return g; };
    const arm = () => { const g = new THREE.BoxGeometry(.17, .54, .19); g.translate(0, -.27, 0); return g; };
    put(leg(), T.legs, -.13, .74, 0); put(leg(), T.legs, .13, .74, 0);
    put(new THREE.BoxGeometry(.56, .62, .34), T.torso, 0, 1.05, 0);
    put(new THREE.BoxGeometry(.6, .42, .4), T.chest, 0, 1.14, 0);
    put(new THREE.BoxGeometry(.6, .1, .38), T.belt, 0, .78, 0);
    put(new THREE.BoxGeometry(.38, .38, .38), SKIN, 0, 1.55, 0);
    put(new THREE.BoxGeometry(.42, .32, .42), T.helm, 0, 1.82, 0);
    put(new THREE.BoxGeometry(.40, .2, .1).translate(0, -.22, -.19), T.helm, 0, 1.82, 0);
    put(new THREE.BoxGeometry(.08, .22, .3).translate(-.21, -.2, -.02), T.helm, 0, 1.82, 0);
    put(new THREE.BoxGeometry(.08, .22, .3).translate(.21, -.2, -.02), T.helm, 0, 1.82, 0);
    put(new THREE.BoxGeometry(.5, .06, .5), T.brim, 0, 1.69, 0);
    put(new THREE.BoxGeometry(.12, .4, .12), T.crest, 0, 2.16, 0);
    put(new THREE.BoxGeometry(.22, .14, .38), T.pauld, -.37, 1.38, 0); put(new THREE.BoxGeometry(.22, .14, .38), T.pauld, .37, 1.38, 0);
    put(arm(), T.arms, -.37, 1.32, 0); put(arm(), T.arms, .37, 1.32, 0);
    // 紅纓長槍（直立握在右手）
    put(new THREE.BoxGeometry(.06, 2.2, .06).translate(0, .5, 0), 0x4a3020, .44, .74, .1);
    put(new THREE.BoxGeometry(.1, .32, .05).translate(0, 1.72, 0), 0xdfe3e6, .44, .74, .1);
    put(new THREE.BoxGeometry(.14, .12, .14).translate(0, 1.52, 0), 0xc8281c, .44, .74, .1);
    // 盾（左手，略前傾）
    const sh = (g) => { g.scale(1, 1, 1.6); g.rotateX(-.45); return g; };
    put(sh(new THREE.BoxGeometry(.95, 1.35, .06)), T.shield, -.3, 1.12, .5);
    put(sh(new THREE.BoxGeometry(.95, .07, .09).translate(0, .64, .01)), GOLD, -.3, 1.12, .5);
    put(sh(new THREE.BoxGeometry(.95, .07, .09).translate(0, -.64, .01)), GOLD, -.3, 1.12, .5);
    put(sh(new THREE.CylinderGeometry(.2, .17, .1, 14).rotateX(Math.PI / 2).translate(0, 0, .07)), 0xd9b65c, -.3, 1.12, .5);
    return L;
  }
  // 一乘戰車：車廂、雙輪（輻條）、兩匹馬、車上三人（御者居中、左右甲士），面向 +z
  function chariot(T, k) {
    const L = [];
    const put = (g, hex) => { g.scale(k, k, k); L.push([g, hex]); };
    [[bx(1.7, .12, 1.25, 0, .95, 0), 0x5a3a22], [bx(1.7, .55, .08, 0, 1.28, .6), T.body], [bx(.08, .55, 1.25, -.85, 1.28, 0), T.body], [bx(.08, .55, 1.25, .85, 1.28, 0), T.body],
     [bx(1.7, .07, .1, 0, 1.57, .6), 0xd6a94e], [bx(2.6, .12, .12, 0, .85, 0), 0x3a2618], [bx(.12, .12, 3.4, 0, .95, 2.2), 0x4a3020], [bx(2.2, .1, .12, 0, 1.35, 3.7), 0x4a3020],
     [bx(.7, .08, .14, -.45, 1.62, 3.75), 0xb8281c], [bx(.7, .08, .14, .45, 1.62, 3.75), 0xb8281c]].forEach(([g, c]) => put(g, c));
    for (const sx of [-1.2, 1.2]) {
      put(new THREE.CylinderGeometry(.85, .85, .12, 18).rotateZ(Math.PI / 2).translate(sx, .85, 0), 0x4a3020);
      put(new THREE.TorusGeometry(.78, .06, 6, 20).rotateY(Math.PI / 2).translate(sx + sx * .03, .85, 0), 0x2a1a10);
      for (let i = 0; i < 6; i++) put(bx(.06, 1.5, .05, 0, 0, 0, i / 6 * Math.PI).translate(sx + sx * .04, .85, 0), 0x6a4a30);
    }
    const hc = 0x6b4a32;
    for (const hx of [-.45, .45]) {
      [[bx(.62, .7, 1.7, 0, 1.25, 0), hc], [bx(.34, .8, .38, 0, 1.8, .85, .5), hc], [bx(.3, .32, .62, 0, 2.15, 1.2), hc], [bx(.12, .4, .3, 0, 2.0, .7), 0x2a1d14], [bx(.12, .7, .12, 0, 1.2, -.9, -.5), 0x2a1d14]]
        .forEach(([g, c]) => put(g.translate(hx, 0, 4.0), c));
      for (const [lx, lz] of [[.2, .7], [-.2, .7], [.2, -.7], [-.2, -.7]]) { put(bx(.16, .95, .18, 0, -.47, 0).translate(hx + lx, .95, 4.0 + lz), hc); put(bx(.18, .12, .2, 0, -.92, 0).translate(hx + lx, .95, 4.0 + lz), 0x1a1410); }
    }
    for (const [cx, cz] of [[-.5, -.2], [0, .15], [.5, -.2]]) for (const p of soldier(T, .85, cx, 1.0 - .74 * .85 + .35, cz)) { p[0].scale(k, k, k); L.push(p); }
    return L;
  }
  const K = 0.5;
  for (const s of ['red', 'blue']) {
    GEO['zinf_' + s] = [[mc(soldier(TEAM[s], K, 0, 0, 0)), 'vc']];
    GEO['zchr_' + s] = [[mc(chariot(TEAM[s], K)), 'vc']];
  }
})();
const _o = new THREE.Object3D();
function soldierCount(type, s) { const m = window.SOLDIERS_PER || { inf: 6, cav: 3, chr: 1 }; if (type === 'chr') return Math.max(1, Math.round(s * (m.chr || 1))); return type === 'cav' ? Math.max(2, Math.round(s * m.cav)) : Math.max(3, Math.round(s * m.inf)); }
function formationOffsets(type, n) {
  const cols = type === 'chr' ? Math.min(3, n) : type === 'cav' ? Math.min(4, n) : Math.min(6, n); const sp = type === 'chr' ? 2.2 : type === 'cav' ? 1.15 : .74, sz = type === 'chr' ? 3.2 : type === 'cav' ? 1.5 : .8; const rows = Math.ceil(n / cols); const out = [];
  for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols; out.push([(c - (cols - 1) / 2) * sp + (hash2(i, n) - .5) * .12, (r - (rows - 1) / 2) * sz + (hash2(n, i) - .5) * .12]); }
  return out;
}
function colorFor(role, side) {
  if (role === 'side') return side === 'red' ? CUR.P.red : CUR.P.blue;
  if (role === 'horse') return CUR.mat === 'holo' ? (side === 'red' ? '#ff6a60' : '#6fb8ff') : '#6b4a32';
  if (role === 'horseLeg') return CUR.mat === 'holo' ? '#aaccff' : '#3b2a1e';
  if (CUR.mat === 'holo') return role === 'skin' ? '#88aaff' : role === 'red' ? STY.D.P.red : '#ffffff';
  return CUR.P[role] || '#888888';
}
function unitMat(role, side, ghost) {
  const o = ghost ? { transparent: true, opacity: .45, depthWrite: false } : {};
  if (role === 'vc') return CUR.mat === 'holo' ? new THREE.MeshBasicMaterial(Object.assign({ color: side === 'red' ? STY.D.P.red : STY.D.P.blue }, o)) : new THREE.MeshLambertMaterial(Object.assign({ color: '#ffffff', vertexColors: true }, o));
  const c = colorFor(role, side);
  if (CUR.mat === 'holo') return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
  return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
}
function buildUnit(d) {
  const g = new THREE.Group(); scene.add(g); const n = d.offs ? d.offs.length : soldierCount(d.type, d.s); const meshes = [];
  for (const [geo, role] of GEO[d.type]) { const m = new THREE.InstancedMesh(geo, unitMat(role, d.side, d.ghost), n); m.castShadow = !d.ghost; m.userData.role = role; m.frustumCulled = false; g.add(m); meshes.push(m); }
  // 旗
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.2, 5), unitMat('trunk', d.side, d.ghost)); pole.userData.role = 'trunk'; g.add(pole);
  const fg = new THREE.PlaneGeometry(1.4, .95, 4, 1); const flag = new THREE.Mesh(fg, unitMat('side', d.side, d.ghost)); flag.material.side = THREE.DoubleSide; flag.userData.role = 'side'; g.add(flag);
  const lab = mkLabel('', 'unit ' + d.side, d.mine ? 9 : 8, new THREE.Vector3()); lab.show = true;
  const xmeshes = [];
  if (d.extra) for (const [geo, role] of GEO[d.extra.type]) { const m = new THREE.InstancedMesh(geo, unitMat(role, d.side, d.ghost), d.extra.offs.length); m.castShadow = !d.ghost; m.userData.role = role; m.frustumCulled = false; g.add(m); xmeshes.push(m); }
  return { g, meshes, pole, flag, n, lab, custom: !!d.offs, offs: d.offs || formationOffsets(d.type, n), xmeshes, xoffs: d.extra ? d.extra.offs : [] };
}
function layoutUnit(U, x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw); const water = U.d.inWater;
  U.meshes.forEach(m => {
    U.offs.forEach((o, i) => { const wx = x + o[0] * c + o[1] * s, wz = z - o[0] * s + o[1] * c; let y = H(wx, wz); if (water) y = Math.max(y, WATER_Y - .55); _o.position.set(wx, y, wz); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(1.15); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
    m.instanceMatrix.needsUpdate = true;
  });
  (U.xmeshes || []).forEach(m => {
    U.xoffs.forEach((o, i) => { const wx = x + o[0] * c + o[1] * s, wz = z - o[0] * s + o[1] * c; let y = H(wx, wz); if (water) y = Math.max(y, WATER_Y - .55); _o.position.set(wx, y, wz); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(1.15); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
    m.instanceMatrix.needsUpdate = true;
  });
  const rows = Math.ceil(U.n / (U.d.type === 'chr' ? 3 : U.d.type === 'cav' ? 4 : 6)); const back = U.custom ? Math.min(...U.offs.map(o => o[1])) - .6 : -(rows / 2) * (U.d.type === 'chr' ? 3.2 : U.d.type === 'cav' ? 1.5 : .8) - .6;
  const fx = x + back * s, fz = z + back * c; const fy = Math.max(H(fx, fz), water ? WATER_Y - .5 : -9);
  U.pole.position.set(fx, fy + 1.6, fz); U.flag.position.set(fx + .7 * Math.cos(yaw + .6), fy + 2.7, fz - .7 * Math.sin(yaw + .6)); U.flag.rotation.y = yaw + .6;
  U.lab.pos.set(x, Math.max(H(x, z), WATER_Y) + 3.6, z);
}
function disposeUnit(U) { scene.remove(U.g); U.g.traverse(o => { if (o.material) o.material.dispose(); }); U.lab.d.remove(); const i = labels.indexOf(U.lab); if (i >= 0) labels.splice(i, 1); }
// list: [{key, side, type, s, pos(rules 位置), path:[位置...]（動畫路徑）, label, labelCls, mine, ghost}]
SCN.setUnits = function (list, animate) {
  const seen = new Set();
  // 同一點位多支部隊錯開
  const byNode = {}; for (const d of list) { if (RULES.isNode(d.pos) && !d.wpos) (byNode[d.pos.n] = byNode[d.pos.n] || []).push(d); }
  for (const n in byNode) { const arr = byNode[n]; arr.forEach((d, i) => { d.slot = i - (arr.length - 1) / 2; d.slots = arr.length; }); }
  for (const d of list) {
    seen.add(d.key); let U = UG[d.key];
    if (U && (U.custom !== !!d.offs || (d.offs && U.n !== d.offs.length) || U.d.s !== d.s || U.d.type !== d.type || U.d.ghost !== d.ghost || U.d.side !== d.side || U.style !== CUR.key)) { var keepCur = U.cur; disposeUnit(U); delete UG[d.key]; U = null; }
    const w = worldPos(d);
    if (!U) { U = UG[d.key] = buildUnit(d); U.d = d; U.style = CUR.key; U.cur = (keepCur || w).slice(); keepCur = null; U.yaw = d.side === 'red' ? Math.PI : 0; }
    if (d.offs) U.offs = d.offs; const prev = U.cur.slice(); U.d = d; U.d.inWater = RULES.isNode(d.pos) && RULES.NODES[d.pos.n].water;
    U.lab.d.textContent = d.label || ''; U.lab.d.className = 'lab unit ' + d.side + (d.labelCls ? ' ' + d.labelCls : ''); U.lab.show = !!d.label;
    const pts = [prev].concat((d.path || []).map(p => worldPos(Object.assign({}, d, { pos: p })))).concat([w]);
    const moved = Math.hypot(w[0] - prev[0], w[1] - prev[1]) > .5;
    if (animate && moved) U.anim = { pts, t0: performance.now(), dur: 1800 + 500 * Math.min(3, pts.length - 2) }; else { U.anim = null; U.cur = w; layoutUnit(U, w[0], w[1], d.yaw != null ? d.yaw : (d.side === 'red' ? Math.PI : 0)); U.yaw = d.side === 'red' ? Math.PI : 0; }
  }
  for (const k in UG) if (!seen.has(k)) { disposeUnit(UG[k]); delete UG[k]; }
  dirty = true;
};
function worldPos(d) {
  if (d.wpos) return d.wpos.slice(); // 指定的世界座標（接戰位置）
  const w = RULES.worldOf(d.pos);
  if (d.slots > 1 && RULES.isNode(d.pos)) { const sp = d.type === 'cav' ? 7 : 6.5; return [w[0] + d.slot * sp, w[1] + (d.side === 'red' ? 1 : -1) * Math.abs(d.slot) * 1.2]; }
  return w;
}
function polyLerp(pts, f) { let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; } if (L < 1e-6) return [pts[pts.length - 1], 0]; let t = f * L; for (let i = 0; i < seg.length; i++) { if (t <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, t / seg[i]) : 1; const a = pts[i], b = pts[i + 1]; return [[a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], Math.atan2(b[0] - a[0], b[1] - a[1])]; } t -= seg[i]; } return [pts[pts.length - 1], 0]; }
SCN.animating = () => Object.values(UG).some(U => U.anim);
function stepUnits(now) {
  let any = false;
  for (const k in UG) { const U = UG[k]; if (!U.anim) continue; any = true;
    const t = Math.min(1, (now - U.anim.t0) / U.anim.dur); const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const [p, yaw] = polyLerp(U.anim.pts, e); layoutUnit(U, p[0], p[1], yaw); U.cur = p;
    if (t >= 1) { U.anim = null; layoutUnit(U, p[0], p[1], U.d.yaw != null ? U.d.yaw : (U.d.side === 'red' ? Math.PI : 0)); } }
  if (any) dirty = true;
}
window.UNITS_RESTYLE = function () { for (const k in UG) { const U = UG[k]; U.g.traverse(o => { if (o.material && o.userData.role) { const ds = o.material.side; o.material.dispose(); o.material = unitMat(o.userData.role, U.d.side, U.d.ghost); o.material.side = ds; } }); U.style = CUR.key; } dirty = true; };

// ---------- 交戰火花 ----------
const fx = [];
SCN.battleFx = function (node, text) {
  const nd = RULES.NODES[node]; const d = document.createElement('div'); d.className = 'burst'; d.textContent = text; labLayer.appendChild(d);
  fx.push({ d, pos: new THREE.Vector3(nd.x, nodeY(node) + 4, nd.z), t0: performance.now() }); dirty = true;
};
function stepFx(now) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; const t = (now - f.t0) / 2600; if (t >= 1) { f.d.remove(); fx.splice(i, 1); continue; }
    _v.copy(f.pos).project(camera); const w = canvas.clientWidth, h = canvas.clientHeight; f.d.style.transform = `translate(${(_v.x * .5 + .5) * w}px,${(-_v.y * .5 + .5) * h - t * 40}px) translate(-50%,-50%) scale(${1 + Math.sin(t * Math.PI) * .25})`; f.d.style.opacity = String(1 - t * t); f.d.style.display = _v.z < 1 ? 'block' : 'none'; }
  if (fx.length) dirty = true;
}

// ---------- 迴圈 ----------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const W = Math.floor(w * PR), Hh = Math.floor(h * PR); makeRT(W, Hh); for (const k in postMats) postMats[k].uniforms.res.value.set(W, Hh); dirty = true;
}
window.addEventListener('resize', resize);
SCN.hidden = false;
function frame(now) {
  requestAnimationFrame(frame); stepTween(now); stepUnits(now); stepFx(now);
  if (!dirty || SCN.hidden) return; dirty = false;
  const pm = postQuad.material; pm.uniforms.res.value.set(rt.width, rt.height); pm.uniforms.cn.value = camera.near; pm.uniforms.cf.value = camera.far;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  pm.uniforms.tColor.value = rt.texture; pm.uniforms.tDepth.value = rt.depthTexture; pm.uniforms.time.value = (now % 1000) / 1000;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  layoutLabels();
}
SCN.applyStyle = applyStyle; SCN.dirty = () => { dirty = true; };
SCN.start = function () { applyStyle('B'); resize(); applyCam(); requestAnimationFrame(frame); };
SCN.finish = () => { if (tween) { tween.t0 = -1e9; stepTween(performance.now()); } for (const k in UG) if (UG[k].anim) UG[k].anim.t0 = -1e9; stepUnits(performance.now()); dirty = true; };
SCN.setPlaces = on => { for (const L of labels) if (L.cls && (L.cls === 'place' || L.cls === 'water' || L.cls === 'ford' || L.cls.startsWith('place'))) L.show = on; dirty = true; };
SCN.cityEye = () => new THREE.Vector3(OBS.city.x, CITY.h + WALL_H + OBS.city.eye, OBS.city.z);
SCN.H = H;

SCN.scene = scene; SCN.canvas = canvas; SCN.orb = orb; SCN.mkLabel = mkLabel; SCN.labels = labels; SCN.resize = resize; SCN.applyCam = applyCam;
window.SCN = SCN; window.STY = STY; window.camera = camera;
}
