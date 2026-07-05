// Wandering legends: famous swords and silver queens who appear in the wild.
// Each encounter offers choices with lasting consequences — ally, enemy, or
// a bargain — remembered in the save.

export const LEGEND_NAMES = {
  jon: 'Jon of the Snows',
  daeneris: 'Daeneris Stormborn',
  hound: 'Sandor the Burned',
  jaime: 'Ser Jaime the Golden',
  tyrion: 'Tyrion the Clever',
};
const ALL = Object.keys(LEGEND_NAMES);

export class Legends {
  constructor(game) {
    this.game = game;
    this.status = {};     // id -> 'ally' | 'slain' | 'perk' (terminal states)
    this.active = null;   // legend currently walking the world
    this.timer = 75;      // first stranger appears a bit over a minute in
    this.despawnT = 0;
  }

  unresolved() { return ALL.filter(id => !this.status[id]); }

  update(dt) {
    const g = this.game;
    if (this.active) {
      const npc = g.entities.npcs.find(n => n.legendId === this.active);
      if (!npc) { this.active = null; this.resetTimer(); return; }
      // they seek you out
      const p = g.player.pos;
      const dx = p.x - npc.pos.x, dz = p.z - npc.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.5) {
        npc.pos.x += (dx / d) * 3.4 * dt;
        npc.pos.z += (dz / d) * 3.4 * dt;
        npc.group.rotation.y = Math.atan2(dx, dz);
        g.entities.walkAnim(npc.group, true);
        const gy = g.entities.groundY(npc.pos.x, npc.pos.z);
        npc.pos.y += (gy - npc.pos.y) * Math.min(1, dt * 10);
      } else {
        g.entities.walkAnim(npc.group, false);
      }
      g.entities.idleAnim(npc.group, 3);
      this.despawnT -= dt;
      if (this.despawnT <= 0) this.dismiss(npc, `${npc.name} moves on. Perhaps your paths will cross again.`);
      return;
    }
    if (g.quests.stage < 2 || g.player.dead) return;
    const pool = this.unresolved();
    if (!pool.length) return;
    this.timer -= dt;
    if (this.timer <= 0) this.spawn(pool[Math.floor(Math.random() * pool.length)]);
  }

  resetTimer() { this.timer = 160 + Math.random() * 120; }

  spawn(id) {
    const g = this.game, p = g.player.pos;
    const a = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 6;
    const x = Math.max(4, Math.min(188, p.x + Math.cos(a) * dist));
    const z = Math.max(4, Math.min(188, p.z + Math.sin(a) * dist));
    g.entities.addLegendNpc(id, x, z);
    this.active = id;
    this.despawnT = 110;
    g.ui.toast(`⚔ ${LEGEND_NAMES[id]} approaches — seek them out and choose your words.`, 'gold');
    g.audio?.play('quest');
  }

  dismiss(npc, msg) {
    this.game.entities.removeNpc(npc.id);
    this.active = null;
    this.resetTimer();
    if (msg) this.game.ui.toast(msg);
  }

  becomeAlly(npc, id, line) {
    const g = this.game;
    g.entities.removeNpc(npc.id);
    g.entities.addAlly(id);
    this.status[id] = 'ally';
    this.active = null;
    this.resetTimer();
    g.ui.toast(`${LEGEND_NAMES[id]} joins you! ${line || ''}`, 'gold');
    g.audio?.play('fanfare');
    g.saveNow?.();
  }

  becomeEnemy(npc, id) {
    const g = this.game;
    const { x, z } = { x: npc.pos.x, z: npc.pos.z };
    g.entities.removeNpc(npc.id);
    g.entities.addEnemy(id, x, z).aggroed = true;
    this.active = null;
    this.resetTimer();
    g.audio?.play('roar');
  }

  onKill(type) {
    if (!ALL.includes(type)) return;
    this.status[type] = 'slain';
    this.game.ui.toast(`${LEGEND_NAMES[type]} falls. The songs will remember this.`, 'gold');
    this.game.saveNow?.();
  }

  dialogueFor(npc) {
    const g = this.game, p = g.player;
    const id = npc.legendId;
    const leave = { label: 'Farewell.', fn: null };
    const d = (text, ...options) => ({ name: npc.name, text, options: [...options, leave] });

    if (id === 'jon') {
      const proven = g.quests.walkerKills > 0 || g.quests.stage >= 16;
      return d(
        'I\'ve walked a long way south. I watch, mostly — lords playing at thrones while the real war waits in the dark. I\'ve seen your banners. Question is whether you\'re another player... or a fighter.',
        proven
          ? { label: 'I\'ve shattered White Walkers. Fight beside me, Jon.', fn: () => this.becomeAlly(npc, 'jon', 'His blade knows the dead.') }
          : { label: 'Fight beside me.', fn: () => this.dismiss(npc, 'Jon: "Come find me when you\'ve faced the dead — and lived."') },
        { label: 'We need no brooding wanderers here. Go.', fn: () => this.dismiss(npc, 'Jon shrugs and walks north, as he always does.') },
        { label: 'Draw your sword, stranger.', fn: () => { this.becomeEnemy(npc, 'jon'); g.ui.toast('Jon: "I didn\'t want this." — his sword is already out.'); } }
      );
    }

    if (id === 'daeneris') {
      return d(
        'I am Daeneris Stormborn, mother of dragons — the last of them, until yours hatched. I will have the loyalty of every dragonlord in this land. Bend the knee.',
        { label: 'I bend the knee, my queen.', fn: () => this.becomeAlly(npc, 'daeneris', 'Her strikes burn — even the cold ones fear her.') },
        { label: 'Take tribute instead. (100 gold)', fn: () => {
          if (p.gold < 100) { g.ui.toast('She eyes your thin purse with contempt.'); return; }
          p.gold -= 100;
          p.kits++;
          g.ui.updateHud();
          this.dismiss(npc, 'She takes your gold and leaves a maester\'s kit. "A queen remembers generosity."');
        } },
        { label: 'I kneel to no one.', fn: () => { this.becomeEnemy(npc, 'daeneris'); g.ui.toast('"Then burn." — her hands fill with fire!'); } }
      );
    }

    if (id === 'hound') {
      return d(
        'Don\'t stare. Yes, the face. No, I don\'t want to talk about it. I want food, coin, and for the world to leave me alone — roughly in that order. You got food?',
        { label: 'Share your boar meat. (1 meat)', fn: () => {
          if (p.meat < 1) { g.ui.toast('The Hound snorts: "Thought so." He looks hungrier than before.'); return; }
          p.meat--;
          g.ui.updateHud();
          this.becomeAlly(npc, 'hound', '"You had me at meat."');
        } },
        { label: 'Move along, big man.', fn: () => this.dismiss(npc, 'The Hound spits and lumbers off.') },
        { label: 'Nice face. Dragon kiss you goodnight?', fn: () => { this.becomeEnemy(npc, 'hound'); g.ui.toast('That was a mistake. A very large mistake.'); } }
      );
    }

    if (id === 'jaime') {
      return d(
        'Ser Jaime, at your service — well, at someone\'s service, eventually. Finest sword in the realm, going cheap. Only slightly used on a king. So: gold, glory, or shall we simply see who\'s better?',
        { label: 'Sell me your sword. (200 gold)', fn: () => {
          if (p.gold < 200) { g.ui.toast('Jaime laughs: "Come back when your coffers match your ambition."'); return; }
          p.gold -= 200;
          g.ui.updateHud();
          this.becomeAlly(npc, 'jaime', '"A Lannister honors his contracts. Mostly."');
        } },
        { label: 'I challenge you to a duel, Kingslayer.', fn: () => { this.becomeEnemy(npc, 'jaime'); g.ui.toast('"Oh, wonderful." — he draws with a golden grin.'); } },
        { label: 'We have no use for oathbreakers.', fn: () => this.dismiss(npc, 'Jaime bows theatrically and rides off.') }
      );
    }

    if (id === 'tyrion') {
      return d(
        'A dwarf walks into a war zone — no, that\'s the whole joke, I\'m afraid. I drink and I know things: where gold hides, who\'s lying, and precisely how much of your coin should become my coin for me to tell you.',
        { label: 'Buy his counsel. (50 gold — permanent +20% gold from kills)', fn: () => {
          if (p.gold < 50) { g.ui.toast('Tyrion: "Counsel for the poor: get richer first."'); return; }
          p.gold -= 50;
          p.goldBonus = 0.2;
          this.status.tyrion = 'perk';
          g.ui.updateHud();
          this.dismiss(npc, 'Tyrion\'s counsel pays for itself: +20% gold from every kill, forever.');
          g.audio?.play('coin');
          g.saveNow?.();
        } },
        { label: 'Share a cup of wine with him.', fn: () => {
          p.bandages++;
          g.ui.updateHud();
          this.dismiss(npc, 'An hour of stories later he leaves you a bandage. "You\'ll need it more than I do."');
        } },
        { label: 'Away, Imp.', fn: () => this.dismiss(npc, '"Charming. My father would have liked you."') }
      );
    }

    return d('...');
  }
}
