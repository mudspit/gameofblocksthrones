import * as THREE from 'three';
import { World, LOG, AIR, PLANK, TORCH, W, D } from './world.js';
import { GameAudio } from './audio.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Quests } from './quests.js';
import { UI } from './ui.js';
import { SaveSystem } from './save.js';
import { initTouch } from './touch.js';

const DAY_LENGTH = 300; // seconds per full day/night cycle

const game = {};
game.audio = new GameAudio();

// The great houses a new account may swear to — banner color + sigil.
const HOUSES = [
  { id: 'direwolf', sigil: '🐺', name: 'House of the Direwolf', hex: '#9aa5b0', rgb: [0.60, 0.65, 0.69] },
  { id: 'dragon',   sigil: '🐉', name: 'House of the Dragon',   hex: '#a82424', rgb: [0.66, 0.14, 0.14] },
  { id: 'lion',     sigil: '🦁', name: 'House of the Lion',     hex: '#d4af37', rgb: [0.83, 0.69, 0.22] },
  { id: 'rose',     sigil: '🌹', name: 'House of the Rose',     hex: '#3a8a3a', rgb: [0.23, 0.54, 0.23] },
  { id: 'falcon',   sigil: '🦅', name: 'House of the Falcon',   hex: '#4a7ab8', rgb: [0.29, 0.48, 0.72] },
  { id: 'kraken',   sigil: '🦑', name: 'House of the Kraken',   hex: '#2a7a7a', rgb: [0.16, 0.48, 0.48] },
];
let chosenHouse = HOUSES[1]; // dragon red by default

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 320);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x6b5a3a, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.0);
scene.add(sun);

const SKY_DAY = new THREE.Color(0x87b5d8);
const SKY_NIGHT = new THREE.Color(0x0b1026);
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(scene.background, 60, 180);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- world ----------
game.scene = scene;
game.camera = camera;
const world = new World(scene);
world.generate();
world.buildAllMeshes();
game.world = world;

// ---------- player ----------
const spawnY = world.surfaceHeight(52, 105);
const player = new Player(game, new THREE.Vector3(52.5, spawnY, 105.5));
player.yaw = 0; // face north toward the keep hall
game.player = player;

// ---------- weapon viewmodels ----------
const holder = new THREE.Group();
holder.position.set(0.34, -0.28, -0.45);
holder.rotation.set(0.35, -0.3, 0);
holder.scale.setScalar(0.65);
camera.add(holder);

const bladeMat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
function buildSword() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), bladeMat);
  blade.position.z = -0.35;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), new THREE.MeshLambertMaterial({ color: 0x6b5a35 }));
  guard.position.z = -0.08;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.14), new THREE.MeshLambertMaterial({ color: 0x3a2c18 }));
  grip.position.z = 0.02;
  g.add(blade, guard, grip);
  return g;
}
function buildBow() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), wood);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), wood);
  top.position.set(0, 0.26, -0.08); top.rotation.x = -0.5;
  const bot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), wood);
  bot.position.set(0, -0.26, -0.08); bot.rotation.x = 0.5;
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.72, 0.012), new THREE.MeshLambertMaterial({ color: 0xd8d0b8 }));
  string.position.z = -0.14;
  g.add(mid, top, bot, string);
  g.rotation.y = 0.5;
  return g;
}
function buildDagger() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.34), new THREE.MeshLambertMaterial({ color: 0x14141c }));
  blade.position.z = -0.22;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: 0x3a2c18 }));
  grip.position.z = 0.02;
  g.add(blade, grip);
  return g;
}
function buildHammer() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: 0x5a4028 }));
  shaft.position.z = -0.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0x777780 }));
  head.position.z = -0.52;
  g.add(shaft, head);
  return g;
}
function buildCrossbow() {
  const g = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x5a4028 }));
  stock.position.z = -0.2;
  const bowarm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }));
  bowarm.position.z = -0.42;
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.012, 0.012), new THREE.MeshLambertMaterial({ color: 0xd8d0b8 }));
  string.position.z = -0.34;
  g.add(stock, bowarm, string);
  return g;
}

const swordVM = buildSword(), bowVM = buildBow(), daggerVM = buildDagger(),
      hammerVM = buildHammer(), crossbowVM = buildCrossbow();
holder.add(swordVM, bowVM, daggerVM, hammerVM, crossbowVM);

const WEAPONS = {
  sword:    { label: () => player.hasValyrian ? 'Winterbite (Valyrian)' : 'Sword', cd: 0.38, range: 3.4, melee: true, vm: swordVM,
              source: () => player.hasValyrian ? 'valyrian' : 'sword', dmg: () => player.dmg },
  bow:      { label: () => 'Hunting Bow', cd: 0.9, ranged: true, speed: 34, vm: bowVM, dmg: () => 12 + player.level * 2 },
  dagger:   { label: () => 'Dragonglass Dagger', cd: 0.3, range: 2.8, melee: true, vm: daggerVM,
              source: () => 'dagger', dmg: () => 18 },
  hammer:   { label: () => "Rorge's Warhammer", cd: 0.85, range: 3.4, melee: true, vm: hammerVM,
              source: () => 'sword', dmg: () => Math.round(player.dmg * 1.8) },
  crossbow: { label: () => 'Myrish Crossbow', cd: 1.3, ranged: true, speed: 50, vm: crossbowVM, dmg: () => 24 + player.level * 2 },
};
const WEAPON_ORDER = ['sword', 'bow', 'dagger', 'hammer', 'crossbow'];

function refreshWeaponVM() {
  const cur = player.weapon();
  for (const id of WEAPON_ORDER) {
    WEAPONS[id].vm.visible = cur === id && player.mount !== 'dragon';
  }
}
function switchWeapon(i) {
  if (i >= player.weapons.length) { ui.toast('You don\'t have that weapon yet — explore to find more.'); return; }
  player.weaponIdx = i;
  refreshWeaponVM();
  ui.toast(WEAPONS[player.weapon()].label());
  ui.updateHud();
}
game.getWeaponLabel = () => WEAPONS[player.weapon()].label();

// Grant a weapon, keeping the hotbar in canonical 1-5 order.
game.grantWeapon = (id) => {
  if (player.weapons.includes(id)) return;
  const cur = player.weapon();
  player.weapons = WEAPON_ORDER.filter(w => player.weapons.includes(w) || w === id);
  player.weaponIdx = Math.max(0, player.weapons.indexOf(cur));
  const slot = player.weapons.indexOf(id) + 1;
  ui.toast(`${WEAPONS[id].label()} acquired! Press ${slot} to wield it.`, 'gold');
  ui.updateHud();
};

game.upgradeSword = (valyrian = false) => {
  bladeMat.color.setHex(valyrian ? 0x4a5570 : 0xd8e2ec);
};
refreshWeaponVM();

// ---------- block highlight ----------
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- mission beacon (golden pillar over the current objective) ----------
const beacon = new THREE.Group();
const beaconGem = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.5),
  new THREE.MeshBasicMaterial({ color: 0xffd54a })
);
const beaconBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.14, 0.14, 26, 6, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
);
beaconBeam.position.y = 13;
beacon.add(beaconGem, beaconBeam);
scene.add(beacon);

function updateBeacon(t) {
  const loc = game.quests.objectiveLocation();
  if (!loc) { beacon.visible = false; return; }
  beacon.visible = true;
  const gy = world.surfaceHeight(Math.floor(loc.x), Math.floor(loc.z));
  beacon.position.set(loc.x, gy, loc.z);
  beaconGem.position.y = 3.8 + Math.sin(t * 2.5) * 0.3;
  beaconGem.rotation.y = t * 1.5;
}

// ---------- systems ----------
const ui = new UI(game);
game.ui = ui;
const quests = new Quests(game);
game.quests = quests;
const entities = new Entities(game);
game.entities = entities;

// NPCs
entities.addNpc('rodrik', 'Steward Rodrik', 52.5, 101.5, { shirt: 0x2c4a6e, pants: 0x3a3a3a, skin: 0xd8b090,
  face: { beard: '#b8b8b0', old: true } });
entities.addNpc('tobbo', 'Smith Tobbo', 58.5, 104.5, { shirt: 0x5a3a24, pants: 0x2a2a2a, skin: 0xc99b71,
  face: { beard: '#4a2a10', hair: '#4a2a10', brows: true } });
entities.addNpc('marta', 'Elder Marta', 140.5, 99.5, { shirt: 0x5e5040, pants: 0x4a4038, skin: 0xd8b090,
  face: { female: true, hair: '#c8c8c4', old: true } });
entities.addNpc('guard1', 'Keep Guard', 49.5, 110.5, { shirt: 0x555c66, pants: 0x2f2f2f, skin: 0xc9a07a,
  face: { hair: '#2a2a2a', brows: true } });
entities.addNpc('guard2', 'Keep Guard', 55.5, 110.5, { shirt: 0x555c66, pants: 0x2f2f2f, skin: 0xb58a63,
  face: { hair: '#1a1a1a', beard: '#1a1a1a' } });
entities.addNpc('vill1', 'Villager Wyl', 137.5, 93.5, { shirt: 0x6e5a3a, pants: 0x4a4038, skin: 0xd8b090,
  face: { hair: '#5a3a1a' } });
entities.addNpc('vill2', 'Villager Senna', 143.5, 96.5, { shirt: 0x4a5a3a, pants: 0x4a4038, skin: 0xc99b71,
  face: { female: true, hair: '#8a5a20' } });

// Enemies: wolves in the northern woods
const wolfSpots = [[62, 38], [78, 30], [95, 44], [110, 34], [70, 52], [124, 46], [88, 24], [104, 55]];
for (const [x, z] of wolfSpots) entities.addEnemy('wolf', x + 0.5, z + 0.5);
// Bandit camp
const banditSpots = [[145, 152], [155, 152], [145, 160], [155, 160], [150, 149]];
for (const [x, z] of banditSpots) entities.addEnemy('bandit', x + 0.5, z + 0.5);
entities.addEnemy('boss', 150.5, 156.5);

// Old Thunder waits in the courtyard from day one
entities.spawnHorse(59.5, 99.5);

// Loot scattered across the realm — heal supplies and hidden weapons
entities.addItem('bandage', 52.5, 95.5);    // inside the keep hall
entities.addItem('bandage', 141.5, 93.5);   // by the village well
entities.addItem('bandage', 90.5, 45.5);    // northern woods
entities.addItem('bandage', 100.5, 150.5);  // southern fields
entities.addItem('bandage', 147.5, 150.5);  // bandit camp edge
entities.addItem('kit', 55.5, 95.5);        // keep hall
entities.addItem('kit', 30.5, 28.5);        // by the Frozen Cairn hills
entities.addItem('kit', 38.5, 146.5);       // near the dragon lair
entities.addItem('weapon', 152.5, 158.5, 'hammer');   // deep in the bandit camp
entities.addItem('weapon', 134.5, 90.5, 'crossbow');  // hidden inside a village hut

// Stage-driven world changes (props, raids, hunts, the wild dragon)
game.onStageChanged = (s) => {
  if (s === 9) entities.addProp('chest', 'Strange Chest', 150.5, 153.5, 0x7a5a2a);
  if (s === 10) entities.addProp('forgefire', 'Forge Fire', 59.5, 104.5, 0xd86a2a);
  if (s === 11) entities.addNpc('bryn', 'Ser Bryn', 137.5, 97.5, { shirt: 0x7a2a2a, pants: 0x3a3a3a, skin: 0xd8b090,
    face: { beard: '#6a4028', hair: '#6a4028' } });
  if (s === 12) {
    const spots = [[48, 116], [52, 118], [56, 116], [50, 121], [54, 121], [52, 124]];
    for (const [x, z] of spots) entities.addEnemy('raider', x + 0.5, z + 0.5);
  }
  if (s === 13) {
    const spots = [[75, 148], [85, 156], [95, 146]];
    for (const [x, z] of spots) entities.addEnemy('boar', x + 0.5, z + 0.5);
  }
  if (s === 14) entities.addProp('cairn', 'Frozen Cairn', 28.5, 26.5, 0x9aa5ad);
  if (s === 16) entities.addEnemy('dragonboss', 34.5, 150.5);
  // --- Act III ---
  if (s === 20) {
    for (const [x, z] of [[118, 58], [122, 58], [118, 62], [122, 62]]) {
      entities.addEnemy('royal', x + 0.5, z + 0.5);
    }
  }
  if (s === 21) entities.addEnemy('gate', 170.5, 49.5);
  if (s === 22) {
    for (const [x, z] of [[170, 44], [168, 40], [172, 40], [164, 34], [176, 34], [162, 30], [178, 30], [170, 32]]) {
      entities.addEnemy('royal', x + 0.5, z + 0.5);
    }
  }
  if (s === 23) entities.addEnemy('mountain', 170.5, 33.5);
  if (s === 24) entities.addNpc('joffron', 'King Joffron', 172.5, 19.5, { shirt: 0x6a2a6a, pants: 0xc9a227, skin: 0xe8c8a0,
    face: { hair: '#e8d070' } });
  if (s === 25) entities.addProp('ironthrone', 'The Iron Throne', 172.5, 18.5, 0x8a8a92);
};

game.onActThreeComplete = () => {
  document.exitPointerLock();
  game.audio.play('fanfare');
  ui.showVictory({ level: player.level, gold: player.gold }, () => { game.tryLock(); }, {
    title: 'SOVEREIGN OF THE BLOCKS',
    text: `The Iron Throne is yours. From Mudford Keep to Kingsport, the Seven Block-Kingdoms kneel — ` +
          `Level ${player.level}, ${player.gold} gold in the royal treasury. ` +
          `But the nights grow longer, and the dead grow bolder. Act IV: The Long Night is coming.`
  });
};

game.onActTwoComplete = () => {
  document.exitPointerLock();
  game.audio.play('fanfare');
  ui.showVictory({ level: player.level, gold: player.gold }, () => { game.tryLock(); }, {
    title: 'DRAGONLORD OF MUDFORD',
    text: `The Wild Dragon is slain, Winterbite hangs at your hip, and Vhagrik rules your sky. ` +
          `Level ${player.level} · ${player.gold} gold. Act II is complete — in Act III, you march on the capital.`
  });
};

ui.buildMap();

// ---------- game flow ----------
let started = false;
let locked = false;
let elapsed = DAY_LENGTH * 0.22; // start mid-morning

game.onPlayerDeath = () => {
  if (player.mount) game.dismount();
  document.exitPointerLock();
  ui.showDeath(() => {
    player.respawn();
    ui.updateHud();
    saveSys.save();
  });
};

game.onActComplete = () => {
  world.raiseBanner();
  document.exitPointerLock();
  ui.showVictory({ level: player.level, gold: player.gold }, () => {
    game.tryLock();
  });
};

// ---------- input ----------
// Pointer lock with graceful fallback: some environments (embedded previews,
// iframes) deny pointer lock — in that case we run with free-mouse look.
let usingFallback = false;
let lockEverWorked = false;
function enableFallback() {
  if (usingFallback) return;
  usingFallback = true;
  ui.setPaused(false);
  if (game.isTouch) ui.toast('Touch controls: left thumb moves, right thumb looks.');
  else ui.toast('Pointer lock unavailable — free-mouse mode: just move the mouse to look.');
}
function lockFailed() {
  if (locked || usingFallback) return;
  // If pointer lock has never worked here, this environment doesn't support it.
  if (!lockEverWorked) { enableFallback(); return; }
  // It worked before — this is the browser's short cooldown after Escape.
  // Stay paused; the player's next click is the gesture that relocks.
  ui.setPaused(true);
  const msg = document.getElementById('pauseMsg');
  if (msg) msg.textContent = '— PAUSED — click Resume —';
}
function tryLock() {
  if (usingFallback) return;
  if (game.isTouch) { enableFallback(); return; }
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => lockFailed());
    setTimeout(() => {
      if (started && !locked && !usingFallback && !ui.anyPanelOpen()) lockFailed();
    }, 700);
  } catch {
    lockFailed();
  }
}
game.tryLock = tryLock;

// ---------- map & mission panels ----------
function maybeRelock() {
  if (!usingFallback && !ui.anyPanelOpen() &&
      document.getElementById('victory').style.display !== 'flex' &&
      !player.dead) tryLock();
}
function openMap() {
  if (!started || player.dead) return;
  if (ui.missionOpen) ui.hideMission();
  if (locked) document.exitPointerLock();
  ui.setPaused(false);
  ui.showMap();
}
function closeMap() { ui.hideMap(); maybeRelock(); }
function toggleMap() { ui.mapOpen ? closeMap() : openMap(); }
function openMission() {
  if (!started || player.dead) return;
  if (ui.mapOpen) ui.hideMap();
  if (locked) document.exitPointerLock();
  ui.setPaused(false);
  ui.showMission(quests.missionInfo());
}
function closeMission() { ui.hideMission(); maybeRelock(); }
game.openMission = openMission;

ui.el.mapBtn.addEventListener('click', toggleMap);
document.getElementById('muteBtn').addEventListener('click', () => {
  game.audio.init();
  const on = game.audio.toggle();
  document.getElementById('muteBtn').textContent = on ? '🔊' : '🔇';
  if (on) game.audio.play('ui');
});
document.getElementById('muteBtn').textContent = game.audio.enabled ? '🔊' : '🔇';
ui.el.mapClose.addEventListener('click', closeMap);
ui.el.mapObjective.addEventListener('click', openMission);
ui.el.tracker.addEventListener('click', openMission);
ui.el.missionClose.addEventListener('click', closeMission);
ui.el.missionMap.addEventListener('click', () => { ui.hideMission(); openMap(); });

// ---------- accounts & saves ----------
const saveSys = new SaveSystem(game);
game.save = saveSys;
game.saveNow = () => saveSys.save();

const accountName = document.getElementById('accountName');
const profileList = document.getElementById('profileList');
const beginBtn = document.getElementById('beginBtn');

// house picker on the title screen
const houseRow = document.getElementById('houseRow');
function renderHouseRow() {
  houseRow.innerHTML = '';
  for (const h of HOUSES) {
    const chip = document.createElement('span');
    chip.className = 'house-chip' + (chosenHouse.id === h.id ? ' selected' : '');
    chip.innerHTML = `<span class="swatch" style="background:${h.hex}"></span>${h.sigil}`;
    chip.title = h.name;
    chip.onclick = () => {
      chosenHouse = h;
      game.audio.play('ui');
      renderHouseRow();
      document.getElementById('houseHint').textContent = h.name;
    };
    houseRow.appendChild(chip);
  }
  document.getElementById('houseHint').textContent = chosenHouse.name;
}

function refreshAccountUI() {
  accountName.value = accountName.value || saveSys.lastProfile();
  profileList.innerHTML = '';
  const all = saveSys.profiles();
  for (const name of Object.keys(all)) {
    const chip = document.createElement('span');
    chip.className = 'profile-chip';
    const hasSave = !!all[name].save;
    chip.textContent = hasSave ? `${name} · ${['Hedge Knight','Knight','Lord','Dragonlord','Sovereign'][all[name].save.stage >= 26 ? 4 : all[name].save.stage >= 17 ? 3 : all[name].save.stage >= 8 ? 2 : all[name].save.stage >= 2 ? 1 : 0]}` : name;
    chip.title = hasSave ? 'Continue this game' : 'New game';
    chip.onclick = () => {
      accountName.value = name;
      const savedHouse = HOUSES.find(h => h.id === all[name].house);
      if (savedHouse) { chosenHouse = savedHouse; renderHouseRow(); }
      updateBeginLabel();
    };
    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Delete this account';
    del.onclick = (ev) => {
      ev.stopPropagation();
      if (confirm(`Delete account "${name}" and its saved game?`)) {
        saveSys.deleteProfile(name);
        refreshAccountUI();
      }
    };
    chip.appendChild(del);
    profileList.appendChild(chip);
  }
  updateBeginLabel();
}
function updateBeginLabel() {
  if (beginBtn.disabled) return;
  const all = saveSys.profiles();
  const n = accountName.value.trim();
  beginBtn.textContent = (n && all[n] && all[n].save) ? `CONTINUE, ${n.toUpperCase()}` : 'TAKE UP YOUR SWORD';
}
accountName.addEventListener('input', updateBeginLabel);
renderHouseRow();
refreshAccountUI();

beginBtn.addEventListener('click', () => {
  game.audio.init();
  const name = accountName.value.trim() || 'Knight of Mudford';
  saveSys.createOrSelect(name);
  saveSys.setHouse(chosenHouse.id);
  started = true;
  ui.showGameUI();
  if (game.isTouch && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  if (saveSys.hasSave()) {
    if (saveSys.load()) ui.toast(`Welcome back, ${name}. Your watch continues.`, 'gold');
  } else {
    saveSys.save(); // first save right away
    ui.toast(`Account created — ${name} of the ${chosenHouse.name}.`, 'gold');
  }
  // fly the house colors on every banner in the realm
  world.setBannerColor(chosenHouse.rgb);
  const hn = document.getElementById('houseName');
  if (hn) hn.innerHTML = `<span class="swatch" style="background:${chosenHouse.hex}"></span>${chosenHouse.sigil} ${chosenHouse.name}`;
  game.audio.play('fanfare');
  refreshWeaponVM();
  tryLock();
});
// World is generated and everything is wired — arm the button.
beginBtn.disabled = false;
beginBtn.style.opacity = '1';
beginBtn.style.cursor = 'pointer';
beginBtn.textContent = 'TAKE UP YOUR SWORD';
updateBeginLabel();
window.__gameReady = true;
if (window.__applyTitleArt) window.__applyTitleArt(true);

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    lockEverWorked = true;
    const msg = document.getElementById('pauseMsg');
    if (msg) msg.textContent = '— PAUSED —';
  }
  if (started && !usingFallback) ui.setPaused(!locked && !ui.anyPanelOpen() &&
    document.getElementById('victory').style.display !== 'flex' &&
    document.getElementById('deathScreen').style.display !== 'flex');
});

renderer.domElement.addEventListener('click', () => {
  if (started && !locked && !usingFallback && !ui.anyPanelOpen()) tryLock();
});

// ---------- pause menu (Escape / ⏸ button): resume or save & exit ----------
function openMenu() {
  if (!started || player.dead) return;
  if (ui.anyPanelOpen() && !ui.menuOpen) return;
  if (locked) { document.exitPointerLock(); return; } // pointerlockchange shows the menu
  ui.setPaused(true);
}
function closeMenu() {
  ui.setPaused(false);
  if (!usingFallback && !ui.anyPanelOpen() &&
      document.getElementById('victory').style.display !== 'flex' && !player.dead) {
    tryLock();
  }
}
document.getElementById('menuBtn').addEventListener('click', () => {
  game.audio.play('ui');
  ui.menuOpen ? closeMenu() : openMenu();
});
document.getElementById('resumeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  closeMenu();
});
document.getElementById('saveExitBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  saveSys.save();
  window.location.reload(); // back to the title screen, where CONTINUE resumes this game
});
// clicking the dimmed background also resumes
document.getElementById('pauseHint').addEventListener('click', (e) => {
  if (e.target.closest('#pauseMenu')) return;
  if (started && ui.menuOpen) closeMenu();
});

document.addEventListener('mousemove', (e) => {
  if (!started || ui.anyPanelOpen()) return;
  if (!locked && !usingFallback) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
});

document.addEventListener('keydown', (e) => {
  player.keys[e.code] = true;
  if (e.code === 'KeyE' && (locked || usingFallback) && !ui.anyPanelOpen()) tryInteract();
  if (started && !ui.anyPanelOpen()) {
    if (e.code === 'Digit1') switchWeapon(0);
    if (e.code === 'Digit2') switchWeapon(1);
    if (e.code === 'Digit3') switchWeapon(2);
    if (e.code === 'Digit4') switchWeapon(3);
    if (e.code === 'Digit5') switchWeapon(4);
    if (e.code === 'KeyQ') useBandage();
    if (e.code === 'KeyF') useKit();
    if (e.code === 'KeyH') whistleHorse();
    if (e.code === 'KeyT' && !player.dead) placeTorch();
  }
  if (e.code === 'KeyM' && started && !ui.dialogueOpen) {
    if (ui.missionOpen) closeMission();
    toggleMap();
  }
  if (e.code === 'Escape') {
    if (ui.mapOpen) closeMap();
    else if (ui.missionOpen) closeMission();
    else if (started && usingFallback) { ui.menuOpen ? closeMenu() : openMenu(); }
    // in pointer-lock mode the browser exits the lock itself, which opens the menu
  }
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => { player.keys[e.code] = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousedown', (e) => {
  if (!started || player.dead || ui.anyPanelOpen()) return;
  if (!locked && !usingFallback) return;
  if (usingFallback && e.target !== renderer.domElement) return;
  if (e.button === 0) attack();
  else if (e.button === 2) placeBlock();
});

function camDir() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return d;
}

function attack() {
  if (player.attackCd > 0) return;
  const origin = player.eyePos();
  const dir = camDir();

  // dragonback: every attack is dragonfire
  if (player.mount === 'dragon') {
    player.attackCd = 0.8;
    game.audio.play('fire');
    const from = origin.clone().add(dir.clone().multiplyScalar(2.5));
    from.y -= 0.6;
    entities.shoot('fire', from, dir.clone().multiplyScalar(24), 35, true);
    return;
  }

  // clicking the mission beacon (from beyond melee range) opens the briefing
  if (beacon.visible) {
    const gp = new THREE.Vector3();
    beaconGem.getWorldPosition(gp);
    gp.sub(origin);
    const d = gp.length();
    gp.normalize();
    if (d > 3 && gp.dot(dir) > 0.997) { openMission(); return; }
  }

  const w = WEAPONS[player.weapon()];
  player.attackCd = w.cd;
  player.swingT = 1;

  if (w.ranged) {
    game.audio.play('arrow');
    const from = origin.clone().add(dir.clone().multiplyScalar(0.8));
    entities.shoot('arrow', from, dir.clone().multiplyScalar(w.speed || 34), w.dmg(), true);
    return;
  }

  // melee: enemies first, then blocks
  game.audio.play('swing');
  if (entities.hitEnemyFromCamera(origin, dir, w.range, w.dmg(), w.source())) { ui.updateHud(); return; }
  const hit = world.raycast(origin, dir, 5);
  if (hit && world.isBreakable(hit.block)) {
    world.set(hit.x, hit.y, hit.z, AIR);
    world.updateBlock(hit.x, hit.y, hit.z);
    game.audio.play('chop');
    if (hit.block === TORCH) {
      world.torches = world.torches.filter(t => !(t.x === hit.x && t.y === hit.y && t.z === hit.z));
    }
    if (hit.block === LOG) {
      player.wood++;
      ui.toast('+1 log');
      quests.onWoodCollected();
      ui.updateHud();
    }
  }
}

function placeAt(blockId) {
  if (player.wood <= 0) { ui.toast('No wood — chop trees for logs.'); return; }
  const hit = world.raycast(player.eyePos(), camDir(), 5);
  if (!hit) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (!world.inBounds(x, y, z) || world.get(x, y, z) !== AIR) return;
  const p = player.pos;
  if (Math.floor(p.x) === x && (Math.floor(p.y) === y || Math.floor(p.y + 1) === y) && Math.floor(p.z) === z) return;
  world.set(x, y, z, blockId);
  world.updateBlock(x, y, z);
  player.wood--;
  game.audio.play('place');
  if (blockId === TORCH) {
    world.torches.push({ x, y, z });
    ui.toast('Torch placed — the dead will not rise near its light.');
  }
  ui.updateHud();
}

function whistleHorse() {
  if (!entities.horse || entities.horse.mounted || player.mount) return;
  const h = entities.horse;
  h.pos.set(player.pos.x + 1.5, player.pos.y, player.pos.z + 1.5);
  ui.toast('Old Thunder trots to your side.');
}

// ---------- healing ----------
function useBandage() {
  if (player.dead) return;
  if (player.bandages <= 0) { ui.toast('No bandages — bandits and raiders drop them, or search the land.'); return; }
  if (player.hp >= player.maxHp) { ui.toast('You are unhurt.'); return; }
  player.bandages--;
  player.hp = Math.min(player.maxHp, player.hp + 30);
  game.audio.play('heal');
  ui.toast('Bandage applied — +30 health.', 'gold');
  ui.updateHud();
}
function useKit() {
  if (player.dead) return;
  if (player.kits <= 0) { ui.toast("No Maester's Kits — they are rare. Search keeps, cairns, and boss lairs."); return; }
  if (player.hp >= player.maxHp) { ui.toast('You are unhurt.'); return; }
  player.kits--;
  player.hp = player.maxHp;
  game.audio.play('heal');
  ui.toast("Maester's Kit used — fully healed.", 'gold');
  ui.updateHud();
}

// ---------- mounts ----------
function mountHorse() {
  entities.horse.mounted = true;
  player.mount = 'horse';
  refreshWeaponVM();
  ui.toast('Riding Old Thunder — nearly twice as fast. E to dismount, H to whistle him over later.', 'gold');
}
function mountDragon() {
  entities.dragon.mounted = true;
  player.mount = 'dragon';
  player.pos.y += 2.5;
  game.audio.play('roar');
  refreshWeaponVM();
  ui.toast('RIDING VHAGRIK — W: fly where you look · Space: climb · LMB: dragonfire · E: dismount', 'gold');
}
function dismount() {
  if (player.mount === 'horse' && entities.horse) {
    entities.horse.mounted = false;
    entities.horse.pos.set(player.pos.x + 1.2, player.pos.y, player.pos.z + 1.2);
  }
  if (player.mount === 'dragon' && entities.dragon) {
    entities.dragon.mounted = false;
    entities.dragon.pos.set(player.pos.x + 2, player.pos.y, player.pos.z + 2);
  }
  player.mount = null;
  refreshWeaponVM();
}
game.dismount = dismount;

function placeBlock() { placeAt(PLANK); }
function placeTorch() { placeAt(TORCH); }

function tryInteract() {
  // mounted: E dismounts
  if (player.mount) { dismount(); return; }

  const npcClose = entities.nearestNpc(player.pos, 2.4); // NPCs win when very close
  if (!npcClose) {
    // nearest mount in range wins (dragon vs horse)
    const dgn = entities.dragon, h = entities.horse;
    const dd = dgn ? Math.hypot(dgn.pos.x - player.pos.x, dgn.pos.z - player.pos.z) : Infinity;
    const hd = (h && !h.mounted) ? Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z) : Infinity;
    if (hd < 3.5 && hd <= dd) { mountHorse(); return; }
    if (dd < 4.5) {
      if (quests.stage === 13 && dgn.state === 'hatchling') {
        if (player.meat >= 3) {
          player.meat -= 3;
          entities.growDragon();
          ui.toast('Vhagrik devours the meat... and GROWS!', 'gold');
          quests.setStage(14);
        } else {
          ui.toast(`Vhagrik sniffs your hands — he needs ${3 - player.meat} more boar meat.`);
        }
        ui.updateHud();
        ui.updateTracker();
        return;
      }
      if (dgn.state === 'grown') { mountDragon(); return; }
      ui.toast('Vhagrik chirps and nips at your boots.');
      return;
    }
    if (hd < 3.5) { mountHorse(); return; }
  }

  const npc = entities.nearestNpc(player.pos, 3.4);
  if (!npc) return;
  if (!usingFallback) document.exitPointerLock();
  ui.setPaused(false);
  const d = quests.dialogueFor(npc);
  ui.showDialogue(d, () => {
    ui.updateTracker();
    ui.updateHud();
    if (!usingFallback && document.getElementById('victory').style.display !== 'flex') {
      tryLock();
    }
  });
}

// ---------- day / night ----------
function updateDayNight(dt) {
  elapsed += dt;
  const t = (elapsed % DAY_LENGTH) / DAY_LENGTH;      // 0..1
  const sunHeight = Math.sin(t * Math.PI * 2);         // >0 day, <0 night
  const dayAmount = Math.max(0, Math.min(1, sunHeight * 2 + 0.2));
  const a = t * Math.PI * 2;
  sun.position.set(96 + Math.cos(a) * 120, Math.sin(a) * 120, 96 + 40);
  sun.target.position.set(96, 0, 96);
  sun.target.updateMatrixWorld();
  sun.intensity = 0.15 + dayAmount * 0.95;
  hemi.intensity = 0.25 + dayAmount * 0.5;
  scene.background.copy(SKY_NIGHT).lerp(SKY_DAY, dayAmount);
  scene.fog.color.copy(scene.background);
  game.dayAmount = dayAmount;
}
game.dayAmount = 1;

// ---------- main loop ----------
// ---------- touch controls ----------
initTouch(game, {
  attack: () => { if (started && !ui.anyPanelOpen() && !player.dead) attack(); },
  placeBlock: () => { if (started && !ui.anyPanelOpen() && !player.dead) placeBlock(); },
  interact: () => { if (started && !ui.anyPanelOpen() && !player.dead) tryInteract(); },
  cycleWeapon: () => { if (started) switchWeapon((player.weaponIdx + 1) % player.weapons.length); },
  useBandage: () => { if (started) useBandage(); },
  useKit: () => { if (started) useKit(); },
  whistle: () => { if (started) whistleHorse(); },
  placeTorch: () => { if (started && !ui.anyPanelOpen() && !player.dead) placeTorch(); },
});

window.game = game; // debug/testing handle

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (started) updateBeacon(elapsed);

  if (started && !ui.anyPanelOpen() && (locked || usingFallback || player.dead)) {
    if (game.touch && game.touch.attackHeld && !player.dead) attack(); // hold-to-swing on touch
    player.update(dt);
    entities.update(dt);
    saveSys.update(dt);
    ui.updateHud();
    ui.updateCompass(player.yaw);

    // interaction hint + block highlight
    const npc = entities.nearestNpc(player.pos, 3.4);
    if (player.mount) {
      ui.showInteractHint('', '[E]  Dismount');
    } else if (npc && !ui.dialogueOpen) {
      ui.showInteractHint(npc.name);
    } else {
      const dgn = entities.dragon;
      const h = entities.horse;
      const dd = dgn ? Math.hypot(dgn.pos.x - player.pos.x, dgn.pos.z - player.pos.z) : Infinity;
      const hd = (h && !h.mounted) ? Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z) : Infinity;
      if (hd < 3.5 && hd <= dd) {
        ui.showInteractHint('', '[E]  Ride Old Thunder');
      } else if (dd < 4.5) {
        ui.showInteractHint('', dgn.state === 'grown' ? '[E]  Ride Vhagrik' :
          (quests.stage === 13 ? '[E]  Feed Vhagrik' : '[E]  Pet Vhagrik'));
      } else if (hd < 3.5) {
        ui.showInteractHint('', '[E]  Ride Old Thunder');
      } else {
        ui.hideInteractHint();
      }
    }

    const hit = world.raycast(player.eyePos(), camDir(), 5);
    if (hit && world.isBreakable(hit.block)) {
      highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      highlight.visible = true;
    } else highlight.visible = false;
  }

  if (started) updateDayNight(dt);

  // camera follows player
  camera.position.set(player.pos.x, player.pos.y + player.eyeH(), player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  // weapon swing animation
  holder.rotation.x = 0.35 - player.swingT * 1.3;
  holder.rotation.z = player.swingT * 0.4;

  // mounted animals track the rider
  if (player.mount === 'horse' && entities.horse) {
    const h = entities.horse;
    h.pos.set(player.pos.x, player.pos.y, player.pos.z);
    h.group.rotation.y = player.yaw + Math.PI;
    entities.walkAnim(h.group, Math.abs(player.vel.x) + Math.abs(player.vel.z) > 0.5);
  } else if (player.mount === 'dragon' && entities.dragon) {
    const dgn = entities.dragon;
    dgn.pos.set(player.pos.x, player.pos.y - 1.2, player.pos.z);
    dgn.group.rotation.y = player.yaw + Math.PI;
    entities.flapWings(dgn.group, 6);
  }

  renderer.render(scene, camera);
}
loop();
