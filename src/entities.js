import * as THREE from 'three';

function box(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
}

function makeLabel(text, color = '#f0e6c8') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '28px Georgia';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(text).width + 20;
  ctx.fillRect(128 - w / 2, 12, w, 40);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 41);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  spr.scale.set(2.4, 0.6, 1);
  return spr;
}

// ---------- pixel faces (Minecraft-style, drawn on a tiny canvas) ----------
const FACE_CACHE = new Map();
function hexColor(n) { return '#' + n.toString(16).padStart(6, '0'); }

function faceTexture(skinHex, face = {}) {
  const key = skinHex + JSON.stringify(face);
  if (FACE_CACHE.has(key)) return FACE_CACHE.get(key);
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const px = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x * 4, y * 4, w * 4, h * 4); };
  const skin = hexColor(skinHex);
  px(0, 0, 8, 8, skin);
  // hair fringe (top + temples); long hair frames the face for women
  if (face.hair) {
    px(0, 0, 8, 2, face.hair);
    px(0, 2, 1, 1, face.hair); px(7, 2, 1, 1, face.hair);
    if (face.female) { px(0, 2, 1, 6, face.hair); px(7, 2, 1, 6, face.hair); }
  }
  // eyes
  if (face.undead) {
    px(1, 3, 2, 1, '#10161c'); px(5, 3, 2, 1, '#10161c');   // dark sockets
    px(2, 3, 1, 1, face.undead); px(5, 3, 1, 1, face.undead); // glowing pupils
  } else {
    const pupil = face.eyes || '#2a2a35';
    px(1, 3, 1, 1, '#e8e8e8'); px(2, 3, 1, 1, pupil);
    px(5, 3, 1, 1, pupil); px(6, 3, 1, 1, '#e8e8e8');
  }
  // brows (stern) / age lines
  if (face.brows) { px(1, 2, 2, 1, '#1c1c20'); px(5, 2, 2, 1, '#1c1c20'); }
  if (face.old && !face.brows) { px(1, 2, 2, 1, '#9a9a94'); px(5, 2, 2, 1, '#9a9a94'); }
  // beard covers the jaw, mouth shows through
  if (face.beard) {
    px(1, 5, 6, 3, face.beard);
    px(3, 5, 2, 1, '#2a1c16');
  } else if (face.female) {
    px(3, 5, 2, 1, '#a05050');
  } else {
    px(3, 5, 2, 1, face.old ? '#6a5a50' : '#5a3c30');
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  FACE_CACHE.set(key, tex);
  return tex;
}

function makeHead(size, skin, face) {
  const plain = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = face && face.hair
    ? new THREE.MeshLambertMaterial({ color: face.hair })
    : plain;
  const front = new THREE.MeshLambertMaterial({ map: faceTexture(skin, face || {}) });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z (front is +z)
  return new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    [plain, plain, hairMat, plain, front, hairMat]
  );
}

// A limb that swings from a real joint: the pivot sits at the hip/shoulder
// and the mesh hangs below it.
function limbPivot(w, h, d, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = box(w, h, d, color);
  m.position.y = -h / 2;
  pivot.add(m);
  return pivot;
}

// Hand-held gear attaches to the arm pivots so it swings with attacks.
function addGear(g, gear) {
  if (!gear) return;
  const { armR, armL } = g.userData.limbs;
  if (gear.weapon) {
    const w = new THREE.Group();
    if (gear.weapon === 'spear' || gear.weapon === 'ice') {
      const ice = gear.weapon === 'ice';
      const pole = box(0.05, 1.7, 0.05, ice ? 0x9fd4e8 : 0x5a4028);
      const tip = box(0.09, 0.24, 0.09, ice ? 0xe8fbff : 0x9aa3ad);
      tip.position.y = 0.95;
      w.add(pole, tip);
      w.position.set(0, -0.5, 0.12);
    } else if (gear.weapon === 'hammer') {
      const shaft = box(0.06, 0.8, 0.06, 0x5a4028);
      const head = box(0.26, 0.17, 0.17, 0x777780);
      head.position.y = -0.34;
      w.add(shaft, head);
      w.position.set(0, -0.6, 0.1);
    } else { // sword / greatsword
      const len = gear.weapon === 'greatsword' ? 0.95 : 0.6;
      const blade = box(0.06, len, 0.06, 0x9aa3ad);
      blade.position.y = -len / 2 - 0.12;
      const guard = box(0.18, 0.05, 0.06, 0x6b5a35);
      guard.position.y = -0.1;
      w.add(blade, guard);
      w.position.set(0, -0.55, 0.08);
    }
    armR.add(w);
  }
  if (gear.shield) {
    const s = box(0.07, 0.5, 0.4, 0x6a4a28);
    const bossKnob = box(0.04, 0.16, 0.14, 0x9aa3ad);
    bossKnob.position.x = -0.06;
    s.add(bossKnob);
    s.position.set(-0.13, -0.4, 0);
    armL.add(s);
  }
}

function makeHumanoid({ shirt, pants, skin, scale = 1, face = {}, gear = null }) {
  const g = new THREE.Group();
  const legL = limbPivot(0.22, 0.7, 0.22, pants, -0.13, 0.7, 0);
  const legR = limbPivot(0.22, 0.7, 0.22, pants, 0.13, 0.7, 0);
  const armL = limbPivot(0.16, 0.6, 0.16, shirt, -0.35, 1.32, 0);
  const armR = limbPivot(0.16, 0.6, 0.16, shirt, 0.35, 1.32, 0);
  const body = box(0.5, 0.65, 0.28, shirt); body.position.y = 1.02;
  const belt = box(0.52, 0.08, 0.3, 0x2a2018); belt.position.y = 0.74;
  const head = makeHead(0.42, skin, face); head.position.y = 1.58;
  g.add(legL, legR, body, belt, armL, armR, head);
  // armor details
  if (gear && gear.helmet) {
    const helm = box(0.46, 0.16, 0.46, 0x7a7a84); helm.position.y = 0.2;
    const nose = box(0.07, 0.2, 0.05, 0x7a7a84); nose.position.set(0, 0, 0.22);
    head.add(helm, nose);
  }
  if (gear && gear.crown) {
    const band = box(0.46, 0.08, 0.46, 0xe8c020); band.position.y = 0.24;
    head.add(band);
    for (const [dx, dz] of [[-0.17, 0.17], [0.17, 0.17], [-0.17, -0.17], [0.17, -0.17]]) {
      const spike = box(0.07, 0.14, 0.07, 0xe8c020);
      spike.position.set(dx, 0.34, dz);
      head.add(spike);
    }
  }
  if (gear && gear.pauldrons) {
    for (const side of [-1, 1]) {
      const p = box(0.24, 0.12, 0.28, gear.pauldrons);
      p.position.set(side * 0.35, 1.38, 0);
      g.add(p);
    }
  }
  g.scale.setScalar(scale);
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.breathe = { mesh: body, baseY: 1.02 };
  addGear(g, gear);
  return g;
}

function makeQuadruped({ bodyColor, legColor, headColor, bodyW, bodyH, bodyL, legH, headScale = 1, tail = true, ears = true }) {
  const g = new THREE.Group();
  const body = box(bodyW, bodyH, bodyL, bodyColor);
  body.position.y = legH + bodyH / 2;
  const head = box(0.38 * headScale, 0.35 * headScale, 0.4 * headScale, headColor);
  head.position.set(0, legH + bodyH * 0.9, bodyL / 2 + 0.15);
  const hw = 0.38 * headScale, hh = 0.35 * headScale, hd = 0.4 * headScale;
  // eyes + ears on the head
  for (const side of [-1, 1]) {
    const eye = box(0.06, 0.06, 0.02, 0x14141a);
    eye.position.set(side * hw * 0.24, hh * 0.14, hd / 2 + 0.01);
    head.add(eye);
    if (ears) {
      const ear = box(0.09, 0.14, 0.05, legColor);
      ear.position.set(side * hw * 0.32, hh / 2 + 0.06, -hd * 0.15);
      head.add(ear);
    }
  }
  // legs swing from hip joints
  const legs = [];
  const lx = bodyW / 2 - 0.1, lz = bodyL / 2 - 0.15;
  for (const [dx, dz] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const l = limbPivot(0.15, legH, 0.15, legColor, dx, legH, dz);
    legs.push(l); g.add(l);
  }
  g.add(body, head);
  if (tail) {
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, legH + bodyH * 0.8, -bodyL / 2);
    const t = box(0.12, 0.12, 0.4, legColor);
    t.position.z = -0.22;
    tailPivot.add(t);
    g.add(tailPivot);
    g.userData.tail = tailPivot;
  }
  g.userData.limbs = { legL: legs[0], legR: legs[1], armL: legs[2], armR: legs[3] };
  g.userData.head = head;
  g.userData.breathe = { mesh: body, baseY: legH + bodyH / 2 };
  return g;
}

function makeWolf(color = 0x6e6e6e) {
  return makeQuadruped({ bodyColor: color, legColor: 0x5a5a5a, headColor: color, bodyW: 0.5, bodyH: 0.45, bodyL: 1.0, legH: 0.4 });
}
function makeBoar() {
  const g = makeQuadruped({ bodyColor: 0x5e4630, legColor: 0x4a3826, headColor: 0x4e3a28, bodyW: 0.6, bodyH: 0.55, bodyL: 1.0, legH: 0.32, tail: false });
  // tusks
  for (const side of [-1, 1]) {
    const tusk = box(0.05, 0.14, 0.05, 0xe8e0d0);
    tusk.position.set(side * 0.12, -0.1, 0.22);
    g.userData.head.add(tusk);
  }
  return g;
}
function makeHorse() {
  const g = makeQuadruped({ bodyColor: 0x6a4a2a, legColor: 0x54381e, headColor: 0x6a4a2a, bodyW: 0.8, bodyH: 0.9, bodyL: 1.8, legH: 1.0, headScale: 1.1 });
  const neck = box(0.35, 0.8, 0.35, 0x6a4a2a); neck.position.set(0, 1.95, 0.85);
  const head = g.userData.head; head.position.set(0, 2.45, 1.15); head.scale.set(0.9, 1.1, 1.6);
  const mane = box(0.14, 0.7, 0.3, 0x3a2814); mane.position.set(0, 2.1, 0.62);
  // saddle + blanket
  const blanket = box(0.86, 0.06, 0.7, 0x7a2a2a); blanket.position.set(0, 1.93, -0.1);
  const saddle = box(0.5, 0.14, 0.55, 0x3a2814); saddle.position.set(0, 2.02, -0.1);
  const pommel = box(0.12, 0.14, 0.1, 0x3a2814); pommel.position.set(0, 2.12, 0.16);
  g.add(neck, mane, blanket, saddle, pommel);
  return g;
}

export function makeDragon(scale, bodyColor, wingColor) {
  const g = new THREE.Group();
  const body = box(1.5, 1.0, 2.6, bodyColor); body.position.y = 1.3;
  const neck = box(0.55, 0.55, 1.0, bodyColor); neck.position.set(0, 1.8, 1.6);
  const head = box(0.7, 0.55, 1.0, bodyColor); head.position.set(0, 2.1, 2.4);
  // jaw on a hinge — opens when breathing fire
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 1.9, 2.0);
  const jaw = box(0.4, 0.16, 0.7, wingColor);
  jaw.position.set(0, -0.05, 0.45);
  jawPivot.add(jaw);
  // tail in two jointed segments that sway
  const tailPivot1 = new THREE.Group();
  tailPivot1.position.set(0, 1.15, -1.2);
  const tail1 = box(0.6, 0.5, 1.4, bodyColor); tail1.position.z = -0.7;
  tailPivot1.add(tail1);
  const tailPivot2 = new THREE.Group();
  tailPivot2.position.set(0, -0.08, -1.4);
  const tail2 = box(0.35, 0.3, 1.4, bodyColor); tail2.position.z = -0.7;
  tailPivot2.add(tail2);
  tailPivot1.add(tailPivot2);
  // spikes along the spine
  for (const [sy, sz, ss] of [[1.95, 0.7, 0.22], [1.95, 0.1, 0.26], [1.95, -0.5, 0.22], [1.55, -1.1, 0.18]]) {
    const spike = box(0.12, ss, 0.12, wingColor);
    spike.position.set(0, sy, sz);
    g.add(spike);
  }
  const legs = [];
  for (const [dx, dz] of [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]]) {
    const l = limbPivot(0.28, 0.9, 0.28, bodyColor, dx, 0.9, dz);
    legs.push(l); g.add(l);
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.75, 1.85, 0.3);
    const wing = box(2.6, 0.08, 1.5, wingColor);
    wing.position.x = side * 1.4;
    pivot.add(wing);
    wings.push(pivot);
    g.add(pivot);
  }
  const hornL = box(0.12, 0.4, 0.12, wingColor); hornL.position.set(-0.22, 2.5, 2.2);
  const hornR = box(0.12, 0.4, 0.12, wingColor); hornR.position.set(0.22, 2.5, 2.2);
  // glowing amber eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.09, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xffb020 })
    );
    eye.position.set(side * 0.2, 2.22, 2.91);
    g.add(eye);
  }
  g.add(body, neck, head, jawPivot, tailPivot1, hornL, hornR);
  g.scale.setScalar(scale);
  g.userData.wings = wings;
  g.userData.limbs = { legL: legs[0], legR: legs[1], armL: legs[2], armR: legs[3] };
  g.userData.tailSegs = [tailPivot1, tailPivot2];
  g.userData.jaw = jawPivot;
  g.userData.breathe = { mesh: body, baseY: 1.3 };
  return g;
}

function makeProp(color) {
  const g = new THREE.Group();
  const b = box(0.9, 0.8, 0.9, color); b.position.y = 0.4;
  g.add(b);
  return g;
}

const ENEMY_DEFS = {
  wolf:   { hp: 30,  dmg: 6,  speed: 4.2, aggro: 10, leash: 30, gold: 4,   xp: 25,  label: 'Wolf', labelColor: '#cfcfcf' },
  bandit: { hp: 55,  dmg: 9,  speed: 3.4, aggro: 12, leash: 30, gold: 10,  xp: 40,  label: 'Bandit', labelColor: '#e0a050' },
  boss:   { hp: 260, dmg: 16, speed: 2.9, aggro: 14, leash: 30, gold: 120, xp: 200, label: 'Bandit King Rorge', labelColor: '#c77dff' },
  wight:  { hp: 40,  dmg: 8,  speed: 3.2, aggro: 14, leash: 55, gold: 3,   xp: 22,  label: 'Wight', labelColor: '#9fd0c0', undead: true },
  walker: { hp: 130, dmg: 18, speed: 2.4, aggro: 16, leash: 60, gold: 0,   xp: 130, label: 'White Walker', labelColor: '#bfefff', undead: true },
  raider: { hp: 60,  dmg: 10, speed: 3.8, aggro: 400, leash: 999, gold: 12, xp: 45, label: 'Vale Raider', labelColor: '#ffb0b0' },
  boar:   { hp: 35,  dmg: 7,  speed: 4.6, aggro: 9,  leash: 25, gold: 2,   xp: 18,  label: 'Wild Boar', labelColor: '#e0c0a0' },
  dragonboss: { hp: 500, dmg: 22, speed: 0, aggro: 48, leash: 999, gold: 300, xp: 500, label: 'The Wild Dragon', labelColor: '#a0ff90' },
  royal:  { hp: 70,  dmg: 11, speed: 3.7, aggro: 15, leash: 45, gold: 14,  xp: 50,  label: 'Royal Guard', labelColor: '#ffdf80' },
  gate:   { hp: 350, dmg: 0,  speed: 0,   aggro: 0,  leash: 1,  gold: 0,   xp: 150, label: 'Kingsport Gate', labelColor: '#ffb060' },
  mountain: { hp: 420, dmg: 24, speed: 3.1, aggro: 18, leash: 60, gold: 250, xp: 450, label: 'Ser Gregor the Block', labelColor: '#ff8080' },
  king:   { hp: 160, dmg: 12, speed: 3.4, aggro: 20, leash: 60, gold: 600, xp: 600, label: 'King Joffron', labelColor: '#ffd54a' },
};

const BOSS_BARS = {
  boss: 'BANDIT KING RORGE',
  mountain: 'SER GREGOR THE BLOCK',
  king: 'KING JOFFRON',
};

const ALLY_DEFS = {
  snow: { hp: 70,  dmg: 9,  speed: 5.0, label: 'Snow', labelColor: '#eef4ff' },
  bryn: { hp: 140, dmg: 15, speed: 4.2, label: 'Ser Bryn', labelColor: '#ffd0a0' },
  orso: { hp: 130, dmg: 13, speed: 4.3, label: 'Captain Orso', labelColor: '#c0e0a0' },
};

const KEEP = { x: 52, z: 100 };

export class Entities {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.items = [];      // world pickups: bandages, kits, weapons
    this.dragon = null;   // player's dragon companion
    this.horse = null;
    this.time = 0;
    this.hintCd = 0;
    this.nightWarned = false;
  }

  groundY(x, z) { return this.game.world.surfaceHeight(Math.floor(x), Math.floor(z)); }

  addNpc(id, name, x, z, colors) {
    const y = this.groundY(x, z);
    const group = makeHumanoid(colors);
    group.position.set(x, y, z);
    const label = makeLabel(name, '#ffe9a8');
    label.position.y = 2.2;
    group.add(label);
    this.game.scene.add(group);
    this.npcs.push({ id, name, group, pos: group.position });
  }

  addProp(id, name, x, z, color) {
    const y = this.groundY(x, z);
    const group = makeProp(color);
    group.position.set(x, y, z);
    const label = makeLabel(name, '#ffe9a8');
    label.position.y = 1.6;
    group.add(label);
    this.game.scene.add(group);
    this.npcs.push({ id, name, group, pos: group.position, prop: true });
  }

  removeNpc(id) {
    const i = this.npcs.findIndex(n => n.id === id);
    if (i >= 0) {
      this.game.scene.remove(this.npcs[i].group);
      this.npcs.splice(i, 1);
    }
  }

  addEnemy(type, x, z, isNight = false) {
    const def = ENEMY_DEFS[type];
    const y = this.groundY(x, z);
    let group;
    if (type === 'wolf') group = makeWolf();
    else if (type === 'boar') group = makeBoar();
    else if (type === 'boss') group = makeHumanoid({ shirt: 0x4d1259, pants: 0x2a2a2a, skin: 0xb08968, scale: 1.35,
      face: { beard: '#161616', hair: '#161616', brows: true }, gear: { weapon: 'hammer', pauldrons: 0x2a2a30 } });
    else if (type === 'wight') group = makeHumanoid({ shirt: 0x4a5248, pants: 0x3a423a, skin: 0x8fa08f,
      face: { undead: '#9fe8c8', old: true } });
    else if (type === 'walker') group = makeHumanoid({ shirt: 0x2e3d44, pants: 0x23303a, skin: 0xbfe0e8, scale: 1.25,
      face: { undead: '#66e0ff', brows: true }, gear: { weapon: 'ice' } });
    else if (type === 'raider') group = makeHumanoid({ shirt: 0x3a4a6e, pants: 0x2a2a2a, skin: 0xc9a07a,
      face: { hair: '#3a2a1a', brows: true }, gear: { weapon: 'sword', helmet: true } });
    else if (type === 'dragonboss') group = makeDragon(1.4, 0x3a5a2a, 0x7a9a3a);
    else if (type === 'royal') group = makeHumanoid({ shirt: 0xc9a227, pants: 0x3a3a3a, skin: 0xd8b090,
      face: { hair: '#4a3a20', brows: true }, gear: { weapon: 'spear', helmet: true, pauldrons: 0xc9a227 } });
    else if (type === 'mountain') group = makeHumanoid({ shirt: 0x8a8a92, pants: 0x4a4a52, skin: 0xd8c0a0, scale: 1.6,
      face: { beard: '#2a2018', brows: true }, gear: { weapon: 'greatsword', helmet: true, pauldrons: 0x6a6a72 } });
    else if (type === 'king') group = makeHumanoid({ shirt: 0x6a2a6a, pants: 0xc9a227, skin: 0xe8c8a0,
      face: { hair: '#e8d070' }, gear: { crown: true, weapon: 'sword' } });
    else if (type === 'gate') {
      group = new THREE.Group();
      const brace = box(2.4, 2.4, 0.4, 0x8a6a3a);
      brace.position.y = 1.6;
      group.add(brace);
    }
    else group = makeHumanoid({ shirt: 0x704214, pants: 0x3d3d3d, skin: 0xc99b71,
      face: { beard: '#3a2a1a', brows: true }, gear: { weapon: 'sword' } });
    group.position.set(x, type === 'dragonboss' ? y + 13 : y, z);
    const label = makeLabel(type === 'gate' ? 'Kingsport Gate — dragonfire!' : def.label, def.labelColor);
    label.position.y = type === 'wolf' || type === 'boar' ? 1.3 :
      (type === 'boss' || type === 'walker' ? 2.9 :
      (type === 'dragonboss' ? 4.5 :
      (type === 'mountain' ? 3.4 : (type === 'gate' ? 3.6 : 2.2))));
    group.add(label);
    this.game.scene.add(group);
    const e = {
      type, group, pos: group.position,
      hp: def.hp, maxHp: def.hp, dmg: def.dmg, speed: def.speed, aggro: def.aggro,
      leash: def.leash, gold: def.gold, xp: def.xp, undead: !!def.undead,
      spawnPos: new THREE.Vector3(x, y, z),
      attackCd: 0, hitFlash: 0, dead: false, deathT: 0, aggroed: false,
      isNight, circleT: Math.random() * 6.28, fireCd: 0,
    };
    this.enemies.push(e);
    return e;
  }

  addAlly(id) {
    if (this.allies.some(a => a.id === id)) return;
    const def = ALLY_DEFS[id];
    const p = this.game.player.pos;
    let group;
    if (id === 'snow') group = makeWolf(0xdde4ec);
    else if (id === 'orso') group = makeHumanoid({ shirt: 0x4a5a3a, pants: 0x5a4a30, skin: 0xc99b71,
      face: { beard: '#4a4a42', hair: '#4a4a42' }, gear: { weapon: 'sword', shield: true } });
    else group = makeHumanoid({ shirt: 0x7a2a2a, pants: 0x3a3a3a, skin: 0xd8b090,
      face: { beard: '#6a4028', hair: '#6a4028' }, gear: { weapon: 'sword', shield: true, pauldrons: 0x7a2a2a } });
    group.position.set(p.x + 1.5, p.y, p.z + 1.5);
    const label = makeLabel(def.label + ' (ally)', def.labelColor);
    label.position.y = id === 'snow' ? 1.3 : 2.2;
    group.add(label);
    this.game.scene.add(group);
    this.allies.push({
      id, group, pos: group.position, hp: def.hp, maxHp: def.hp,
      dmg: def.dmg, speed: def.speed, attackCd: 0, downed: false, reviveT: 0,
    });
  }

  // ---------- world pickups ----------
  addItem(kind, x, z, weaponId = null) {
    const group = new THREE.Group();
    let labelText, labelColor = '#a0ffb0';
    if (kind === 'bandage') {
      const b = box(0.3, 0.18, 0.3, 0xe8e4d8); b.position.y = 0.1;
      group.add(b);
      labelText = 'Bandage';
    } else if (kind === 'kit') {
      const b = box(0.45, 0.3, 0.45, 0xf0ede4); b.position.y = 0.15;
      const c1 = box(0.3, 0.06, 0.1, 0xc03030); c1.position.y = 0.32;
      const c2 = box(0.1, 0.06, 0.3, 0xc03030); c2.position.y = 0.32;
      group.add(b, c1, c2);
      labelText = "Maester's Kit";
    } else { // weapon
      labelColor = '#ffd54a';
      if (weaponId === 'hammer') {
        const head = box(0.35, 0.22, 0.22, 0x777780); head.position.y = 0.55;
        const shaft = box(0.07, 0.6, 0.07, 0x5a4028); shaft.position.y = 0.25;
        group.add(head, shaft);
        labelText = "Rorge's Warhammer";
      } else {
        const stock = box(0.1, 0.1, 0.55, 0x5a4028); stock.position.y = 0.3;
        const bow = box(0.55, 0.08, 0.08, 0x6b4a2b); bow.position.set(0, 0.3, 0.2);
        group.add(stock, bow);
        labelText = 'Myrish Crossbow';
      }
    }
    const y = this.groundY(x, z);
    group.position.set(x, y + 0.3, z);
    const label = makeLabel(labelText, labelColor);
    label.position.y = 1.0;
    group.add(label);
    this.game.scene.add(group);
    this.items.push({ kind, weaponId, group, pos: group.position, baseY: y + 0.3, bobSeed: Math.random() * 6 });
  }

  updateItems(dt) {
    const p = this.game.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.pos.y = it.baseY + Math.sin(this.time * 2 + it.bobSeed) * 0.12 + 0.1;
      it.group.rotation.y += dt * 1.5;
      const d = Math.hypot(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
      if (d < 1.8 && Math.abs(it.baseY - p.pos.y) < 3) {
        if (this.game.save) {
          this.game.save.markItemTaken((it.weaponId || it.kind) + '@' + Math.round(it.pos.x) + ',' + Math.round(it.pos.z));
        }
        this.game.audio?.play('pickup');
        if (it.kind === 'bandage') {
          p.bandages++;
          this.game.ui.toast('+1 Bandage — press Q to use (heals 30)', 'gold');
        } else if (it.kind === 'kit') {
          p.kits++;
          this.game.ui.toast("+1 Maester's Kit — press F to use (full heal)", 'gold');
        } else {
          this.game.grantWeapon(it.weaponId);
        }
        this.game.scene.remove(it.group);
        this.items.splice(i, 1);
        this.game.ui.updateHud();
      }
    }
  }

  spawnHorse(x, z) {
    const group = makeHorse();
    group.position.set(x, this.groundY(x, z), z);
    const label = makeLabel('Old Thunder (horse)', '#e8cfa0');
    label.position.y = 3.1;
    group.add(label);
    this.game.scene.add(group);
    this.horse = { group, pos: group.position, mounted: false };
  }

  spawnDragonHatchling() {
    const p = this.game.player.pos;
    const group = makeDragon(0.35, 0x2a2a32, 0x8a2020);
    group.position.set(p.x + 2, p.y, p.z + 2);
    const label = makeLabel('Vhagrik (hatchling)', '#ff9a6a');
    label.position.y = 2.2;
    group.add(label);
    this.game.scene.add(group);
    this.dragon = { group, pos: group.position, state: 'hatchling', mounted: false, fireCd: 0, label };
  }

  growDragon() {
    if (!this.dragon) return;
    this.dragon.group.scale.setScalar(1.0);
    this.dragon.state = 'grown';
    this.dragon.label.material.map.dispose();
    const newLabel = makeLabel('Vhagrik (press E to ride)', '#ff9a6a');
    newLabel.position.y = 4.2;
    this.dragon.group.remove(this.dragon.label);
    this.dragon.group.add(newLabel);
    this.dragon.label = newLabel;
  }

  nearestNpc(pos, maxDist = 3.2) {
    let best = null, bestD = maxDist;
    for (const n of this.npcs) {
      const d = n.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  // ---------- damage ----------
  // source: 'sword' | 'valyrian' | 'dagger' | 'arrow' | 'fire' | 'ally'
  hitEnemy(e, dmg, source, knockDir = null) {
    if (e.dead) return false;
    const anti = source === 'dagger' || source === 'fire' || source === 'valyrian';
    if (e.type === 'gate' && source !== 'fire') {
      if (this.hintCd <= 0) {
        this.game.ui.toast('Ironwood bound in bronze — only dragonfire can burn it. Ride Vhagrik!');
        this.hintCd = 3;
      }
      this.game.audio?.play('clink');
      e.aggroed = true;
      return true;
    }
    if (e.type === 'walker' && !anti) {
      if (this.hintCd <= 0) {
        this.game.ui.toast('Your steel cannot bite the cold ones — you need dragonglass or dragonfire!');
        this.hintCd = 3;
      }
      this.game.audio?.play('clink');
      e.aggroed = true;
      return true; // "hit" but no damage
    }
    let amount = dmg;
    if (e.undead && source === 'dagger') amount = Math.round(dmg * 2.5);
    this.game.audio?.play('hit');
    e.hp -= amount;
    e.hitFlash = 0.12;
    e.aggroed = true;
    if (knockDir && e.type !== 'dragonboss') {
      e.pos.x += knockDir.x * 0.7;
      e.pos.z += knockDir.z * 0.7;
    }
    if (e.hp <= 0) this.kill(e);
    return true;
  }

  hitEnemyFromCamera(origin, dir, range, dmg, source = 'sword') {
    let best = null, bestD = range;
    const v = new THREE.Vector3();
    for (const e of this.enemies) {
      if (e.dead) continue;
      v.copy(e.pos); v.y += e.type === 'dragonboss' ? 1.5 : 0.9; v.sub(origin);
      const d = v.length();
      if (d > range) continue;
      v.normalize();
      if (v.dot(dir) < 0.55) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return false;
    return this.hitEnemy(best, dmg, source, dir);
  }

  kill(e, reward = true) {
    e.dead = true;
    e.deathT = 0;
    if (reward) {
      this.game.audio?.play('coin');
      const p = this.game.player;
      p.gold += e.gold;
      p.addXp(e.xp);
      if (e.type === 'boar') {
        p.meat++;
        this.game.ui.toast('+1 boar meat', 'gold');
      }
      this.game.ui.toast(`${ENEMY_DEFS[e.type].label} slain  ·  +${e.gold} gold  ·  +${e.xp} xp`, 'gold');
      this.game.quests.onKill(e.type);
      // loot drops
      if ((e.type === 'bandit' || e.type === 'raider') && Math.random() < 0.4) {
        this.addItem('bandage', e.pos.x, e.pos.z);
      }
      if (['boss', 'dragonboss', 'mountain', 'king'].includes(e.type)) {
        this.addItem('kit', e.pos.x + 1, e.pos.z);
        this.addItem('bandage', e.pos.x - 1, e.pos.z);
      }
    }
    if (e.type === 'gate') {
      this.game.world.openCityGate();
      this.game.ui.toast('The gate burns! Kingsport lies open.', 'gold');
    }
    if (BOSS_BARS[e.type] || e.type === 'dragonboss' || e.type === 'gate') this.game.ui.hideBossBar();
  }

  removeEnemy(e) {
    e.dead = true;
    if (e.group.parent) this.game.scene.remove(e.group);
  }

  // ---------- projectiles ----------
  shoot(kind, pos, vel, dmg, friendly) {
    let mesh;
    if (kind === 'arrow') {
      mesh = box(0.06, 0.06, 0.7, 0x8a6a3a);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(kind === 'fire' ? 0.32 : 0.4, 6, 6),
        new THREE.MeshBasicMaterial({ color: friendly ? 0xff7a20 : 0xff4a10 })
      );
    }
    mesh.position.copy(pos);
    this.game.scene.add(mesh);
    this.projectiles.push({ kind, mesh, pos: mesh.position, vel, dmg, friendly, life: 5 });
  }

  updateProjectiles(dt) {
    const world = this.game.world;
    const p = this.game.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.kind === 'arrow') pr.vel.y -= 12 * dt;
      pr.pos.x += pr.vel.x * dt;
      pr.pos.y += pr.vel.y * dt;
      pr.pos.z += pr.vel.z * dt;
      if (pr.kind === 'arrow') mesh_lookAt(pr);
      let hit = pr.life <= 0 || world.isSolid(Math.floor(pr.pos.x), Math.floor(pr.pos.y), Math.floor(pr.pos.z));
      if (!hit && pr.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const r = (e.type === 'dragonboss' || e.type === 'gate') ? 3.0 : (e.type === 'mountain' ? 2.0 : 1.3);
          const cy = e.type === 'dragonboss' ? 1.5 : 0.9;
          const dx = e.pos.x - pr.pos.x, dy = (e.pos.y + cy) - pr.pos.y, dz = e.pos.z - pr.pos.z;
          if (dx * dx + dy * dy + dz * dz < r * r) {
            this.hitEnemy(e, pr.dmg, pr.kind === 'fire' ? 'fire' : 'arrow');
            hit = true;
            break;
          }
        }
      } else if (!hit && !pr.friendly) {
        const dx = p.pos.x - pr.pos.x, dy = (p.pos.y + 1) - pr.pos.y, dz = p.pos.z - pr.pos.z;
        if (dx * dx + dy * dy + dz * dz < 3.2) {
          p.damage(pr.dmg);
          hit = true;
        }
        if (!hit) {
          for (const a of this.allies) {
            if (a.downed) continue;
            const ax = a.pos.x - pr.pos.x, ay = (a.pos.y + 1) - pr.pos.y, az = a.pos.z - pr.pos.z;
            if (ax * ax + ay * ay + az * az < 2.5) { this.damageAlly(a, pr.dmg); hit = true; break; }
          }
        }
      }
      if (hit) {
        // fireballs splash on impact
        if (pr.kind === 'fire' && pr.friendly) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (e.pos.distanceTo(pr.pos) < 3) this.hitEnemy(e, Math.round(pr.dmg * 0.6), 'fire');
          }
        }
        this.game.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    function mesh_lookAt(pr) {
      const t = pr.pos.clone().add(pr.vel);
      pr.mesh.lookAt(t);
    }
  }

  damageAlly(a, n) {
    if (a.downed) return;
    a.hp -= n;
    if (a.hp <= 0) {
      a.hp = 0;
      a.downed = true;
      a.reviveT = 18;
      a.group.rotation.z = 1.3;
      this.game.ui.toast(`${ALLY_DEFS[a.id].label} is down — they will recover soon.`);
    }
  }

  // ---------- night undead ----------
  maintainUndead() {
    const stage = this.game.quests.stage;
    const night = (this.game.dayAmount ?? 1) < 0.18;
    if (!night) {
      let crumbled = false;
      for (const e of this.enemies) {
        if (e.isNight && !e.dead) { this.removeEnemy(e); crumbled = true; }
      }
      if (crumbled) this.game.ui.toast('The dead crumble with the dawn.');
      this.nightWarned = false;
      return;
    }
    if (!this.nightWarned) {
      this.nightWarned = true;
      this.game.audio?.play('night');
      this.game.ui.toast('Night falls. Dead things walk — stay near the keep, or bring dragonglass.');
      if (this.game.world.torches.length === 0) {
        this.game.ui.toast('Tip: place torches (T, costs 1 wood) — the dead will not rise near their light.');
      }
    }
    const wantWights = stage >= 19 ? 9 : (stage >= 9 ? 7 : 4);
    const wantWalkers = (stage === 15 || stage >= 19) ? 3 : (stage >= 9 ? 2 : 1);
    const wights = this.enemies.filter(e => e.type === 'wight' && !e.dead).length;
    const walkers = this.enemies.filter(e => e.type === 'walker' && !e.dead).length;
    const p = this.game.player.pos;
    const spawnAt = () => {
      for (let tries = 0; tries < 10; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = 35 + Math.random() * 25;
        const x = Math.max(5, Math.min(187, p.x + Math.cos(a) * d));
        const z = Math.max(5, Math.min(187, p.z + Math.sin(a) * d));
        if (Math.hypot(x - KEEP.x, z - KEEP.z) < 30) continue;
        if (Math.hypot(x - 140, z - 96) < 22) continue;  // spare the village
        if (Math.hypot(x - 170, z - 30) < 32) continue;  // and the capital
        // player-placed torches ward off the dead
        if (this.game.world.torches.some(t => Math.hypot(t.x - x, t.z - z) < 12)) continue;
        return { x, z };
      }
      return null;
    };
    for (let i = wights; i < wantWights; i++) {
      const s = spawnAt();
      if (s) this.addEnemy('wight', s.x, s.z, true);
    }
    for (let i = walkers; i < wantWalkers; i++) {
      const s = spawnAt();
      if (s) this.addEnemy('walker', s.x, Math.min(s.z, 110), true);
    }
  }

  // ---------- per-frame ----------
  update(dt) {
    this.time += dt;
    if (this.hintCd > 0) this.hintCd -= dt;
    const p = this.game.player;
    const world = this.game.world;

    this.maintainUndead();
    this.updateProjectiles(dt);
    this.updateItems(dt);

    // NPCs face the player when near, and breathe
    let nphase = 0;
    for (const n of this.npcs) {
      if (n.prop) continue;
      if (n.pos.distanceTo(p.pos) < 6) {
        n.group.rotation.y = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
      }
      this.idleAnim(n.group, nphase++);
    }

    // targets an enemy may choose from: player + standing allies
    const targets = [{ pos: p.pos, hit: (n) => p.damage(n), isPlayer: true }];
    for (const a of this.allies) {
      if (!a.downed) targets.push({ pos: a.pos, hit: (n) => this.damageAlly(a, n) });
    }

    let bossFrac = null, bossName = '';
    for (const e of this.enemies) {
      if (e.dead) {
        e.deathT += dt;
        if (e.type === 'dragonboss') {
          e.pos.y = Math.max(this.groundY(e.pos.x, e.pos.z) + 0.5, e.pos.y - 10 * dt);
          e.group.rotation.z = Math.min(2.4, e.deathT * 2);
          if (e.deathT > 3 && e.group.parent) this.game.scene.remove(e.group);
        } else {
          e.group.rotation.z = Math.min(Math.PI / 2, e.deathT * 4);
          if (e.deathT > 1.2 && e.group.parent) this.game.scene.remove(e.group);
        }
        continue;
      }
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.group.traverse(o => { if (o.isMesh) o.material.emissive?.setHex(e.hitFlash > 0 ? 0x881111 : 0x000000); });
      }

      if (e.type === 'dragonboss') {
        this.updateDragonBoss(e, dt, p);
        if (e.pos.distanceTo(p.pos) < 55) { bossFrac = e.hp / e.maxHp; bossName = 'THE WILD DRAGON'; }
        continue;
      }
      if (e.type === 'gate') {
        if (e.aggroed && e.pos.distanceTo(p.pos) < 45) { bossFrac = e.hp / e.maxHp; bossName = 'THE GATES OF KINGSPORT'; }
        continue;
      }

      // pick nearest target
      let tgt = null, td = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
        if (d < td) { td = d; tgt = t; }
      }
      const chasing = !p.dead && tgt && (e.aggroed || td < e.aggro);
      if (chasing && td > e.leash) e.aggroed = false;

      // undead don't press into the keep's walls
      const nearKeep = e.undead && Math.hypot(e.pos.x - KEEP.x, e.pos.z - KEEP.z) < 20;

      let moving = false;
      if (chasing && td <= e.leash && !nearKeep) {
        if (!e.aggroed && e.type === 'walker') this.game.audio?.play('walker', 2500);
        e.aggroed = true;
        const dx = tgt.pos.x - e.pos.x, dz = tgt.pos.z - e.pos.z;
        e.group.rotation.y = Math.atan2(dx, dz);
        if (td > 1.7) {
          e.pos.x += (dx / td) * e.speed * dt;
          e.pos.z += (dz / td) * e.speed * dt;
          moving = true;
        }
        e.attackCd -= dt;
        if (td < 2.0 && e.attackCd <= 0) {
          e.attackCd = 1.2;
          e.attackAnim = 1;
          tgt.hit(e.dmg);
        }
        if (BOSS_BARS[e.type]) { bossFrac = e.hp / e.maxHp; bossName = BOSS_BARS[e.type]; }
      } else {
        const hx = e.spawnPos.x - e.pos.x, hz = e.spawnPos.z - e.pos.z;
        const hd = Math.hypot(hx, hz);
        if (hd > 1.5) {
          e.pos.x += (hx / hd) * e.speed * 0.5 * dt;
          e.pos.z += (hz / hd) * e.speed * 0.5 * dt;
          e.group.rotation.y = Math.atan2(hx, hz);
          moving = true;
          e.hp = Math.min(e.maxHp, e.hp + 5 * dt);
        }
      }

      const gy = this.groundY(e.pos.x, e.pos.z);
      e.pos.y += (gy - e.pos.y) * Math.min(1, dt * 12);
      e.attackAnim = Math.max(0, (e.attackAnim || 0) - dt * 3);
      this.walkAnim(e.group, moving, e.attackAnim);
      this.idleAnim(e.group, e.spawnPos.x);
    }

    if (bossFrac !== null) this.game.ui.showBossBar(bossFrac, bossName);
    else this.game.ui.hideBossBar();

    this.updateAllies(dt, p);
    this.updateDragonCompanion(dt, p);
    this.updateHorse(dt);
  }

  updateDragonBoss(e, dt, p) {
    const LAIR = { x: 34, z: 150 };
    e.circleT += dt * 0.35;
    const gy = this.groundY(LAIR.x, LAIR.z);
    const tx = LAIR.x + Math.cos(e.circleT) * 20;
    const tz = LAIR.z + Math.sin(e.circleT) * 20;
    const ty = gy + 13 + Math.sin(this.time * 0.7) * 2.5;
    e.pos.x += (tx - e.pos.x) * Math.min(1, dt * 2);
    e.pos.y += (ty - e.pos.y) * Math.min(1, dt * 2);
    e.pos.z += (tz - e.pos.z) * Math.min(1, dt * 2);
    e.group.rotation.y = Math.atan2(tx - e.pos.x, tz - e.pos.z) || e.group.rotation.y;
    this.flapWings(e.group, 7);
    e.jawT = Math.max(0, (e.jawT || 0) - dt * 2);
    this.dragonIdle(e.group, e.jawT);
    // breathe fire at the player
    e.fireCd -= dt;
    const d = e.pos.distanceTo(p.pos);
    if (!p.dead && d < 48 && e.fireCd <= 0) {
      e.fireCd = 2.5;
      e.jawT = 1;
      const from = e.pos.clone(); from.y += 1.5;
      const to = p.pos.clone(); to.y += 1.2;
      const vel = to.sub(from).normalize().multiplyScalar(15);
      this.shoot('efire', from, vel, 20, false);
    }
  }

  updateAllies(dt, p) {
    for (const a of this.allies) {
      if (a.downed) {
        a.reviveT -= dt;
        if (a.reviveT <= 0) {
          a.downed = false;
          a.hp = a.maxHp;
          a.group.rotation.z = 0;
          this.game.ui.toast(`${ALLY_DEFS[a.id].label} is back on their feet!`, 'gold');
        }
        continue;
      }
      // choose a foe: nearest living, non-walker enemy near the party
      let foe = null, fd = 14;
      for (const e of this.enemies) {
        if (e.dead || e.type === 'walker' || e.type === 'dragonboss' || e.type === 'gate') continue;
        if (!e.aggroed && e.pos.distanceTo(p.pos) > 12) continue;
        const d = e.pos.distanceTo(a.pos);
        if (d < fd) { fd = d; foe = e; }
      }
      let moving = false;
      if (foe) {
        const dx = foe.pos.x - a.pos.x, dz = foe.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        a.group.rotation.y = Math.atan2(dx, dz);
        if (d > 1.6) {
          a.pos.x += (dx / d) * a.speed * dt;
          a.pos.z += (dz / d) * a.speed * dt;
          moving = true;
        }
        a.attackCd -= dt;
        if (d < 1.9 && a.attackCd <= 0) {
          a.attackCd = 1.1;
          a.attackAnim = 1;
          this.hitEnemy(foe, a.dmg, 'ally');
        }
      } else {
        const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 40) { a.pos.set(p.pos.x + 2, p.pos.y, p.pos.z + 2); }
        else if (d > 4) {
          a.pos.x += (dx / d) * a.speed * dt;
          a.pos.z += (dz / d) * a.speed * dt;
          a.group.rotation.y = Math.atan2(dx, dz);
          moving = true;
        }
      }
      const gy = this.groundY(a.pos.x, a.pos.z);
      a.pos.y += (gy - a.pos.y) * Math.min(1, dt * 12);
      a.attackAnim = Math.max(0, (a.attackAnim || 0) - dt * 3);
      this.walkAnim(a.group, moving, a.attackAnim);
      this.idleAnim(a.group, a.id.length);
    }
  }

  updateDragonCompanion(dt, p) {
    const d = this.dragon;
    if (!d || d.mounted) return;
    const grown = d.state === 'grown';
    const dx = p.pos.x - d.pos.x, dz = p.pos.z - d.pos.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (dist > 60) d.pos.set(p.pos.x + 3, p.pos.y, p.pos.z + 3);
    else if (dist > (grown ? 7 : 4)) {
      const sp = grown ? 9 : 4.5;
      d.pos.x += (dx / dist) * sp * dt;
      d.pos.z += (dz / dist) * sp * dt;
      d.group.rotation.y = Math.atan2(dx, dz);
      moving = true;
    }
    const gy = this.groundY(d.pos.x, d.pos.z);
    const targetY = grown ? gy + 4 + Math.sin(this.time * 1.4) * 0.6 : gy;
    d.pos.y += (targetY - d.pos.y) * Math.min(1, dt * 4);
    if (grown) this.flapWings(d.group, 5);
    else this.walkAnim(d.group, moving);
    d.jawT = Math.max(0, (d.jawT || 0) - dt * 2);
    this.dragonIdle(d.group, d.jawT);
    // a grown dragon defends you
    if (grown) {
      d.fireCd -= dt;
      if (d.fireCd <= 0) {
        for (const e of this.enemies) {
          if (e.dead || e.type === 'dragonboss') continue;
          if (!e.aggroed) continue;
          if (e.pos.distanceTo(p.pos) > 22) continue;
          d.fireCd = 2.2;
          d.jawT = 1;
          const from = d.pos.clone(); from.y += 2;
          const to = e.pos.clone(); to.y += 1;
          const vel = to.sub(from).normalize().multiplyScalar(16);
          this.shoot('fire', from, vel, 20, true);
          break;
        }
      }
    }
  }

  updateHorse(dt) {
    const h = this.horse;
    if (!h || h.mounted) return;
    const gy = this.groundY(h.pos.x, h.pos.z);
    h.pos.y += (gy - h.pos.y) * Math.min(1, dt * 12);
    this.idleAnim(h.group, 2.5);
  }

  walkAnim(group, moving, attackT = 0) {
    const limbs = group.userData.limbs;
    if (!limbs) return;
    const s = moving ? Math.sin(this.time * 9) * 0.55 : 0;
    limbs.legL.rotation.x = s;
    limbs.legR.rotation.x = -s;
    limbs.armL.rotation.x = -s * 0.8;
    // the weapon arm raises and chops when attacking
    limbs.armR.rotation.x = attackT > 0 ? -2.2 * attackT : s * 0.8;
  }

  // subtle life: breathing bodies, wagging tails
  idleAnim(group, phase = 0) {
    const u = group.userData;
    if (u.breathe) u.breathe.mesh.position.y = u.breathe.baseY + Math.sin(this.time * 2.2 + phase) * 0.02;
    if (u.tail) u.tail.rotation.y = Math.sin(this.time * 5 + phase) * 0.35;
  }

  dragonIdle(group, jawT = 0) {
    const u = group.userData;
    if (u.tailSegs) {
      u.tailSegs[0].rotation.y = Math.sin(this.time * 1.6) * 0.18;
      u.tailSegs[1].rotation.y = Math.sin(this.time * 1.6 + 0.9) * 0.3;
    }
    if (u.jaw) u.jaw.rotation.x = 0.7 * Math.max(0, jawT);
    if (u.breathe) u.breathe.mesh.position.y = u.breathe.baseY + Math.sin(this.time * 1.8) * 0.03;
  }

  flapWings(group, speed) {
    const wings = group.userData.wings;
    if (!wings) return;
    const a = 0.35 + Math.sin(this.time * speed) * 0.45;
    wings[0].rotation.z = a;
    wings[1].rotation.z = -a;
  }
}
