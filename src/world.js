import * as THREE from 'three';

export const W = 192, H = 48, D = 192, SEA = 11;
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAVES = 5,
             PLANK = 6, WATER = 7, SNOW = 8, THATCH = 9, COBBLE = 10,
             EMBER = 11, BANNER = 12, TORCH = 13;

const BREAKABLE = new Set([GRASS, DIRT, LOG, LEAVES, PLANK, THATCH, TORCH]);

const COLORS = {
  [GRASS]:  { top: [0.40, 0.62, 0.24], side: [0.44, 0.35, 0.22], bottom: [0.40, 0.31, 0.20] },
  [DIRT]:   { top: [0.48, 0.36, 0.23], side: [0.45, 0.33, 0.21], bottom: [0.40, 0.30, 0.19] },
  [STONE]:  { top: [0.55, 0.55, 0.57], side: [0.51, 0.51, 0.53], bottom: [0.44, 0.44, 0.46] },
  [LOG]:    { top: [0.50, 0.38, 0.20], side: [0.39, 0.28, 0.15], bottom: [0.39, 0.29, 0.16] },
  [LEAVES]: { top: [0.24, 0.46, 0.17], side: [0.22, 0.42, 0.16], bottom: [0.19, 0.38, 0.14] },
  [PLANK]:  { top: [0.63, 0.48, 0.29], side: [0.60, 0.45, 0.27], bottom: [0.50, 0.38, 0.23] },
  [WATER]:  { top: [0.22, 0.40, 0.70], side: [0.22, 0.40, 0.70], bottom: [0.22, 0.40, 0.70] },
  [SNOW]:   { top: [0.91, 0.93, 0.96], side: [0.83, 0.86, 0.90], bottom: [0.68, 0.70, 0.74] },
  [THATCH]: { top: [0.71, 0.54, 0.24], side: [0.65, 0.49, 0.22], bottom: [0.54, 0.41, 0.19] },
  [COBBLE]: { top: [0.44, 0.44, 0.46], side: [0.41, 0.41, 0.43], bottom: [0.36, 0.36, 0.38] },
  [EMBER]:  { top: [0.95, 0.45, 0.15], side: [0.83, 0.34, 0.12], bottom: [0.50, 0.20, 0.08] },
  [BANNER]: { top: [0.66, 0.13, 0.13], side: [0.63, 0.12, 0.12], bottom: [0.50, 0.10, 0.10] },
  [TORCH]:  { top: [1.0, 0.88, 0.45], side: [1.0, 0.72, 0.28], bottom: [0.7, 0.45, 0.15] },
};

// Face table (from the classic voxel-geometry pattern): dir, 4 corners, indices [0,1,2, 2,1,3]
const FACES = [
  { dir: [-1, 0, 0], shade: 0.72, corners: [[0,1,0],[0,0,0],[0,1,1],[0,0,1]] },
  { dir: [ 1, 0, 0], shade: 0.72, corners: [[1,1,1],[1,0,1],[1,1,0],[1,0,0]] },
  { dir: [ 0,-1, 0], shade: 0.50, corners: [[1,0,1],[0,0,1],[1,0,0],[0,0,0]] },
  { dir: [ 0, 1, 0], shade: 1.00, corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]] },
  { dir: [ 0, 0,-1], shade: 0.84, corners: [[1,0,0],[0,0,0],[1,1,0],[0,1,0]] },
  { dir: [ 0, 0, 1], shade: 0.84, corners: [[0,0,1],[1,0,1],[0,1,1],[1,1,1]] },
];

function hash2(x, z) {
  let n = (x * 374761393 + z * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function hash3(x, y, z) {
  return hash2(x * 3 + y * 7919, z * 5 + y * 104729);
}
function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  return smoothNoise(x * 0.03, z * 0.03) * 0.6 +
         smoothNoise(x * 0.08, z * 0.08) * 0.3 +
         smoothNoise(x * 0.20, z * 0.20) * 0.1;
}

const CHUNK = 16;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.data = new Uint8Array(W * H * D);
    this.chunks = new Map();
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
    this.torchMat = new THREE.MeshBasicMaterial({ vertexColors: true }); // unlit → glows at night
    this.torches = []; // player-placed torch positions (undead won't spawn near them)
    // structure footprints (with margin) that trees must avoid
    this.sites = [
      { x0: 39, z0: 87, x1: 65, z1: 113 },   // holdfast
      { x0: 124, z0: 80, x1: 156, z1: 112 }, // village
      { x0: 136, z0: 142, x1: 164, z1: 170 }, // bandit camp
      { x0: 148, z0: 8, x1: 192, z1: 54 }    // Kingsport, the capital
    ];
  }

  idx(x, y, z) { return (y * D + z) * W + x; }
  inBounds(x, y, z) { return x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D; }
  get(x, y, z) { return this.inBounds(x, y, z) ? this.data[this.idx(x, y, z)] : AIR; }
  set(x, y, z, b) { if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = b; }
  isSolid(x, y, z) { const b = this.get(x, y, z); return b !== AIR && b !== WATER; }
  isBreakable(b) { return BREAKABLE.has(b); }

  // y-coordinate a creature's feet rest at on the column (x,z)
  surfaceHeight(x, z) {
    for (let y = H - 1; y >= 0; y--) {
      if (this.isSolid(x, y, z)) return y + 1;
    }
    return SEA + 1;
  }

  generate() {
    // --- terrain ---
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const h = Math.floor(7 + fbm(x, z) * 17);
        for (let y = 0; y <= h; y++) {
          let b;
          if (y === h) b = h >= 22 ? SNOW : GRASS;
          else if (y >= h - 3) b = DIRT;
          else b = STONE;
          this.set(x, y, z, b);
        }
        for (let y = h + 1; y <= SEA; y++) this.set(x, y, z, WATER);
      }
    }
    // --- structures (each flattens its own site) ---
    const gH = this.flatten(43, 91, 61, 109);
    this.buildHoldfast(43, gH, 91, 61, 109);
    const gV = this.flatten(128, 84, 152, 108);
    this.buildVillage(gV);
    const gC = this.flatten(140, 146, 160, 166);
    this.buildCamp(140, gC, 146, 160, 166);
    const gK = this.flatten(152, 12, 188, 48);
    this.buildCapital(152, gK, 12, 188, 48);
    this.grounds = { holdfast: gH, village: gV, camp: gC, capital: gK };
    // --- trees: dense northern forest + scattered elsewhere ---
    this.plantTrees(220, 10, 10, 182, 68);   // northern woods
    this.plantTrees(90, 10, 68, 182, 182);   // scattered south
  }

  flatten(x0, z0, x1, z1) {
    const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
    let h = 0;
    for (let y = H - 1; y >= 0; y--) { if (this.get(cx, y, cz) !== AIR && this.get(cx, y, cz) !== WATER) { h = y; break; } }
    const g = Math.max(SEA + 2, h);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        for (let y = 0; y < H; y++) {
          if (y > g) { this.set(x, y, z, AIR); }
          else if (y === g) this.set(x, y, z, GRASS);
          else if (y >= g - 3) this.set(x, y, z, DIRT);
          else this.set(x, y, z, STONE);
        }
      }
    }
    return g;
  }

  fill(x0, y0, z0, x1, y1, z1, b) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.set(x, y, z, b);
  }

  buildHoldfast(x0, g, z0, x1, z1) {
    // courtyard
    this.fill(x0 + 1, g, z0 + 1, x1 - 1, g, z1 - 1, COBBLE);
    // curtain walls
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) {
        this.fill(x, g + 1, z, x, g + 4, z, STONE);
        if ((x + z) % 2 === 0) this.set(x, g + 5, z, STONE);
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) {
        this.fill(x, g + 1, z, x, g + 4, z, STONE);
        if ((x + z) % 2 === 0) this.set(x, g + 5, z, STONE);
      }
    }
    // south gate (3 wide), flanked by house banners
    this.fill(51, g + 1, z1, 53, g + 3, z1, AIR);
    this.set(49, g + 4, z1, BANNER);
    this.set(55, g + 4, z1, BANNER);
    // NW tower
    for (let y = g + 1; y <= g + 8; y++) {
      for (let x = x0; x <= x0 + 4; x++)
        for (let z = z0; z <= z0 + 4; z++) {
          const edge = x === x0 || x === x0 + 4 || z === z0 || z === z0 + 4;
          if (edge || y === g + 8) this.set(x, y, z, STONE);
        }
    }
    for (let x = x0; x <= x0 + 4; x += 2)
      for (let z = z0; z <= z0 + 4; z += 2) this.set(x, g + 9, z, STONE);
    this.tower = { x: x0 + 2, z: z0 + 2, top: g + 9 };
    // small keep hall (north side of courtyard)
    const hx0 = 48, hx1 = 57, hz0 = 93, hz1 = 98;
    this.fill(hx0, g, hz0, hx1, g, hz1, PLANK);
    for (let x = hx0; x <= hx1; x++) for (const z of [hz0, hz1]) this.fill(x, g + 1, z, x, g + 3, z, STONE);
    for (let z = hz0; z <= hz1; z++) for (const x of [hx0, hx1]) this.fill(x, g + 1, z, x, g + 3, z, STONE);
    this.fill(52, g + 1, hz1, 53, g + 2, hz1, AIR); // hall door
    this.fill(hx0, g + 4, hz0, hx1, g + 4, hz1, THATCH);
    this.fill(hx0 + 1, g + 5, hz0 + 1, hx1 - 1, g + 5, hz1 - 1, THATCH);
    // forge fire in SE corner of courtyard
    this.set(59, g, 106, EMBER);
    this.set(60, g, 106, EMBER);
  }

  buildVillage(g) {
    const huts = [[134, 90], [146, 90], [134, 102], [146, 102]];
    for (const [cx, cz] of huts) this.buildHut(cx, g, cz);
    // village well
    this.fill(139, g + 1, 95, 141, g + 1, 97, COBBLE);
    this.set(140, g + 1, 96, WATER);
  }

  buildHut(cx, g, cz) {
    const x0 = cx - 2, x1 = cx + 2, z0 = cz - 2, z1 = cz + 2;
    this.fill(x0, g, z0, x1, g, z1, PLANK);
    for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) this.fill(x, g + 1, z, x, g + 2, z, PLANK);
    for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) this.fill(x, g + 1, z, x, g + 2, z, PLANK);
    this.fill(cx, g + 1, z1, cx, g + 2, z1, AIR); // south doorway
    this.fill(x0, g + 3, z0, x1, g + 3, z1, THATCH);
    this.fill(x0 + 1, g + 4, z0 + 1, x1 - 1, g + 4, z1 - 1, THATCH);
    this.set(cx, g + 5, cz, THATCH);
  }

  buildCamp(x0, g, z0, x1, z1) {
    // log palisade with a west entrance
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) this.fill(x, g + 1, z, x, g + 2, z, LOG);
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) this.fill(x, g + 1, z, x, g + 2, z, LOG);
    }
    this.fill(x0, g + 1, 154, x0, g + 2, 158, AIR); // west gap
    // campfire
    this.fill(149, g, 155, 151, g, 157, EMBER);
    // crude lean-tos
    this.fill(143, g + 1, 149, 145, g + 1, 149, PLANK);
    this.fill(143, g + 2, 150, 145, g + 2, 150, PLANK);
    this.fill(155, g + 1, 162, 157, g + 1, 162, PLANK);
    this.fill(155, g + 2, 161, 157, g + 2, 161, PLANK);
  }

  buildCapital(x0, g, z0, x1, z1) {
    // city walls
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) {
        this.fill(x, g + 1, z, x, g + 5, z, STONE);
        if ((x + z) % 2 === 0) this.set(x, g + 6, z, STONE);
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) {
        this.fill(x, g + 1, z, x, g + 5, z, STONE);
        if ((x + z) % 2 === 0) this.set(x, g + 6, z, STONE);
      }
    }
    // south gate: opening barred with ironwood planks until burned
    this.fill(168, g + 1, z1, 172, g + 5, z1, AIR);
    this.fill(168, g + 1, z1, 172, g + 4, z1, PLANK);
    this.cityGate = { x0: 168, x1: 172, z: z1, y0: g + 1, y1: g + 4 };
    this.set(166, g + 4, z1, BANNER);
    this.set(174, g + 4, z1, BANNER);
    // main street + plaza
    this.fill(168, g, 29, 172, g, z1 - 1, COBBLE);
    this.fill(160, g, 28, 180, g, 38, COBBLE);
    this.fill(170, g, 27, 172, g, 28, COBBLE);
    // torch pedestals on the plaza
    for (const [tx, tz] of [[162, 28], [178, 28], [162, 38], [178, 38]]) {
      this.set(tx, g + 1, tz, COBBLE);
      this.set(tx, g + 2, tz, EMBER);
    }
    // houses along the side streets
    for (const [hx, hz] of [[159, 43], [181, 43], [157, 32], [183, 32], [163, 44], [177, 44]]) {
      this.buildHut(hx, g, hz);
    }
    // throne hall — open to the sky, as the old kings liked it
    const hx0 = 164, hx1 = 180, hz0 = 14, hz1 = 26;
    this.fill(hx0, g, hz0, hx1, g, hz1, COBBLE);
    for (let x = hx0; x <= hx1; x++) for (const z of [hz0, hz1]) this.fill(x, g + 1, z, x, g + 5, z, STONE);
    for (let z = hz0; z <= hz1; z++) for (const x of [hx0, hx1]) this.fill(x, g + 1, z, x, g + 5, z, STONE);
    this.fill(170, g + 1, hz1, 172, g + 3, hz1, AIR);          // hall doors
    this.set(167, g + 4, hz1, BANNER);
    this.set(175, g + 4, hz1, BANNER);
    // the Iron Throne on its dais
    this.fill(170, g + 1, 15, 174, g + 1, 18, COBBLE);
    this.fill(171, g + 2, 16, 173, g + 4, 16, STONE);
    this.set(172, g + 5, 16, BANNER);
    this.set(171, g + 2, 17, STONE);
    this.set(173, g + 2, 17, STONE);
    this.set(172, g + 2, 17, COBBLE);
    // braziers flanking the dais
    this.set(166, g + 1, 16, COBBLE); this.set(166, g + 2, 16, EMBER);
    this.set(178, g + 1, 16, COBBLE); this.set(178, g + 2, 16, EMBER);
  }

  openCityGate() {
    const gate = this.cityGate;
    if (!gate || gate.opened) return;
    gate.opened = true;
    for (let x = gate.x0; x <= gate.x1; x++)
      for (let y = gate.y0; y <= gate.y1; y++) this.set(x, y, gate.z, AIR);
    this.updateBlock(gate.x0, gate.y0, gate.z);
    this.updateBlock(gate.x1, gate.y0, gate.z);
  }

  plantTrees(count, x0, z0, x1, z1) {
    for (let i = 0; i < count; i++) {
      const x = x0 + Math.floor(hash2(i * 13 + x0, i * 7 + z0) * (x1 - x0));
      const z = z0 + Math.floor(hash2(i * 29 + z0, i * 11 + x0) * (z1 - z0));
      if (this.sites.some(s => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1)) continue;
      const h = this.surfaceHeight(x, z) - 1;
      if (this.get(x, h, z) !== GRASS && this.get(x, h, z) !== SNOW) continue;
      this.tree(x, h + 1, z);
    }
  }

  tree(x, y, z) {
    const trunk = 4;
    for (let i = 0; i < trunk; i++) this.set(x, y + i, z, LOG);
    for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
      const r = dy >= trunk ? 1 : 2;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < trunk) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && hash3(x + dx, y + dy, z + dz) < 0.5) continue;
          if (this.get(x + dx, y + dy, z + dz) === AIR) this.set(x + dx, y + dy, z + dz, LEAVES);
        }
    }
  }

  // Recolor every banner block to the player's house colors and rebuild
  // just the chunks that contain banners.
  setBannerColor(rgb) {
    COLORS[BANNER] = {
      top: rgb,
      side: [rgb[0] * 0.95, rgb[1] * 0.95, rgb[2] * 0.95],
      bottom: [rgb[0] * 0.78, rgb[1] * 0.78, rgb[2] * 0.78],
    };
    const dirty = new Set();
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++)
        for (let y = 0; y < H; y++) {
          if (this.data[this.idx(x, y, z)] === BANNER) {
            dirty.add(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
          }
        }
    for (const key of dirty) {
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
    }
  }

  raiseBanner() {
    if (!this.tower) return;
    const { x, z, top } = this.tower;
    for (let i = 1; i <= 4; i++) this.set(x, top + i, z, i <= 1 ? STONE : BANNER);
    this.updateBlock(x, top + 2, z);
  }

  // ---------- meshing ----------
  buildAllMeshes() {
    const nx = Math.ceil(W / CHUNK), nz = Math.ceil(D / CHUNK);
    for (let cx = 0; cx < nx; cx++)
      for (let cz = 0; cz < nz; cz++) this.buildChunk(cx, cz);
  }

  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.chunks.get(key);
    if (old) {
      for (const m of [old.solid, old.water, old.torch]) {
        if (m) { this.scene.remove(m); m.geometry.dispose(); }
      }
    }
    const sPos = [], sNrm = [], sCol = [], sIdx = [];
    const wPos = [], wNrm = [], wCol = [], wIdx = [];
    const tPos = [], tNrm = [], tCol = [], tIdx = [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let x = x0; x < Math.min(x0 + CHUNK, W); x++) {
      for (let z = z0; z < Math.min(z0 + CHUNK, D); z++) {
        for (let y = 0; y < H; y++) {
          const b = this.get(x, y, z);
          if (b === AIR) continue;
          if (b === WATER) {
            if (this.get(x, y + 1, z) === AIR) {
              const c = COLORS[WATER].top;
              this.pushFace(wPos, wNrm, wCol, wIdx, x, y, z, FACES[3], [c[0], c[1], c[2]]);
            }
            continue;
          }
          const col = COLORS[b];
          const glow = b === TORCH || b === EMBER; // unlit material — visible in the dark
          for (const f of FACES) {
            const n = this.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (n !== AIR && n !== WATER) continue;
            if (f.dir[1] === -1 && y === 0) continue;
            let base;
            if (f.dir[1] === 1) base = col.top;
            else if (f.dir[1] === -1) base = col.bottom;
            else base = col.side;
            if (glow) {
              this.pushFace(tPos, tNrm, tCol, tIdx, x, y, z, f, [base[0], base[1], base[2]]);
            } else {
              const tint = f.shade * (0.94 + 0.10 * hash3(x, y, z));
              this.pushFace(sPos, sNrm, sCol, sIdx, x, y, z, f,
                [base[0] * tint, base[1] * tint, base[2] * tint]);
            }
          }
        }
      }
    }
    const entry = { solid: null, water: null, torch: null };
    if (sIdx.length) entry.solid = this.makeMesh(sPos, sNrm, sCol, sIdx, this.solidMat);
    if (wIdx.length) entry.water = this.makeMesh(wPos, wNrm, wCol, wIdx, this.waterMat);
    if (tIdx.length) entry.torch = this.makeMesh(tPos, tNrm, tCol, tIdx, this.torchMat);
    this.chunks.set(key, entry);
  }

  pushFace(pos, nrm, col, idx, x, y, z, f, c) {
    const start = pos.length / 3;
    for (const [dx, dy, dz] of f.corners) {
      pos.push(x + dx, y + dy, z + dz);
      nrm.push(f.dir[0], f.dir[1], f.dir[2]);
      col.push(c[0], c[1], c[2]);
    }
    idx.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
  }

  makeMesh(pos, nrm, col, idx, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    this.scene.add(m);
    return m;
  }

  updateBlock(x, y, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.buildChunk(cx, cz);
    if (x % CHUNK === 0 && cx > 0) this.buildChunk(cx - 1, cz);
    if (x % CHUNK === CHUNK - 1 && cx < Math.ceil(W / CHUNK) - 1) this.buildChunk(cx + 1, cz);
    if (z % CHUNK === 0 && cz > 0) this.buildChunk(cx, cz - 1);
    if (z % CHUNK === CHUNK - 1 && cz < Math.ceil(D / CHUNK) - 1) this.buildChunk(cx, cz + 1);
  }

  // ---------- voxel raycast (Amanatides & Woo DDA) ----------
  raycast(origin, dir, maxDist = 6) {
    let ix = Math.floor(origin.x), iy = Math.floor(origin.y), iz = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
    let tx = dir.x !== 0 ? tdx * (dir.x > 0 ? ix + 1 - origin.x : origin.x - ix) : Infinity;
    let ty = dir.y !== 0 ? tdy * (dir.y > 0 ? iy + 1 - origin.y : origin.y - iy) : Infinity;
    let tz = dir.z !== 0 ? tdz * (dir.z > 0 ? iz + 1 - origin.z : origin.z - iz) : Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;
    while (t <= maxDist) {
      const b = this.get(ix, iy, iz);
      if (b !== AIR && b !== WATER) return { x: ix, y: iy, z: iz, block: b, nx, ny, nz };
      if (tx < ty && tx < tz) { ix += stepX; t = tx; tx += tdx; nx = -stepX; ny = 0; nz = 0; }
      else if (ty < tz)       { iy += stepY; t = ty; ty += tdy; nx = 0; ny = -stepY; nz = 0; }
      else                    { iz += stepZ; t = tz; tz += tdz; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }
}
