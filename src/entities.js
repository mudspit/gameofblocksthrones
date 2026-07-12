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
  const g = makeQuadruped({ bodyColor: color, legColor: 0x5a5a5a, headColor: color, bodyW: 0.5, bodyH: 0.45, bodyL: 1.0, legH: 0.4 });
  const head = g.userData.head;
  // snout and bared fangs
  const snout = box(0.2, 0.16, 0.26, color);
  snout.position.set(0, -0.03, 0.32);
  head.add(snout);
  for (const side of [-1, 1]) {
    const fang = box(0.04, 0.1, 0.04, 0xf0ece0);
    fang.position.set(side * 0.05, -0.13, 0.42);
    head.add(fang);
  }
  // shaggy shoulder ruff
  const ruff = box(0.62, 0.42, 0.32, 0x4a4a4a);
  ruff.position.set(0, 0.62, 0.32);
  g.add(ruff);
  // paw claws
  for (const l of Object.values(g.userData.limbs)) {
    for (const cx of [-0.05, 0.05]) {
      const claw = box(0.04, 0.09, 0.12, 0xe8e0d0);
      claw.position.set(cx, -0.4, 0.08);
      l.add(claw);
    }
  }
  return g;
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

export function makeDragon(scale, bodyColor, wingColor, eyeColor = 0xffb020) {
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
  // scaled hide plates down both flanks
  for (let zz = -1.0; zz <= 1.0; zz += 0.5) {
    for (const side of [-1, 1]) {
      const plate = box(0.14, 0.16, 0.34, wingColor);
      plate.position.set(side * 0.73, 1.52, zz);
      plate.rotation.z = side * 0.5;
      g.add(plate);
    }
  }
  const legs = [];
  for (const [dx, dz] of [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]]) {
    const l = limbPivot(0.28, 0.9, 0.28, bodyColor, dx, 0.9, dz);
    // three pale claws at the foot
    for (const cx of [-0.09, 0, 0.09]) {
      const claw = box(0.07, 0.13, 0.18, 0xe8e0d0);
      claw.position.set(cx, -0.92, 0.16);
      claw.rotation.x = 0.4;
      l.add(claw);
    }
    legs.push(l); g.add(l);
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.75, 1.85, 0.3);
    const wing = box(2.6, 0.08, 1.5, wingColor);
    wing.position.x = side * 1.4;
    pivot.add(wing);
    // finger-bone horns rising along the wing, and a hooked claw at the tip
    for (const [wx, wh] of [[0.8, 0.34], [1.6, 0.44], [2.3, 0.52]]) {
      const spike = box(0.1, wh, 0.1, wingColor);
      spike.position.set(side * wx, wh / 2, -0.55);
      pivot.add(spike);
    }
    const tipClaw = box(0.12, 0.13, 0.42, 0xe8e0d0);
    tipClaw.position.set(side * 2.6, 0.03, 0.6);
    pivot.add(tipClaw);
    wings.push(pivot);
    g.add(pivot);
  }
  const hornL = box(0.12, 0.4, 0.12, wingColor); hornL.position.set(-0.22, 2.5, 2.2);
  const hornR = box(0.12, 0.4, 0.12, wingColor); hornR.position.set(0.22, 2.5, 2.2);
  // longer back-swept brow horns
  for (const side of [-1, 1]) {
    const brow = box(0.1, 0.55, 0.1, wingColor);
    brow.position.set(side * 0.3, 2.42, 1.98);
    brow.rotation.x = 0.7;
    g.add(brow);
  }
  // glowing amber eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.09, 0.03),
      new THREE.MeshBasicMaterial({ color: eyeColor })
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

import { LEGEND_NAMES } from './legends.js';

function makeLegend(id) {
  switch (id) {
    case 'jon': return makeHumanoid({ shirt: 0x1a1a1e, pants: 0x141416, skin: 0xd8c8b8,
      face: { hair: '#141414', beard: '#141414', brows: true }, gear: { weapon: 'sword' } });
    case 'daeneris': return makeHumanoid({ shirt: 0x9ac8e8, pants: 0x9ac8e8, skin: 0xe8d8c8,
      face: { female: true, hair: '#e8e8f0' } });
    case 'hound': return makeHumanoid({ shirt: 0x3a3a3e, pants: 0x2a2a2c, skin: 0xc8a888, scale: 1.45,
      face: { beard: '#5a3a20', brows: true }, gear: { weapon: 'greatsword', helmet: true, pauldrons: 0x3a3a3e } });
    case 'jaime': return makeHumanoid({ shirt: 0xd4af37, pants: 0x8a6a20, skin: 0xe0c0a0,
      face: { hair: '#e8d070', beard: '#e8d070' }, gear: { weapon: 'sword', pauldrons: 0xd4af37 } });
    case 'tyrion': return makeHumanoid({ shirt: 0x7a2a2a, pants: 0x3a3a3a, skin: 0xe0c0a0, scale: 0.62,
      face: { hair: '#c8a860', beard: '#c8a860', brows: true } });
  }
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
  // wandering legends turned hostile — mini-bosses
  jon:      { hp: 320, dmg: 26, speed: 3.9, aggro: 30, leash: 999, gold: 250, xp: 400, label: 'Jon of the Snows', labelColor: '#d8e8f0' },
  daeneris: { hp: 260, dmg: 18, speed: 3.4, aggro: 30, leash: 999, gold: 320, xp: 400, label: 'Daeneris Stormborn', labelColor: '#c8e0ff', fireRange: 25 },
  hound:    { hp: 420, dmg: 28, speed: 3.1, aggro: 30, leash: 999, gold: 280, xp: 420, label: 'Sandor the Burned', labelColor: '#d0b090' },
  jaime:    { hp: 280, dmg: 30, speed: 4.3, aggro: 30, leash: 999, gold: 350, xp: 400, label: 'Ser Jaime the Golden', labelColor: '#ffe090' },
  // Act IV — The Long Night
  iceheart:    { hp: 220, dmg: 0,  speed: 0,   aggro: 0,  leash: 1,   gold: 40,   xp: 150,  label: 'Ice Heart', labelColor: '#9ae8ff' },
  undeaddragon: { hp: 420, dmg: 24, speed: 0,  aggro: 48, leash: 999, gold: 350,  xp: 600,  label: 'The Undead Dragon', labelColor: '#8ad0e8', boltKind: 'ice', boltDmg: 26 },
  nightking:   { hp: 500, dmg: 30, speed: 3.2, aggro: 40, leash: 999, gold: 1000, xp: 1000, label: 'The Night King', labelColor: '#8af0ff', undead: true, fireRange: 20, boltKind: 'ice', boltDmg: 22 },
  // rebel warbands (army battles)
  rebel:   { hp: 75,  dmg: 12, speed: 3.7, aggro: 400, leash: 999, gold: 16,  xp: 55,  label: 'Rebel Soldier', labelColor: '#e09090' },
  warlord: { hp: 300, dmg: 22, speed: 3.4, aggro: 400, leash: 999, gold: 150, xp: 250, label: 'Rebel Warlord', labelColor: '#ff9060' },
  // wildlife & brigands
  bear:    { hp: 140, dmg: 16, speed: 3.6, aggro: 10, leash: 30, gold: 30,  xp: 90,  label: 'Cave Bear', labelColor: '#c8a070' },
  outlaw:  { hp: 55,  dmg: 9,  speed: 3.4, aggro: 17, leash: 35, gold: 12,  xp: 45,  label: 'Outlaw Archer', labelColor: '#b0c090', fireRange: 16, boltKind: 'earrow', boltDmg: 10 },
  giant:   { hp: 600, dmg: 34, speed: 2.6, aggro: 12, leash: 45, gold: 250, xp: 500, label: 'The Hill Giant', labelColor: '#e0b880' },
  // rogue dragons — neutral until provoked; can be trained with boar meat
  roguedragon: { hp: 480, dmg: 22, speed: 0, aggro: 48, leash: 999, gold: 300, xp: 550, label: 'Rogue Dragon', labelColor: '#b0e890', boltKind: 'efire', boltDmg: 22 },
  // hold garrisons (wars of conquest)
  housecarl: { hp: 85,  dmg: 13, speed: 3.6, aggro: 22, leash: 60, gold: 15,  xp: 55,  label: 'Hold Guard', labelColor: '#c0b0e0' },
  holdlord:  { hp: 350, dmg: 24, speed: 3.3, aggro: 25, leash: 60, gold: 200, xp: 300, label: 'Lord of the Hold', labelColor: '#e0a0ff' },
  // spellcasters
  mage:     { hp: 70, dmg: 8,  speed: 3.2, aggro: 18, leash: 40, gold: 25, xp: 80,  label: 'Shadow Mage', labelColor: '#d0a0ff', fireRange: 18, boltKind: 'spell', boltDmg: 14 },
  deepmage: { hp: 65, dmg: 9,  speed: 3.2, aggro: 20, leash: 50, gold: 35, xp: 110, label: 'Deep Mage', labelColor: '#c890ff', fireRange: 20, boltKind: 'spell', boltDmg: 16 },
  // the Underdeep
  deepguard:  { hp: 70,  dmg: 13, speed: 3.6, aggro: 20, leash: 50, gold: 18,  xp: 70,  label: 'Deep Guard', labelColor: '#a0b8d0' },
  frostgiant: { hp: 380, dmg: 30, speed: 2.7, aggro: 16, leash: 50, gold: 220, xp: 420, label: 'Frost Giant', labelColor: '#a8e0f0' },
  deepking:   { hp: 480, dmg: 26, speed: 3.0, aggro: 22, leash: 60, gold: 800, xp: 800, label: 'The Deep King', labelColor: '#c890ff', fireRange: 18, boltKind: 'spell', boltDmg: 20 },
  // a friend turned by the cold ones — free them, don't farm them
  thrall: { hp: 100, dmg: 12, speed: 3.2, aggro: 16, leash: 60, gold: 0, xp: 0, label: 'Thrall', labelColor: '#8af0ff', undead: true },
};

// wild wyrms of the realm — train them with meat, or slay them for treasure
export const ROGUE_DRAGONS = {
  verdant: { name: 'Verdant Wyrm', body: 0x3a7a3a, wings: 0x6aa04a, lair: { x: 170, z: 170 } },
  storm:   { name: 'Storm Wyrm',   body: 0x5a6a7a, wings: 0x8a9ab0, lair: { x: 15,  z: 120 } },
  ash:     { name: 'Ash Wyrm',     body: 0x5a2a20, wings: 0x9a4a30, lair: { x: 60,  z: 180 } },
};

// hidden relics with permanent rewards
const RELICS = {
  crown:   { name: 'Crown of the First Kings', desc: '+20 max health', apply: p => { p.maxHp += 20; p.hp += 20; } },
  ember:   { name: 'Ember Amulet',             desc: '+3 damage',      apply: p => { p.dmg += 3; } },
  totem:   { name: 'Old Gods Totem',           desc: '+20 max health', apply: p => { p.maxHp += 20; p.hp += 20; } },
  ring:    { name: 'Sea-Iron Ring',            desc: '+3 damage',      apply: p => { p.dmg += 3; } },
  tear:    { name: 'Frozen Tear',              desc: '+25 max health', apply: p => { p.maxHp += 25; p.hp += 25; } },
  chalice: { name: 'Sunburst Chalice',         desc: '+200 gold',      apply: p => { p.gold += 200; } },
};
export const RELIC_COUNT = Object.keys(RELICS).length;

const BOSS_BARS = {
  boss: 'BANDIT KING RORGE',
  mountain: 'SER GREGOR THE BLOCK',
  king: 'KING JOFFRON',
  jon: 'JON OF THE SNOWS',
  daeneris: 'DAENERIS STORMBORN',
  hound: 'SANDOR THE BURNED',
  jaime: 'THE KINGSLAYER',
  nightking: 'THE NIGHT KING',
  warlord: 'REBEL WARLORD',
  giant: 'THE HILL GIANT',
  holdlord: 'LORD OF THE HOLD',
  frostgiant: 'FROST GIANT',
  deepking: 'THE DEEP KING',
};

const ALLY_DEFS = {
  snow: { hp: 70,  dmg: 9,  speed: 5.0, label: 'Snow', labelColor: '#eef4ff' },
  bryn: { hp: 140, dmg: 15, speed: 4.2, label: 'Ser Bryn', labelColor: '#ffd0a0' },
  orso: { hp: 130, dmg: 13, speed: 4.3, label: 'Captain Orso', labelColor: '#c0e0a0' },
  jon:      { hp: 240, dmg: 22, speed: 4.5, label: 'Jon of the Snows', labelColor: '#d8e8f0' },
  daeneris: { hp: 180, dmg: 20, speed: 4.2, label: 'Daeneris Stormborn', labelColor: '#c8e0ff', source: 'fire' },
  hound:    { hp: 300, dmg: 24, speed: 3.6, label: 'Sandor the Burned', labelColor: '#d0b090' },
  jaime:    { hp: 220, dmg: 26, speed: 4.4, label: 'Ser Jaime the Golden', labelColor: '#ffe090' },
};

// Hired soldiers (the player's bought army). Unlike story allies they die for good.
export const MAX_ARMY = 8;
const SOLDIER_DEFS = {
  levy:   { hp: 100, dmg: 12, speed: 4.4, cost: 100, label: 'Levy' },
  knight: { hp: 190, dmg: 22, speed: 4.2, cost: 250, label: 'Hired Knight' },
};
function makeSoldier(type) {
  if (type === 'knight') return makeHumanoid({ shirt: 0x8a8f96, pants: 0x4a4e54, skin: 0xd8b090,
    face: { brows: true, hair: '#3a2a1a' }, gear: { weapon: 'sword', shield: true, helmet: true, pauldrons: 0x9aa0a8 } });
  return makeHumanoid({ shirt: 0x6a5230, pants: 0x4a3a24, skin: 0xc99b71,
    face: { brows: true, hair: '#4a3418' }, gear: { weapon: 'spear' } });
}
// enemies too large for footsoldiers to bother fighting
const BIG_FOES = new Set(['dragonboss', 'undeaddragon', 'gate', 'iceheart', 'nightking', 'roguedragon']);

// jagged ice growing from a cold one's shoulders and spine
function addIceShards(group, count, color = 0x9ae8ff) {
  const spots = [[-0.34, 1.42, -0.12], [0.34, 1.42, -0.12], [-0.22, 1.72, -0.14], [0.22, 1.72, -0.14], [0, 1.98, -0.16]];
  for (let i = 0; i < count && i < spots.length; i++) {
    const [x, y, z] = spots[i];
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.32 + (i % 3) * 0.12, 0.08),
      new THREE.MeshBasicMaterial({ color })
    );
    shard.position.set(x, y, z);
    shard.rotation.x = -0.35;
    group.add(shard);
  }
}

const KEEP = { x: 52, z: 100 };

export class Entities {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.items = [];      // world pickups: bandages, kits, weapons
    this.soldiers = [];   // player's bought army (permadeath)
    this.battleActive = false;
    this.battleWave = 0;
    this.rogues = {};     // rogue dragon fates: id -> 'tamed' | 'slain'
    this.guardians = [];  // tamed wyrms circling overhead
    this.wars = {};       // kingdom id -> war in progress
    this.dragon = null;   // player's dragon companion
    this.horse = null;
    this.time = 0;
    this.hintCd = 0;
    this.nightWarned = false;
  }

  // Ground height. With fromY, scans DOWN from that height so creatures in
  // the Underdeep stand on the cavern floor instead of the surface above.
  groundY(x, z, fromY = null) {
    if (fromY == null) return this.game.world.surfaceHeight(Math.floor(x), Math.floor(z));
    return this.game.world.standAt(Math.floor(x), Math.floor(z), fromY);
  }

  // is this position under the world's roof? (cavern-dwellers, spelunking players)
  isUnderground(pos) {
    return pos.y < this.game.world.surfaceHeight(Math.floor(pos.x), Math.floor(pos.z)) - 3;
  }

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

  addLegendNpc(legendId, x, z) {
    const y = this.groundY(x, z);
    const group = makeLegend(legendId);
    group.position.set(x, y, z);
    const label = makeLabel(LEGEND_NAMES[legendId], '#ffd54a');
    label.position.y = legendId === 'hound' ? 3.2 : (legendId === 'tyrion' ? 1.6 : 2.3);
    group.add(label);
    this.game.scene.add(group);
    this.npcs.push({ id: 'legend_' + legendId, legendId, name: LEGEND_NAMES[legendId], group, pos: group.position });
  }

  addProp(id, name, x, z, color, atY = null) {
    const y = atY != null ? this.game.world.standAt(Math.floor(x), Math.floor(z), atY) : this.groundY(x, z);
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

  addEnemy(type, x, z, isNight = false, atY = null) {
    const def = ENEMY_DEFS[type];
    const y = atY != null ? this.game.world.standAt(Math.floor(x), Math.floor(z), atY) : this.groundY(x, z);
    let group;
    if (type === 'wolf') group = makeWolf();
    else if (type === 'boar') group = makeBoar();
    else if (type === 'boss') group = makeHumanoid({ shirt: 0x4d1259, pants: 0x2a2a2a, skin: 0xb08968, scale: 1.35,
      face: { beard: '#161616', hair: '#161616', brows: true }, gear: { weapon: 'hammer', pauldrons: 0x2a2a30 } });
    else if (type === 'wight') { group = makeHumanoid({ shirt: 0x4a5248, pants: 0x3a423a, skin: 0x8fa08f,
      face: { undead: '#9fe8c8', old: true } }); addIceShards(group, 2, 0x9fe8c8); }
    else if (type === 'walker') { group = makeHumanoid({ shirt: 0x2e3d44, pants: 0x23303a, skin: 0xbfe0e8, scale: 1.25,
      face: { undead: '#66e0ff', brows: true }, gear: { weapon: 'ice' } }); addIceShards(group, 5); }
    else if (type === 'raider') group = makeHumanoid({ shirt: 0x3a4a6e, pants: 0x2a2a2a, skin: 0xc9a07a,
      face: { hair: '#3a2a1a', brows: true }, gear: { weapon: 'sword', helmet: true } });
    else if (type === 'dragonboss') group = makeDragon(1.4, 0x3a5a2a, 0x7a9a3a);
    else if (type === 'royal') group = makeHumanoid({ shirt: 0xc9a227, pants: 0x3a3a3a, skin: 0xd8b090,
      face: { hair: '#4a3a20', brows: true }, gear: { weapon: 'spear', helmet: true, pauldrons: 0xc9a227 } });
    else if (type === 'mountain') group = makeHumanoid({ shirt: 0x8a8a92, pants: 0x4a4a52, skin: 0xd8c0a0, scale: 1.6,
      face: { beard: '#2a2018', brows: true }, gear: { weapon: 'greatsword', helmet: true, pauldrons: 0x6a6a72 } });
    else if (type === 'king') group = makeHumanoid({ shirt: 0x6a2a6a, pants: 0xc9a227, skin: 0xe8c8a0,
      face: { hair: '#e8d070' }, gear: { crown: true, weapon: 'sword' } });
    else if (type === 'rebel') group = makeHumanoid({ shirt: 0x6a3030, pants: 0x3a2a2a, skin: 0xc9a07a,
      face: { hair: '#2a1a10', brows: true }, gear: { weapon: 'spear', helmet: true } });
    else if (type === 'bear') {
      group = makeQuadruped({ bodyColor: 0x5a4028, legColor: 0x4a341e, headColor: 0x54391f,
        bodyW: 0.95, bodyH: 0.85, bodyL: 1.5, legH: 0.55, headScale: 1.3, tail: false });
      // hump and claws
      const hump = box(0.8, 0.3, 0.7, 0x4a341e); hump.position.set(0, 1.42, -0.2);
      group.add(hump);
      for (const l of Object.values(group.userData.limbs)) {
        for (const cx of [-0.05, 0.05]) {
          const claw = box(0.05, 0.1, 0.14, 0xe8e0d0);
          claw.position.set(cx, -0.55, 0.1);
          l.add(claw);
        }
      }
    }
    else if (type === 'outlaw') group = makeHumanoid({ shirt: 0x4a5a38, pants: 0x3a3428, skin: 0xc9a07a,
      face: { hair: '#3a3020', brows: true } });
    else if (type === 'giant') group = makeHumanoid({ shirt: 0x6a5a44, pants: 0x54483a, skin: 0xd8c0a0, scale: 2.2,
      face: { beard: '#4a3a28', hair: '#4a3a28', brows: true }, gear: { weapon: 'hammer' } });
    else if (type === 'roguedragon') group = makeDragon(1.25, 0x3a7a3a, 0x6aa04a);
    else if (type === 'housecarl') group = makeHumanoid({ shirt: 0x5a4a7a, pants: 0x3a3448, skin: 0xc9a07a,
      face: { hair: '#2a2418', brows: true }, gear: { weapon: 'spear', helmet: true } });
    else if (type === 'holdlord') group = makeHumanoid({ shirt: 0x7a5a9a, pants: 0x3a3448, skin: 0xd8b090, scale: 1.35,
      face: { beard: '#4a3a2a', hair: '#4a3a2a', brows: true }, gear: { weapon: 'greatsword', helmet: true, pauldrons: 0x7a5a9a } });
    else if (type === 'mage' || type === 'deepmage') {
      group = makeHumanoid({ shirt: type === 'mage' ? 0x3a2a4a : 0x2a2440, pants: type === 'mage' ? 0x3a2a4a : 0x2a2440,
        skin: 0xc8b0a0, face: { hair: type === 'mage' ? '#2a2035' : '#201a30', brows: true }, gear: { weapon: 'spear' } });
      // a glowing focus crystal above the staff hand
      const orb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xb060f0 }));
      orb.position.set(0.35, 1.9, 0.15);
      orb.rotation.y = 0.6;
      group.add(orb);
    }
    else if (type === 'deepguard') group = makeHumanoid({ shirt: 0x3a4450, pants: 0x2a3038, skin: 0xb8a898,
      face: { beard: '#3a3430', hair: '#3a3430', brows: true }, gear: { weapon: 'spear', helmet: true, pauldrons: 0x3a4450 } });
    else if (type === 'frostgiant') {
      group = makeHumanoid({ shirt: 0x7a94a8, pants: 0x5a7080, skin: 0xb8d8e8, scale: 2.3,
        face: { beard: '#d8ecf4', hair: '#d8ecf4', brows: true }, gear: { weapon: 'hammer' } });
      addIceShards(group, 4);
    }
    else if (type === 'deepking') {
      group = makeHumanoid({ shirt: 0x2a2440, pants: 0x201a30, skin: 0xb8a8c8, scale: 1.4,
        face: { beard: '#5a5070', hair: '#5a5070', brows: true }, gear: { crown: true, weapon: 'spear' } });
      const orb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xb060f0 }));
      orb.position.set(0.35, 1.95, 0.15);
      group.add(orb);
    }
    else if (type === 'warlord') group = makeHumanoid({ shirt: 0x8a2020, pants: 0x2a2020, skin: 0xd8b090, scale: 1.4,
      face: { beard: '#3a1a10', hair: '#3a1a10', brows: true }, gear: { weapon: 'greatsword', helmet: true, pauldrons: 0x8a2020 } });
    else if (type === 'gate') {
      group = new THREE.Group();
      const brace = box(2.4, 2.4, 0.4, 0x8a6a3a);
      brace.position.y = 1.6;
      group.add(brace);
    }
    else if (type === 'iceheart') {
      group = new THREE.Group();
      const glow = (w, h, d, yy) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x66d8ff }));
        m.position.y = yy;
        group.add(m);
      };
      glow(1.2, 0.5, 1.2, 0.25);
      glow(0.7, 1.4, 0.7, 1.1);
      glow(0.35, 0.9, 0.35, 2.2);
    }
    else if (type === 'undeaddragon') group = makeDragon(1.4, 0x9ab8c8, 0x3a4a55, 0x66d8ff);
    else if (type === 'nightking') {
      group = makeHumanoid({ shirt: 0x1a2830, pants: 0x14202a, skin: 0xbfe0e8, scale: 1.3,
        face: { undead: '#8af0ff', brows: true }, gear: { weapon: 'ice' } });
      // crown of ice
      for (const [dx, dz] of [[-0.15, 0.12], [0.15, 0.12], [-0.15, -0.12], [0.15, -0.12], [0, 0]]) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), new THREE.MeshBasicMaterial({ color: 0x9ae8ff }));
        spike.position.set(dx, 1.9, dz);
        group.add(spike);
      }
      addIceShards(group, 5);
    }
    else if (LEGEND_NAMES[type]) group = makeLegend(type);
    else group = makeHumanoid({ shirt: 0x704214, pants: 0x3d3d3d, skin: 0xc99b71,
      face: { beard: '#3a2a1a', brows: true }, gear: { weapon: 'sword' } });
    const flier = type === 'dragonboss' || type === 'undeaddragon' || type === 'roguedragon';
    group.position.set(x, flier ? y + 13 : y, z);
    const label = makeLabel(
      type === 'gate' ? 'Kingsport Gate — dragonfire!' :
      (type === 'iceheart' ? 'Ice Heart — dragonfire!' : def.label), def.labelColor);
    label.position.y = type === 'wolf' || type === 'boar' ? 1.3 :
      (type === 'boss' || type === 'walker' || type === 'nightking' || type === 'deepking' ? 2.9 :
      (flier ? 4.5 :
      (type === 'mountain' ? 3.4 :
      (type === 'giant' ? 4.6 :
      (type === 'frostgiant' ? 4.8 :
      (type === 'bear' ? 2.0 :
      (type === 'holdlord' ? 2.6 :
      (type === 'gate' || type === 'iceheart' ? 3.6 : 2.2))))))));
    group.add(label);
    this.game.scene.add(group);
    // the realm hardens as your legend grows: enemies scale with campaign progress
    const diff = 1 + Math.max(0, (this.game.quests ? this.game.quests.stage : 0) - 8) * 0.03;
    const e = {
      type, group, pos: group.position,
      hp: Math.round(def.hp * diff), maxHp: Math.round(def.hp * diff),
      dmg: Math.round(def.dmg * diff), speed: def.speed, aggro: def.aggro,
      leash: def.leash, gold: def.gold, xp: def.xp, undead: !!def.undead,
      spawnPos: new THREE.Vector3(x, y, z),
      attackCd: 0, hitFlash: 0, dead: false, deathT: 0, aggroed: false,
      isNight, circleT: Math.random() * 6.28, fireCd: 0, fireRange: def.fireRange || 0,
      boltKind: def.boltKind || 'efire', boltDmg: Math.round((def.boltDmg || 16) * diff),
      summonCd: 8,
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
    // health bar above the name — only shows when hurt
    const barCanvas = document.createElement('canvas');
    barCanvas.width = 64; barCanvas.height = 10;
    const barTex = new THREE.CanvasTexture(barCanvas);
    const barSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, depthTest: false }));
    barSpr.scale.set(1.5, 0.22, 1);
    barSpr.position.y = label.position.y + 0.4;
    barSpr.visible = false;
    group.add(barSpr);
    this.game.scene.add(group);
    this.allies.push({
      id, name: def.label, group, pos: group.position, hp: def.hp, maxHp: def.hp,
      dmg: def.dmg, speed: def.speed, attackCd: 0, downed: false, reviveT: 0,
      bar: { canvas: barCanvas, tex: barTex, spr: barSpr },
    });
  }

  drawAllyBar(a) {
    const frac = a.downed ? Math.max(0, 1 - a.reviveT / 18) : Math.max(0, a.hp / a.maxHp);
    a.bar.spr.visible = a.downed || a.hp < a.maxHp - 0.5;
    if (!a.bar.spr.visible) return;
    if (a._barFrac !== undefined && Math.abs(a._barFrac - frac) < 0.02 && a._barDown === a.downed) return;
    a._barFrac = frac; a._barDown = a.downed;
    const g = a.bar.canvas.getContext('2d');
    g.clearRect(0, 0, 64, 10);
    g.fillStyle = 'rgba(10,8,6,0.85)';
    g.fillRect(0, 0, 64, 10);
    g.fillStyle = a.downed ? '#b8a830' : (frac > 0.5 ? '#4a9a3a' : frac > 0.25 ? '#c9a227' : '#b03030');
    g.fillRect(1, 1, 62 * frac, 8);
    a.bar.tex.needsUpdate = true;
  }

  // ---------- hired army ----------
  soldierCount() { return this.soldiers.filter(s => !s.dead).length; }

  addSoldier(type, silent = false) {
    if (this.soldierCount() >= MAX_ARMY) return false;
    const def = SOLDIER_DEFS[type];
    const p = this.game.player.pos;
    const idx = this.soldiers.length;
    const group = makeSoldier(type);
    const ox = ((idx % 4) - 1.5) * 1.6, oz = 2 + Math.floor(idx / 4) * 1.6;
    group.position.set(p.x + ox, p.y, p.z + oz);
    const label = makeLabel(def.label, type === 'knight' ? '#d8e0e8' : '#e0d0a0');
    label.position.y = 2.2;
    group.add(label);
    const barCanvas = document.createElement('canvas');
    barCanvas.width = 64; barCanvas.height = 10;
    const barTex = new THREE.CanvasTexture(barCanvas);
    const barSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, depthTest: false }));
    barSpr.scale.set(1.5, 0.22, 1);
    barSpr.position.y = 2.6;
    barSpr.visible = false;
    group.add(barSpr);
    this.game.scene.add(group);
    this.soldiers.push({
      type, name: def.label, group, pos: group.position,
      hp: def.hp, maxHp: def.hp, dmg: def.dmg, speed: def.speed,
      attackCd: 0, dead: false, deathT: 0, formation: { ox, oz },
      bar: { canvas: barCanvas, tex: barTex, spr: barSpr },
    });
    if (!silent) this.game.ui.toast(`${def.label} joins your host!`, 'gold');
    return true;
  }

  drawSoldierBar(s) {
    const frac = Math.max(0, s.hp / s.maxHp);
    s.bar.spr.visible = s.hp < s.maxHp - 0.5;
    if (!s.bar.spr.visible) return;
    if (s._bf !== undefined && Math.abs(s._bf - frac) < 0.02) return;
    s._bf = frac;
    const g = s.bar.canvas.getContext('2d');
    g.clearRect(0, 0, 64, 10);
    g.fillStyle = 'rgba(10,8,6,0.85)';
    g.fillRect(0, 0, 64, 10);
    g.fillStyle = frac > 0.5 ? '#4a9a3a' : frac > 0.25 ? '#c9a227' : '#b03030';
    g.fillRect(1, 1, 62 * frac, 8);
    s.bar.tex.needsUpdate = true;
  }

  damageSoldier(s, n) {
    if (s.dead) return;
    s.hp -= n;
    if (s.hp <= 0) {
      s.hp = 0; s.dead = true; s.deathT = 0;
      this.game.ui.toast(`Your ${s.type === 'knight' ? 'hired knight' : 'levy'} falls in battle.`);
      this.game.audio?.play('hurt');
    }
  }

  // muster a hold's garrison for a war of conquest
  spawnGarrison(kingdomId) {
    const hold = this.game.world.holds[kingdomId];
    if (!hold || this.wars[kingdomId]) return;
    this.wars[kingdomId] = true;
    const spots = [[-4, -4], [4, -4], [-4, 2], [4, 2], [0, -6], [-6, 0], [6, 0]];
    for (const [ox, oz] of spots) {
      this.addEnemy('housecarl', hold.x + ox + 0.5, hold.z + oz + 0.5).kingdom = kingdomId;
    }
    this.addEnemy('holdlord', hold.x + 0.5, hold.z - 1.5).kingdom = kingdomId;
  }

  // provoke a rebel warband to march on the keep — bigger each wave
  musterRebelHost() {
    if (this.battleActive) return;
    this.battleActive = true;
    this.battleWave++;
    const n = 3 + this.battleWave * 2;
    const originX = 52, originZ = 134;
    for (let i = 0; i < n; i++) {
      const ox = originX + (i % 5 - 2) * 2.4;
      const oz = originZ + Math.floor(i / 5) * 2.4;
      this.addEnemy('rebel', ox + 0.5, oz + 0.5).aggroed = true;
    }
    this.addEnemy('warlord', originX + 0.5, originZ + 4.5).aggroed = true;
    this.game.ui.toast(`Wave ${this.battleWave}: a rebel host marches on Mudford from the south — rally your army!`, 'gold');
    this.game.audio?.play('night');
  }

  updateSoldiers(dt, p) {
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      if (s.dead) {
        s.deathT += dt;
        s.group.rotation.z = Math.min(Math.PI / 2, s.deathT * 4);
        if (s.deathT > 1.5) {
          if (s.group.parent) this.game.scene.remove(s.group);
          this.soldiers.splice(i, 1);
        }
        continue;
      }
      this.drawSoldierBar(s);
      // find nearest foe worth fighting
      let foe = null, fd = 18;
      for (const e of this.enemies) {
        if (e.dead || BIG_FOES.has(e.type)) continue;
        if (!e.aggroed && e.pos.distanceTo(p.pos) > 18) continue;
        const d = e.pos.distanceTo(s.pos);
        if (d < fd) { fd = d; foe = e; }
      }
      let moving = false;
      if (foe) {
        const dx = foe.pos.x - s.pos.x, dz = foe.pos.z - s.pos.z;
        const d = Math.hypot(dx, dz);
        s.group.rotation.y = Math.atan2(dx, dz);
        if (d > 1.6) {
          s.pos.x += (dx / d) * s.speed * dt;
          s.pos.z += (dz / d) * s.speed * dt;
          moving = true;
        }
        s.attackCd -= dt;
        if (d < 1.9 && s.attackCd <= 0) {
          s.attackCd = 1.1;
          s.attackAnim = 1;
          this.hitEnemy(foe, s.dmg, 'ally');
        }
      } else {
        // form up around the player
        const tx = p.pos.x + s.formation.ox, tz = p.pos.z + s.formation.oz;
        const dx = tx - s.pos.x, dz = tz - s.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 45) { s.pos.set(tx, p.pos.y, tz); }
        else if (d > 1.2) {
          s.pos.x += (dx / d) * s.speed * dt;
          s.pos.z += (dz / d) * s.speed * dt;
          s.group.rotation.y = Math.atan2(dx, dz);
          moving = true;
        }
        s.hp = Math.min(s.maxHp, s.hp + 1.5 * dt);
      }
      const gy = this.groundY(s.pos.x, s.pos.z, s.pos.y);
      s.pos.y += (gy - s.pos.y) * Math.min(1, dt * 12);
      s.attackAnim = Math.max(0, (s.attackAnim || 0) - dt * 3);
      this.walkAnim(s.group, moving, s.attackAnim);
      this.idleAnim(s.group, i);
    }
  }

  // ---------- world pickups ----------
  addItem(kind, x, z, extra = null, atY = null) {
    const weaponId = kind === 'weapon' ? extra : null;
    const relicId = kind === 'relic' ? extra : null;
    const group = new THREE.Group();
    let labelText, labelColor = '#a0ffb0';
    if (kind === 'bandage') {
      const b = box(0.3, 0.18, 0.3, 0xe8e4d8); b.position.y = 0.1;
      group.add(b);
      labelText = 'Bandage';
    } else if (kind === 'gold') {
      const b = box(0.28, 0.2, 0.28, 0xd8b030); b.position.y = 0.1;
      group.add(b);
      labelText = 'Gold Pouch';
      labelColor = '#ffd769';
    } else if (kind === 'treasure') {
      const chest = box(0.55, 0.34, 0.4, 0x6a4a24); chest.position.y = 0.17;
      const lid = box(0.55, 0.1, 0.4, 0x8a6534); lid.position.y = 0.4;
      const band = box(0.57, 0.08, 0.42, 0xd8b030); band.position.y = 0.26;
      group.add(chest, lid, band);
      labelText = 'Treasure Chest';
      labelColor = '#ffd769';
    } else if (kind === 'relic') {
      const gem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({ color: 0xb070f0 }));
      gem.position.y = 0.28;
      gem.rotation.y = 0.6;
      const base = box(0.44, 0.12, 0.44, 0x3a3040); base.position.y = 0.06;
      group.add(gem, base);
      labelText = RELICS[relicId] ? RELICS[relicId].name : 'Ancient Relic';
      labelColor = '#e0b0ff';
    } else if (kind === 'charm') {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshBasicMaterial({ color: 0xa0f0ff }));
      c.position.y = 0.22;
      c.rotation.y = 0.6;
      group.add(c);
      labelText = 'Unspell Charm';
      labelColor = '#a0f0ff';
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
    const y = atY != null ? this.game.world.standAt(Math.floor(x), Math.floor(z), atY) : this.groundY(x, z);
    group.position.set(x, y + 0.3, z);
    const label = makeLabel(labelText, labelColor);
    label.position.y = 1.0;
    group.add(label);
    this.game.scene.add(group);
    this.items.push({ kind, weaponId, relicId, group, pos: group.position, baseY: y + 0.3, bobSeed: Math.random() * 6 });
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
          this.game.save.markItemTaken((it.weaponId || it.relicId || it.kind) + '@' + Math.round(it.pos.x) + ',' + Math.round(it.pos.z));
        }
        this.game.audio?.play('pickup');
        if (it.kind === 'bandage') {
          p.bandages++;
          this.game.ui.toast('+1 Bandage — press Q to use (heals 30)', 'gold');
        } else if (it.kind === 'kit') {
          p.kits++;
          this.game.ui.toast("+1 Maester's Kit — press F to use (full heal)", 'gold');
        } else if (it.kind === 'gold') {
          p.gold += 30;
          this.game.audio?.play('coin');
          this.game.ui.toast('+30 gold', 'gold');
        } else if (it.kind === 'treasure') {
          p.gold += 120;
          this.game.audio?.play('coin');
          this.game.ui.toast('Treasure! +120 gold', 'gold');
        } else if (it.kind === 'relic') {
          const r = RELICS[it.relicId];
          if (r) {
            r.apply(p);
            p.relicsFound = (p.relicsFound || 0) + 1;
            this.game.audio?.play('fanfare');
            this.game.ui.toast(`RELIC FOUND: ${r.name} — ${r.desc} (${p.relicsFound}/${RELIC_COUNT})`, 'gold');
          }
        } else if (it.kind === 'charm') {
          p.charms = (p.charms || 0) + 1;
          this.game.ui.toast('+1 Unspell Charm — press E beside a thralled friend to free them', 'gold');
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

  // ---------- rogue dragons ----------
  // spawn the wild wyrms (once, from stage 14 on); tamed ones return as guardians
  spawnRogues() {
    for (const [id, def] of Object.entries(ROGUE_DRAGONS)) {
      const status = this.rogues[id];
      if (status === 'slain') continue;
      if (status === 'tamed') {
        if (!this.guardians.some(gd => gd.rogueId === id)) this.addGuardian(id);
        continue;
      }
      if (this.enemies.some(e => e.rogueId === id && !e.dead)) continue;
      const e = this.addEnemy('roguedragon', def.lair.x + 0.5, def.lair.z + 0.5);
      // repaint with the variant's colors
      this.game.scene.remove(e.group);
      const group = makeDragon(1.25, def.body, def.wings);
      group.position.copy(e.pos);
      const label = makeLabel(def.name + ' — meat tames, steel slays', '#b0e890');
      label.position.y = 4.5;
      group.add(label);
      this.game.scene.add(group);
      e.group = group;
      e.pos = group.position;
      e.rogueId = id;
      e.rogueName = def.name;
      e.neutral = true;
      e.lair = def.lair;
    }
  }

  tameRogue(e) {
    this.rogues[e.rogueId] = 'tamed';
    this.removeEnemy(e);
    this.addGuardian(e.rogueId);
    this.game.ui.toast(`${e.rogueName} bows its head — TRAINED! It will guard you from the sky.`, 'gold');
    this.game.audio?.play('roar');
    this.game.audio?.play('fanfare');
    this.game.saveNow?.();
  }

  addGuardian(rogueId) {
    const def = ROGUE_DRAGONS[rogueId];
    const p = this.game.player.pos;
    const group = makeDragon(1.15, def.body, def.wings);
    group.position.set(p.x + 6, p.y + 5, p.z + 6);
    const label = makeLabel(def.name + ' (guardian)', '#b0e890');
    label.position.y = 4.4;
    group.add(label);
    this.game.scene.add(group);
    this.guardians.push({ rogueId, name: def.name, group, pos: group.position, fireCd: 2, jawT: 0 });
  }

  updateGuardians(dt, p) {
    const playerBelow = this.isUnderground(p.pos);
    for (let i = 0; i < this.guardians.length; i++) {
      const gd = this.guardians[i];
      if (playerBelow) { this.flapWings(gd.group, 4 + i); this.dragonIdle(gd.group, 0); continue; }
      const ang = this.time * 0.4 + i * 2.4;
      const tx = p.pos.x + Math.cos(ang) * 9;
      const tz = p.pos.z + Math.sin(ang) * 9;
      const gy = this.groundY(tx, tz);
      const ty = gy + 5 + Math.sin(this.time * 1.3 + i) * 0.8;
      gd.pos.x += (tx - gd.pos.x) * Math.min(1, dt * 1.6);
      gd.pos.y += (ty - gd.pos.y) * Math.min(1, dt * 1.6);
      gd.pos.z += (tz - gd.pos.z) * Math.min(1, dt * 1.6);
      gd.group.rotation.y = Math.atan2(tx - gd.pos.x, tz - gd.pos.z) || gd.group.rotation.y;
      this.flapWings(gd.group, 5 + i);
      gd.jawT = Math.max(0, gd.jawT - dt * 2);
      this.dragonIdle(gd.group, gd.jawT);
      // rain fire on your enemies
      gd.fireCd -= dt;
      if (gd.fireCd <= 0) {
        for (const e of this.enemies) {
          if (e.dead || BIG_FOES.has(e.type) || e.neutral) continue;
          if (!e.aggroed) continue;
          if (e.pos.distanceTo(p.pos) > 24) continue;
          gd.fireCd = 2.5;
          gd.jawT = 1;
          const from = gd.pos.clone(); from.y += 1.5;
          const to = e.pos.clone(); to.y += 1;
          const vel = to.sub(from).normalize().multiplyScalar(16);
          this.shoot('fire', from, vel, 22, true);
          break;
        }
      }
    }
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
    if ((e.type === 'gate' || e.type === 'iceheart') && source !== 'fire') {
      if (this.hintCd <= 0) {
        this.game.ui.toast(e.type === 'gate'
          ? 'Ironwood bound in bronze — only dragonfire can burn it. Ride Vhagrik!'
          : 'The Ice Heart drinks your blows — only dragonfire can melt it!');
        this.hintCd = 3;
      }
      this.game.audio?.play('clink');
      e.aggroed = true;
      return true;
    }
    if ((e.type === 'walker' || e.type === 'nightking') && !anti) {
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
    if (e.type === 'roguedragon' && e.neutral) {
      e.neutral = false;
      this.game.ui.toast(`${e.rogueName || 'The rogue dragon'} shrieks — you\'ve made an enemy of it!`);
      this.game.audio?.play('roar');
    }
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
    // striking down a thrall frees your friend the hard way
    if (e.type === 'thrall') {
      this.freeThrallByDeath(e);
      return;
    }
    if (reward) {
      this.game.audio?.play('coin');
      const p = this.game.player;
      p.gold += Math.round(e.gold * (1 + (p.goldBonus || 0)));
      p.addXp(e.xp);
      if (e.type === 'boar') {
        p.meat++;
        this.game.ui.toast('+1 boar meat', 'gold');
      }
      if (e.type === 'bear') {
        p.meat += 2;
        this.game.ui.toast('+2 meat from the bear', 'gold');
      }
      this.game.ui.toast(`${ENEMY_DEFS[e.type].label} slain  ·  +${e.gold} gold  ·  +${e.xp} xp`, 'gold');
      this.game.quests.onKill(e.type);
      this.game.legends?.onKill(e.type);
      // loot drops
      if ((e.type === 'bandit' || e.type === 'raider') && Math.random() < 0.4) {
        this.addItem('bandage', e.pos.x, e.pos.z);
      }
      if (['boss', 'dragonboss', 'mountain', 'king', 'jon', 'daeneris', 'hound', 'jaime'].includes(e.type)) {
        this.addItem('kit', e.pos.x + 1, e.pos.z);
        this.addItem('bandage', e.pos.x - 1, e.pos.z);
      }
    }
    // treasure spills from the mighty
    if (['warlord', 'holdlord', 'giant', 'frostgiant', 'deepking'].includes(e.type)) {
      this.addItem('treasure', e.pos.x + 1, e.pos.z + 1, null, e.pos.y);
    }
    // mages carry the charms that undo their kind of magic
    if ((e.type === 'mage' || e.type === 'deepmage') && Math.random() < 0.65) {
      this.addItem('charm', e.pos.x, e.pos.z, null, e.pos.y);
    }
    if (e.type === 'roguedragon') {
      this.rogues[e.rogueId] = 'slain';
      this.addItem('treasure', e.pos.x + 1, e.pos.z);
      this.addItem('treasure', e.pos.x - 1, e.pos.z);
      this.game.ui.toast(`${e.rogueName || 'The rogue dragon'} falls from the sky!`, 'gold');
      this.game.saveNow?.();
    }
    // conquest: when a hold's last defender falls, the kingdom is yours
    if (e.kingdom) {
      const left = this.enemies.some(x => x.kingdom === e.kingdom && !x.dead);
      if (!left) {
        this.wars[e.kingdom] = false;
        this.game.onHoldConquered?.(e.kingdom);
      }
    }
    // rebel-host battle: pay out when the last of them falls
    if ((e.type === 'rebel' || e.type === 'warlord') && this.battleActive) {
      const anyLeft = this.enemies.some(x => (x.type === 'rebel' || x.type === 'warlord') && !x.dead);
      if (!anyLeft) {
        this.battleActive = false;
        const bounty = 200 + (this.battleWave - 1) * 150;
        this.game.player.gold += bounty;
        this.game.ui.toast(`The rebel host is broken! The field is yours — +${bounty} gold bounty.`, 'gold');
        this.game.audio?.play('fanfare');
        this.game.ui.updateHud();
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
    if (kind === 'arrow' || kind === 'earrow') {
      mesh = box(0.06, 0.06, 0.7, 0x8a6a3a);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(kind === 'fire' ? 0.32 : 0.4, 6, 6),
        new THREE.MeshBasicMaterial({ color: kind === 'ice' ? 0x66d8ff : (kind === 'spell' ? 0xb060f0 : (friendly ? 0xff7a20 : 0xff4a10)) })
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
      if (pr.kind === 'arrow' || pr.kind === 'earrow') pr.vel.y -= 12 * dt;
      pr.pos.x += pr.vel.x * dt;
      pr.pos.y += pr.vel.y * dt;
      pr.pos.z += pr.vel.z * dt;
      if (pr.kind === 'arrow' || pr.kind === 'earrow') mesh_lookAt(pr);
      let hit = pr.life <= 0 || world.isSolid(Math.floor(pr.pos.x), Math.floor(pr.pos.y), Math.floor(pr.pos.z));
      if (!hit && pr.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const r = (e.type === 'dragonboss' || e.type === 'undeaddragon' || e.type === 'roguedragon' || e.type === 'gate' || e.type === 'iceheart') ? 3.0 : ((e.type === 'mountain' || e.type === 'giant') ? 2.0 : 1.3);
          const cy = (e.type === 'dragonboss' || e.type === 'undeaddragon' || e.type === 'roguedragon') ? 1.5 : 0.9;
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
        if (!hit) {
          for (const s of this.soldiers) {
            if (s.dead) continue;
            const sx = s.pos.x - pr.pos.x, sy = (s.pos.y + 1) - pr.pos.y, sz = s.pos.z - pr.pos.z;
            if (sx * sx + sy * sy + sz * sz < 2.5) { this.damageSoldier(s, pr.dmg); hit = true; break; }
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

  damageAlly(a, n, attacker = null) {
    if (a.downed) return;
    a.hp -= n;
    if (a.hp <= 0) {
      a.hp = 0;
      // the cold ones don't kill your friends — they TAKE them
      if (attacker && (attacker.type === 'walker' || attacker.type === 'nightking')) {
        this.thrallAlly(a);
        return;
      }
      a.downed = true;
      a.reviveT = 18;
      a.group.rotation.z = 1.3;
      this.game.ui.toast(`${ALLY_DEFS[a.id].label} is down — they will recover soon.`);
    }
  }

  // ---------- thralldom ----------
  thrallAlly(a) {
    const idx = this.allies.indexOf(a);
    if (idx >= 0) this.allies.splice(idx, 1);
    a.bar.spr.visible = false;
    a.group.rotation.z = 0;
    addIceShards(a.group, 3);
    const tl = makeLabel('THRALL — an Unspell Charm frees them [E]', '#8af0ff');
    tl.position.y = 2.8;
    a.group.add(tl);
    this.enemies.push({
      type: 'thrall', group: a.group, pos: a.group.position,
      hp: Math.round(a.maxHp * 0.9), maxHp: Math.round(a.maxHp * 0.9),
      dmg: a.dmg, speed: 3.2, aggro: 16, leash: 60, gold: 0, xp: 0, undead: true,
      spawnPos: a.group.position.clone(),
      attackCd: 1.5, hitFlash: 0, dead: false, deathT: 0, aggroed: true, assault: true,
      isNight: false, circleT: 0, fireCd: 0, fireRange: 0, boltKind: 'efire', boltDmg: 0, summonCd: 8,
      allyId: a.id, allyName: a.name,
    });
    this.game.ui.toast(`${a.name} has been TURNED — their eyes burn blue! Free them with an Unspell Charm (E).`);
    this.game.audio?.play('walker', 0);
  }

  cureThrall(e) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.game.scene.remove(e.group);
    this.addAlly(e.allyId);
    const a = this.allies.find(x => x.id === e.allyId);
    if (a) {
      a.hp = Math.round(a.maxHp * 0.5);
      a.pos.copy(e.pos);
    }
    this.game.ui.toast(`The charm burns the ice away — ${e.allyName} is FREED!`, 'gold');
    this.game.audio?.play('heal');
    this.game.audio?.play('fanfare');
  }

  freeThrallByDeath(e) {
    // struck down, the ice releases them — they wake wounded
    this.addAlly(e.allyId);
    const a = this.allies.find(x => x.id === e.allyId);
    if (a) {
      a.pos.set(e.pos.x + 1, e.pos.y, e.pos.z + 1);
      a.hp = 1;
      a.downed = true;
      a.reviveT = 20;
      a.group.rotation.z = 1.3;
    }
    this.game.ui.toast(`${e.allyName} collapses free of the ice — badly hurt, but themselves again.`);
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
    // after the dawn, the nights are gentle; during the Long Night, they are not
    const wantWights = stage >= 33 ? 2 : (stage >= 27 ? 12 : (stage >= 19 ? 9 : (stage >= 9 ? 7 : 4)));
    const wantWalkers = stage >= 33 ? 0 : (stage >= 27 ? 4 : ((stage === 15 || stage >= 19) ? 3 : (stage >= 9 ? 2 : 1)));
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
        if (Math.hypot(x - 20, z - 76) < 18) continue;   // and the holds
        if (Math.hypot(x - 95, z - 170) < 18) continue;
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

    // targets an enemy may choose from: player + standing allies + hired soldiers
    const targets = [{ pos: p.pos, hit: (n) => p.damage(n), isPlayer: true }];
    for (const a of this.allies) {
      if (!a.downed) targets.push({ pos: a.pos, hit: (n, atk) => this.damageAlly(a, n, atk) });
    }
    for (const s of this.soldiers) {
      if (!s.dead) targets.push({ pos: s.pos, hit: (n) => this.damageSoldier(s, n) });
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

      if (e.type === 'dragonboss' || e.type === 'undeaddragon' || e.type === 'roguedragon') {
        this.updateDragonBoss(e, dt, p);
        if (e.pos.distanceTo(p.pos) < 55 && !e.neutral) {
          bossFrac = e.hp / e.maxHp;
          bossName = e.type === 'dragonboss' ? 'THE WILD DRAGON' :
            (e.type === 'undeaddragon' ? 'THE UNDEAD DRAGON' : (e.rogueName || 'ROGUE DRAGON').toUpperCase());
        }
        continue;
      }
      if (e.type === 'gate' || e.type === 'iceheart') {
        if (e.aggroed && e.pos.distanceTo(p.pos) < 45) {
          bossFrac = e.hp / e.maxHp;
          bossName = e.type === 'gate' ? 'THE GATES OF KINGSPORT' : 'ICE HEART';
        }
        continue;
      }
      // summoner bosses raise reinforcements as they fight
      if ((e.type === 'nightking' || e.type === 'deepking') && e.aggroed) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
          e.summonCd = 8;
          const minionType = e.type === 'nightking' ? 'wight' : 'deepguard';
          const up = this.enemies.filter(x => x.type === minionType && !x.dead).length;
          if (up < (e.type === 'nightking' ? 8 : 5)) {
            const a = Math.random() * Math.PI * 2;
            const w = this.addEnemy(minionType, e.pos.x + Math.cos(a) * 3, e.pos.z + Math.sin(a) * 3, false, e.pos.y);
            w.aggroed = true;
            w.assault = true;
            this.game.audio?.play('walker', 1500);
          }
        }
      }

      // pick nearest target
      let tgt = null, td = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
        if (d < td) { td = d; tgt = t; }
      }
      const chasing = !p.dead && tgt && (e.aggroed || td < e.aggro);
      if (chasing && td > e.leash) e.aggroed = false;

      // undead don't press into the keep's walls — unless they march with the Long Night
      const nearKeep = e.undead && !e.assault && Math.hypot(e.pos.x - KEEP.x, e.pos.z - KEEP.z) < 20;

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
          tgt.hit(e.dmg, e);
        }
        // some legends hurl fire from range
        if (e.fireRange) {
          e.fireCd -= dt;
          if (td > 3 && td < e.fireRange && e.fireCd <= 0) {
            e.fireCd = 3;
            const from = e.pos.clone(); from.y += 1.4;
            const to = p.pos.clone(); to.y += 1.2;
            const vel = to.sub(from).normalize().multiplyScalar(14);
            this.shoot(e.boltKind, from, vel, e.boltDmg, false);
            this.game.audio?.play('fire');
          }
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

      const gy = this.groundY(e.pos.x, e.pos.z, e.pos.y);
      e.pos.y += (gy - e.pos.y) * Math.min(1, dt * 12);
      e.attackAnim = Math.max(0, (e.attackAnim || 0) - dt * 3);
      this.walkAnim(e.group, moving, e.attackAnim);
      this.idleAnim(e.group, e.spawnPos.x);
    }

    if (bossFrac !== null) this.game.ui.showBossBar(bossFrac, bossName);
    else this.game.ui.hideBossBar();

    this.updateAllies(dt, p);
    this.updateSoldiers(dt, p);
    this.updateGuardians(dt, p);
    this.updateDragonCompanion(dt, p);
    this.updateHorse(dt);
  }

  updateDragonBoss(e, dt, p) {
    const lair = e.lair || { x: 34, z: 150 };
    const dp = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);

    // a neutral rogue wyrm lands when you come close — curious, watchful, tameable
    if (e.neutral && dp < 14 && !p.dead) {
      const gy = this.groundY(e.pos.x, e.pos.z, e.pos.y);
      e.pos.y += (gy + 0.4 - e.pos.y) * Math.min(1, dt * 2.5);
      // shuffle toward you, stopping short
      if (dp > 8) {
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
        e.pos.x += (dx / dp) * 2 * dt;
        e.pos.z += (dz / dp) * 2 * dt;
      }
      e.group.rotation.y = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      e.jawT = Math.max(0, (e.jawT || 0) - dt * 2);
      this.dragonIdle(e.group, e.jawT);
      this.flapWings(e.group, 1.5);
      return;
    }

    e.circleT += dt * 0.35;
    const gy = this.groundY(lair.x, lair.z);
    const tx = lair.x + Math.cos(e.circleT) * 20;
    const tz = lair.z + Math.sin(e.circleT) * 20;
    const ty = gy + 13 + Math.sin(this.time * 0.7) * 2.5;
    e.pos.x += (tx - e.pos.x) * Math.min(1, dt * 2);
    e.pos.y += (ty - e.pos.y) * Math.min(1, dt * 2);
    e.pos.z += (tz - e.pos.z) * Math.min(1, dt * 2);
    e.group.rotation.y = Math.atan2(tx - e.pos.x, tz - e.pos.z) || e.group.rotation.y;
    this.flapWings(e.group, 7);
    e.jawT = Math.max(0, (e.jawT || 0) - dt * 2);
    this.dragonIdle(e.group, e.jawT);
    if (e.neutral) return; // wild but unprovoked: no fire
    // breathe fire (or ice) at the player
    e.fireCd -= dt;
    const d = e.pos.distanceTo(p.pos);
    if (!p.dead && d < 48 && e.fireCd <= 0) {
      e.fireCd = e.type === 'undeaddragon' ? 2.2 : 2.5;
      e.jawT = 1;
      const from = e.pos.clone(); from.y += 1.5;
      const to = p.pos.clone(); to.y += 1.2;
      const vel = to.sub(from).normalize().multiplyScalar(15);
      this.shoot(e.type === 'undeaddragon' ? 'ice' : 'efire', from, vel, e.type === 'undeaddragon' ? e.boltDmg : 20, false);
    }
  }

  updateAllies(dt, p) {
    for (const a of this.allies) {
      this.drawAllyBar(a);
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
      // choose a foe: nearest living enemy near the party
      // (only fire-wielding allies can fight White Walkers)
      const aDef = ALLY_DEFS[a.id] || {};
      let foe = null, fd = 14;
      for (const e of this.enemies) {
        if (e.dead || e.type === 'dragonboss' || e.type === 'gate' || e.type === 'roguedragon' || e.type === 'undeaddragon') continue;
        if (e.type === 'walker' && aDef.source !== 'fire') continue;
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
          this.hitEnemy(foe, a.dmg, aDef.source || 'ally');
        }
      } else {
        // out of combat: slow recovery
        a.hp = Math.min(a.maxHp, a.hp + 2 * dt);
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
      const gy = this.groundY(a.pos.x, a.pos.z, a.pos.y);
      a.pos.y += (gy - a.pos.y) * Math.min(1, dt * 12);
      a.attackAnim = Math.max(0, (a.attackAnim || 0) - dt * 3);
      this.walkAnim(a.group, moving, a.attackAnim);
      this.idleAnim(a.group, a.id.length);
    }
  }

  updateDragonCompanion(dt, p) {
    const d = this.dragon;
    if (!d || d.mounted) return;
    // dragons are too big for the deep — they wait above
    if (this.isUnderground(p.pos)) {
      this.flapWings(d.group, 3);
      this.dragonIdle(d.group, 0);
      return;
    }
    const grown = d.state === 'grown';
    const dx = p.pos.x - d.pos.x, dz = p.pos.z - d.pos.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (dist > 60) d.pos.set(p.pos.x + 3, p.pos.y, p.pos.z + 3);
    else if (dist > (grown ? 4.5 : 4)) {
      const sp = grown ? 9 : 4.5;
      d.pos.x += (dx / dist) * sp * dt;
      d.pos.z += (dz / dist) * sp * dt;
      d.group.rotation.y = Math.atan2(dx, dz);
      moving = true;
    }
    const gy = this.groundY(d.pos.x, d.pos.z);
    // a grown dragon lands beside you so you can mount; flies when you're away
    const targetY = grown
      ? (dist < 9 ? gy + 0.4 : gy + 4 + Math.sin(this.time * 1.4) * 0.6)
      : gy;
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
