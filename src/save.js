// Account profiles + save games, stored in the browser (localStorage).
// Each profile: { name, created, save: {...} | null }

const KEY = 'gob_profiles_v1';
const LAST = 'gob_last_profile';

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.profileName = null;
    this.autosaveT = 0;
  }

  profiles() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  writeProfiles(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

  lastProfile() { return localStorage.getItem(LAST) || ''; }

  createOrSelect(name) {
    name = (name || '').trim().slice(0, 24);
    if (!name) return null;
    const all = this.profiles();
    if (!all[name]) all[name] = { name, created: Date.now(), save: null };
    this.writeProfiles(all);
    this.profileName = name;
    localStorage.setItem(LAST, name);
    return all[name];
  }

  deleteProfile(name) {
    const all = this.profiles();
    delete all[name];
    this.writeProfiles(all);
  }

  serialize() {
    const g = this.game, p = g.player, q = g.quests, e = g.entities;
    return {
      v: 1, ts: Date.now(),
      stage: q.stage,
      wolfKills: q.wolfKills, raiderKills: q.raiderKills, walkerKills: q.walkerKills,
      royalKills: q.royalKills,
      player: {
        pos: [p.pos.x, p.pos.y, p.pos.z],
        hp: p.hp, maxHp: p.maxHp, dmg: p.dmg, gold: p.gold, wood: p.wood, meat: p.meat,
        xp: p.xp, level: p.level, weapons: [...p.weapons], weaponIdx: p.weaponIdx,
        hasValyrian: p.hasValyrian, bandages: p.bandages, kits: p.kits,
      },
      allies: e.allies.map(a => a.id),
      dragon: e.dragon ? e.dragon.state : null,
      itemsTaken: this.itemsTakenList || [],
    };
  }

  save() {
    if (!this.profileName) return;
    const all = this.profiles();
    if (!all[this.profileName]) return;
    all[this.profileName].save = this.serialize();
    this.writeProfiles(all);
  }

  hasSave() {
    if (!this.profileName) return false;
    const all = this.profiles();
    return !!(all[this.profileName] && all[this.profileName].save);
  }

  markItemTaken(key) {
    this.itemsTakenList = this.itemsTakenList || [];
    if (!this.itemsTakenList.includes(key)) this.itemsTakenList.push(key);
  }

  // Restore a saved game into the freshly generated world.
  load() {
    const g = this.game;
    const all = this.profiles();
    const s = all[this.profileName] && all[this.profileName].save;
    if (!s) return false;
    const p = g.player, q = g.quests, e = g.entities;

    // quest counters first (setStage below reads them)
    q.wolfKills = s.wolfKills || 0;
    q.raiderKills = s.raiderKills || 0;
    q.walkerKills = s.walkerKills || 0;
    q.royalKills = s.royalKills || 0;

    // player
    Object.assign(p, {
      hp: s.player.hp, maxHp: s.player.maxHp, dmg: s.player.dmg, gold: s.player.gold,
      wood: s.player.wood, meat: s.player.meat, xp: s.player.xp, level: s.player.level,
      weapons: s.player.weapons, weaponIdx: Math.min(s.player.weaponIdx, s.player.weapons.length - 1),
      hasValyrian: s.player.hasValyrian, bandages: s.player.bandages, kits: s.player.kits,
    });
    p.pos.set(s.player.pos[0], s.player.pos[1] + 0.5, s.player.pos[2]);

    // allies & dragon
    for (const id of s.allies || []) e.addAlly(id);
    if (s.dragon) {
      e.spawnDragonHatchling();
      if (s.dragon === 'grown') e.growDragon();
    }

    // world pickups already taken
    this.itemsTakenList = s.itemsTaken || [];
    for (let i = e.items.length - 1; i >= 0; i--) {
      const it = e.items[i];
      const key = (it.weaponId || it.kind) + '@' + Math.round(it.pos.x) + ',' + Math.round(it.pos.z);
      if (this.itemsTakenList.includes(key)) {
        g.scene.remove(it.group);
        e.items.splice(i, 1);
      }
    }

    // clear stale Act I enemies if that act is done
    if (s.stage >= 7) {
      for (const en of e.enemies) {
        if ((en.type === 'bandit' || en.type === 'boss') && !en.dead) e.removeEnemy(en);
      }
    }

    // upgrades that affect visuals / world state
    if (s.stage >= 5) g.upgradeSword(s.player.hasValyrian);
    if (s.stage >= 8) g.world.raiseBanner();
    if (s.stage >= 22) g.world.openCityGate();

    // enter the stage (spawns its props/enemies) without re-running old ones
    q.stage = s.stage;
    if (g.onStageChanged) g.onStageChanged(s.stage);
    g.ui.updateTracker();
    g.ui.updateHud();
    return true;
  }

  // called every frame once the game is running
  update(dt) {
    this.autosaveT += dt;
    if (this.autosaveT > 12) {
      this.autosaveT = 0;
      this.save();
    }
  }
}
