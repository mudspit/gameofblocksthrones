export class UI {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['title', 'beginBtn', 'hud', 'stats', 'tracker', 'questText', 'dialogue',
      'dlgName', 'dlgText', 'dlgOptions', 'bossbar', 'bossFill', 'toasts', 'crosshair',
      'vignette', 'interactHint', 'deathScreen', 'victory', 'victoryText', 'victoryBtn',
      'pauseHint', 'hpFill', 'hpNum', 'xpFill', 'lvlNum', 'goldNum', 'woodNum', 'dmgNum',
      'playerTitle', 'compass', 'controlsBar', 'mapBtn', 'mapOverlay', 'mapCanvas',
      'mapMarkers', 'mapClose', 'mapObjective', 'mapPlayer', 'missionPanel', 'missionTitle',
      'missionDesc', 'missionObjective', 'missionDist', 'missionClose', 'missionMap']) {
      this.el[id] = document.getElementById(id);
    }
    this.dialogueOpen = false;
    this.mapOpen = false;
    this.missionOpen = false;
  }

  anyPanelOpen() { return this.dialogueOpen || this.mapOpen || this.missionOpen; }

  showGameUI() {
    this.el.title.style.display = 'none';
    for (const id of ['hud', 'stats', 'tracker', 'crosshair', 'compass', 'controlsBar', 'mapBtn']) {
      this.el[id].style.display = 'block';
    }
    document.getElementById('muteBtn').style.display = 'block';
    this.updateHud();
    this.updateTracker();
  }

  // ---------- map ----------
  buildMap() {
    const w = this.game.world;
    const ctx = this.el.mapCanvas.getContext('2d');
    const img = ctx.createImageData(192, 192);
    const RGB = {
      1: [106, 160, 62], 2: [122, 92, 58], 3: [138, 138, 140], 4: [107, 74, 43],
      5: [53, 104, 42], 6: [160, 122, 74], 7: [58, 107, 216], 8: [232, 238, 242],
      9: [185, 141, 62], 10: [112, 112, 116], 11: [216, 106, 42], 12: [160, 34, 34],
    };
    for (let z = 0; z < 192; z++) {
      for (let x = 0; x < 192; x++) {
        let b = 0, y = 47;
        for (; y >= 0; y--) { b = w.get(x, y, z); if (b !== 0) break; }
        const c = RGB[b] || [20, 20, 20];
        const shade = 0.72 + (y / 47) * 0.45;
        const i = (z * 192 + x) * 4;
        img.data[i] = Math.min(255, c[0] * shade);
        img.data[i + 1] = Math.min(255, c[1] * shade);
        img.data[i + 2] = Math.min(255, c[2] * shade);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // place labels once
    const labels = [
      ['Mudford Keep', 52, 100], ['The Village', 140, 96],
      ['Northern Woods', 96, 34], ['Bandit Camp', 150, 156],
      ['Kingsport', 170, 30],
    ];
    for (const [name, x, z] of labels) {
      const el = document.createElement('div');
      el.className = 'map-label';
      el.textContent = name;
      el.style.left = (x / 192 * 100) + '%';
      el.style.top = (z / 192 * 100) + '%';
      this.el.mapMarkers.appendChild(el);
    }
  }

  showMap() {
    this.mapOpen = true;
    this.el.mapOverlay.style.display = 'flex';
    this.updateMapMarkers();
  }
  hideMap() {
    this.mapOpen = false;
    this.el.mapOverlay.style.display = 'none';
  }

  updateMapMarkers() {
    const p = this.game.player;
    this.el.mapPlayer.style.left = (p.pos.x / 192 * 100) + '%';
    this.el.mapPlayer.style.top = (p.pos.z / 192 * 100) + '%';
    // forward vector on the map: (-sin yaw, -cos yaw); ➤ glyph points right at 0deg
    const deg = Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw)) * 180 / Math.PI;
    this.el.mapPlayer.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
    const loc = this.game.quests.objectiveLocation();
    if (loc) {
      this.el.mapObjective.style.display = 'block';
      this.el.mapObjective.style.left = (loc.x / 192 * 100) + '%';
      this.el.mapObjective.style.top = (loc.z / 192 * 100) + '%';
    } else {
      this.el.mapObjective.style.display = 'none';
    }
  }

  // ---------- mission panel ----------
  showMission(info) {
    this.missionOpen = true;
    this.el.missionPanel.style.display = 'block';
    this.el.missionTitle.textContent = info.title;
    this.el.missionDesc.textContent = info.desc;
    this.el.missionObjective.innerHTML = 'Objective: <b></b>';
    this.el.missionObjective.querySelector('b').textContent = info.objective;
    if (info.loc) {
      const p = this.game.player.pos;
      const dx = info.loc.x - p.x, dz = info.loc.z - p.z;
      const dist = Math.round(Math.hypot(dx, dz));
      const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
      let a = Math.atan2(dx, -dz); if (a < 0) a += Math.PI * 2;
      const dir = dirs[Math.round(a / (Math.PI / 4)) % 8];
      this.el.missionDist.textContent = `${dist} blocks to the ${dir} — follow the golden beacon.`;
    } else {
      this.el.missionDist.textContent = 'No marked destination — the realm is yours.';
    }
  }
  hideMission() {
    this.missionOpen = false;
    this.el.missionPanel.style.display = 'none';
  }

  updateHud() {
    const p = this.game.player;
    this.el.hpFill.style.width = (100 * p.hp / p.maxHp) + '%';
    this.el.hpNum.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.el.xpFill.style.width = (100 * p.xp / p.xpToNext()) + '%';
    this.el.lvlNum.textContent = p.level;
    this.el.goldNum.textContent = p.gold;
    this.el.woodNum.textContent = p.wood;
    this.el.dmgNum.textContent = p.dmg;
    this.el.playerTitle.textContent = this.game.quests.playerTitle();
    const wn = document.getElementById('weaponName');
    if (wn && this.game.getWeaponLabel) wn.textContent = this.game.getWeaponLabel();
    const mr = document.getElementById('meatRow');
    if (mr) {
      mr.style.display = p.meat > 0 ? 'block' : 'none';
      document.getElementById('meatNum').textContent = p.meat;
    }
    const bn = document.getElementById('bandNum');
    if (bn) bn.textContent = p.bandages;
    const kn = document.getElementById('kitNum');
    if (kn) kn.textContent = p.kits;
  }

  updateCompass(yaw) {
    const dirs = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
    let a = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const i = Math.round(a / (Math.PI / 4)) % 8;
    // yaw=0 faces -z (north)
    this.el.compass.textContent = dirs[i];
  }

  updateTracker() {
    this.el.questText.textContent = this.game.quests.objectiveText();
  }

  toast(msg, cls = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3100);
  }

  flashVignette() {
    this.el.vignette.style.opacity = '1';
    clearTimeout(this._vt);
    this._vt = setTimeout(() => { this.el.vignette.style.opacity = '0'; }, 250);
  }

  showInteractHint(name, override) {
    this.el.interactHint.textContent = override || `[E]  Speak with ${name}`;
    this.el.interactHint.style.display = 'block';
  }
  hideInteractHint() { this.el.interactHint.style.display = 'none'; }

  showDialogue(d, onClose) {
    this.dialogueOpen = true;
    this.el.dialogue.style.display = 'block';
    this.el.dlgName.textContent = d.name;
    this.el.dlgText.textContent = d.text;
    this.el.dlgOptions.innerHTML = '';
    for (const opt of d.options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.onclick = () => {
        if (opt.fn) opt.fn();
        this.hideDialogue();
        onClose();
      };
      this.el.dlgOptions.appendChild(b);
    }
  }

  hideDialogue() {
    this.dialogueOpen = false;
    this.el.dialogue.style.display = 'none';
  }

  showBossBar(frac, name) {
    this.el.bossbar.style.display = 'block';
    this.el.bossFill.style.width = (100 * frac) + '%';
    if (name) document.getElementById('bossName').textContent = name;
  }
  hideBossBar() { this.el.bossbar.style.display = 'none'; }

  showDeath(cb) {
    this.el.deathScreen.style.display = 'flex';
    setTimeout(() => {
      this.el.deathScreen.style.display = 'none';
      cb();
    }, 2600);
  }

  showVictory(stats, onContinue, custom) {
    this.el.victory.style.display = 'flex';
    const titleEl = document.getElementById('victoryTitle');
    if (custom) {
      if (titleEl) titleEl.textContent = custom.title;
      this.el.victoryText.textContent = custom.text;
    } else {
      if (titleEl) titleEl.textContent = 'LORD OF MUDFORD KEEP';
      this.el.victoryText.textContent =
        `Rorge is dead, the roads are safe, and a red banner flies over your tower. ` +
        `Level ${stats.level} · ${stats.gold} gold in the coffers. ` +
        `Act I is complete — Act II begins now: speak with Rodrik about Rorge's strange plunder.`;
    }
    this.el.victoryBtn.onclick = () => {
      this.el.victory.style.display = 'none';
      onContinue();
    };
  }

  setPaused(paused) {
    this.el.pauseHint.style.display = paused ? 'flex' : 'none';
  }
}
