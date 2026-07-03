// Quest stage machine.
// ACT I  — 0 speak to Rodrik → 1 visit Marta → 2 slay 4 wolves → 3 return to Marta (direwolf ally!)
//          → 4 bring 6 logs to Tobbo → 5 speak to Rodrik → 6 slay the Bandit King
//          → 7 return to Rodrik → 8 Lord of Mudford Keep
// ACT II — 9 find the strange chest → 10 hatch the egg at the forge → 11 recruit Ser Bryn
//          → 12 defend the keep from Vale raiders → 13 hunt boars & feed the hatchling
//          → 14 recover dragonglass from the Frozen Cairn → 15 slay 3 White Walkers at night
//          → 16 slay the Wild Dragon from dragonback → 17 return to Rodrik → 18 Dragonlord

const WOLVES_NEEDED = 4, LOGS_NEEDED = 6, RAIDERS_NEEDED = 6, MEAT_NEEDED = 3, WALKERS_NEEDED = 3;

const FLAVOR = [
  'Winter is coming, m\'lord. It always is.',
  'The King\'s roads aren\'t safe these days.',
  'A lord who works his own fields — now I\'ve seen everything.',
  'They say the harvest will be thin this year.',
  'Mind the woods at night, ser. Dead things walk when the sun is down.',
  'Is that... a dragon? Gods be good.',
];

export class Quests {
  constructor(game) {
    this.game = game;
    this.stage = 0;
    this.wolfKills = 0;
    this.raiderKills = 0;
    this.walkerKills = 0;
  }

  playerTitle() {
    if (this.stage >= 17) return 'Dragonlord of Mudford';
    if (this.stage >= 8) return 'Lord of Mudford Keep';
    if (this.stage >= 2) return 'Ser, Knight of Mudford';
    return 'Ser, a Hedge Knight';
  }

  objectiveText() {
    const p = this.game.player;
    switch (this.stage) {
      case 0: return 'Speak with Steward Rodrik in the courtyard of Mudford Keep.';
      case 1: return 'Ride east and speak with Elder Marta in the village.';
      case 2: return `Slay wolves in the northern woods. (${this.wolfKills}/${WOLVES_NEEDED})`;
      case 3: return 'Return to Elder Marta in the village.';
      case 4: return `Chop trees for logs and bring them to Smith Tobbo at the keep. (${Math.min(p.wood, LOGS_NEEDED)}/${LOGS_NEEDED} logs)`;
      case 5: return 'Speak with Steward Rodrik at the keep.';
      case 6: return 'Defeat Bandit King Rorge at the camp to the southeast.';
      case 7: return 'Return victorious to Steward Rodrik.';
      case 8: return 'Speak with Steward Rodrik — there is word of strange plunder.';
      case 9: return 'Search Rorge\'s camp for the strange chest.';
      case 10: return 'The egg stirs near heat — carry it to the forge fire at the keep.';
      case 11: return 'A knight seeks service — meet Ser Bryn in the village.';
      case 12: return `Defend Mudford Keep — slay the Vale raiders! (${this.raiderKills}/${RAIDERS_NEEDED})`;
      case 13: return p.meat >= MEAT_NEEDED
        ? 'Feed your hatchling — press E beside Vhagrik.'
        : `Your hatchling hungers. Hunt wild boars in the southern fields. (${p.meat}/${MEAT_NEEDED} meat)`;
      case 14: return 'Recover dragonglass from the Frozen Cairn in the north-western hills.';
      case 15: return `Slay White Walkers with your dragonglass — they walk only after dark. (${this.walkerKills}/${WALKERS_NEEDED})`;
      case 16: return 'Slay the Wild Dragon circling the south-western crags. Take to the sky!';
      case 17: return 'Return to Steward Rodrik in triumph.';
      default: return 'Act II complete — rule your skies, Dragonlord. (Act III coming soon)';
    }
  }

  setStage(s) {
    this.stage = s;
    if (this.game.onStageChanged) this.game.onStageChanged(s);
    this.game.ui.updateTracker();
    this.game.ui.updateHud();
    if (this.game.saveNow) this.game.saveNow();
  }

  onKill(type) {
    if (type === 'wolf' && this.stage === 2) {
      this.wolfKills++;
      if (this.wolfKills >= WOLVES_NEEDED) {
        this.game.ui.toast('The pack is thinned. Return to Elder Marta.', 'gold');
        this.setStage(3);
      } else this.game.ui.updateTracker();
    }
    if (type === 'boss' && this.stage === 6) {
      this.game.ui.toast('Bandit King Rorge is slain!', 'gold');
      this.setStage(7);
    }
    if (type === 'raider' && this.stage === 12) {
      this.raiderKills++;
      if (this.raiderKills >= RAIDERS_NEEDED) {
        this.game.ui.toast('The raiders are broken! Mudford stands.', 'gold');
        this.setStage(13);
      } else this.game.ui.updateTracker();
    }
    if (type === 'boar' && this.stage === 13) this.game.ui.updateTracker();
    if (type === 'walker' && this.stage === 15) {
      this.walkerKills++;
      if (this.walkerKills >= WALKERS_NEEDED) {
        this.game.ui.toast('The cold ones shatter! The north breathes easier.', 'gold');
        this.setStage(16);
      } else this.game.ui.updateTracker();
    }
    if (type === 'dragonboss' && this.stage === 16) {
      this.game.ui.toast('THE WILD DRAGON IS SLAIN!', 'gold');
      this.setStage(17);
    }
  }

  onWoodCollected() {
    if (this.stage === 4) this.game.ui.updateTracker();
  }

  flavorLine(seed) { return FLAVOR[seed % FLAVOR.length]; }

  objectiveLocation() {
    const npcAt = (id) => {
      const n = this.game.entities.npcs.find(n => n.id === id);
      return n ? { x: n.pos.x, z: n.pos.z } : null;
    };
    const nearestEnemy = (type, fallback) => {
      const p = this.game.player.pos;
      let best = null, bd = Infinity;
      for (const e of this.game.entities.enemies) {
        if (e.type !== type || e.dead) continue;
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (d < bd) { bd = d; best = e; }
      }
      return best ? { x: best.pos.x, z: best.pos.z } : fallback;
    };
    switch (this.stage) {
      case 0: case 5: case 7: case 8: case 17: return npcAt('rodrik');
      case 1: case 3: return npcAt('marta');
      case 2: return nearestEnemy('wolf', { x: 90, z: 40 });
      case 4: return npcAt('tobbo');
      case 6: return nearestEnemy('boss', { x: 150, z: 156 });
      case 9: return npcAt('chest') || { x: 150, z: 153 };
      case 10: return npcAt('forgefire') || { x: 59, z: 105 };
      case 11: return npcAt('bryn');
      case 12: return nearestEnemy('raider', { x: 52, z: 112 });
      case 13: {
        if (this.game.player.meat >= MEAT_NEEDED && this.game.entities.dragon) {
          const d = this.game.entities.dragon;
          return { x: d.pos.x, z: d.pos.z };
        }
        return nearestEnemy('boar', { x: 80, z: 150 });
      }
      case 14: return npcAt('cairn') || { x: 28, z: 26 };
      case 15: return nearestEnemy('walker', { x: 90, z: 40 });
      case 16: return nearestEnemy('dragonboss', { x: 34, z: 150 });
      default: return null;
    }
  }

  missionInfo() {
    const M = (title, desc) => ({ title, desc, objective: this.objectiveText(), loc: this.objectiveLocation() });
    switch (this.stage) {
      case 0: return M('Words for the Steward',
        'Rodrik has kept Mudford Keep standing since your father\'s day. If anyone knows what these lands need of their new master, it is him.');
      case 1: return M('The Village Elder',
        'The village east of the keep pays its dues and asks little. That Elder Marta sends for you at all means something is wrong.');
      case 2: return M('Wolves at the Door',
        'A hard winter drove the packs south. Now they take goats — and soon, children. The northern woods must be thinned. The beacon marks the nearest wolf.');
      case 3: return M('The Elder\'s Gratitude',
        'The wolves lie dead. Word travels fast in a small village — return to Marta and let them see the knight who answered.');
      case 4: return M('Steel for the Smith',
        'Tobbo swears he can forge castle-forged steel, given a hot enough fire. Chop logs from the trees with your blade and bring him six.');
      case 5: return M('The Steward\'s Counsel',
        'New steel on your hip and a village behind you. Rodrik paces the courtyard again — there is harder work coming.');
      case 6: return M('The Bandit King',
        'Rorge and his cutthroats have bled these lands for months, safe behind their palisade to the southeast. A lord protects his own. End it.');
      case 7: return M('Word of Victory',
        'Rorge is dead and his camp broken. Carry the news home — Mudford Keep will want to see its knight return.');
      case 8: return M('Strange Plunder',
        'You are a lord now — and lords inherit their enemies\' secrets. Rodrik whispers of a chest in Rorge\'s camp that no bandit dared open.');
      case 9: return M('The Strange Chest',
        'Rorge kept one chest apart from the plunder, wrapped in chains. Whatever he feared inside it is yours now. Search the camp.');
      case 10: return M('Fire and Blood',
        'A dragon\'s egg — black as midnight, warm as a hearth. The old tales say the eggs wake beside great heat. Tobbo\'s forge burns hot enough.');
      case 11: return M('A Knight Seeks Service',
        'Word of the dragon has flown faster than ravens. A wandering knight, Ser Bryn, waits in the village — swords like his do not offer themselves twice.');
      case 12: return M('The Vale Comes Calling',
        'House Vale heard of your dragon and sent raiders, not envoys. They make for Mudford Keep. Meet them with steel — Snow and Ser Bryn will fight beside you.');
      case 13: return M('A Hungry Hatchling',
        'Vhagrik gnaws at saddle straps and stares at the goats. Hunt wild boar in the southern fields and feed the little beast properly — it is growing fast.');
      case 14: return M('The Frozen Cairn',
        'Dead things walk at night, and steel cannot touch the pale ones who lead them. The maesters wrote of a cairn in the north-west hills where the old Night\'s Watch cached dragonglass.');
      case 15: return M('The Long Night\'s Vanguard',
        'Dragonglass in hand, you can finally answer the cold. White Walkers stalk the dark hours — hunt them when the sun is down. Beware: your allies\' steel is useless against them.');
      case 16: return M('The Wild Dragon',
        'A wild dragon nests in the south-western crags, burning farms by night. Mount Vhagrik — press E beside him — and meet it in the sky. Your bow can wound it; dragonfire can kill it.');
      case 17: return M('The Dragonlord Returns',
        'Two dragons met above the crags, and yours flew home. Rodrik waits in the courtyard with something wrapped in oilcloth — a lord\'s reward.');
      default: return M('Dragonlord of Mudford',
        'The banners fly, your dragon guards the sky, and the dead fear your dagger. Rule your lands, Dragonlord — Act III will bring the march on the capital.');
    }
  }

  // Returns { name, text, options: [{label, fn}] } for the given npc id.
  dialogueFor(npc) {
    const p = this.game.player;
    const close = { label: 'Farewell.', fn: null };
    const d = (text, ...options) => ({ name: npc.name, text, options: [...options, close] });

    if (npc.id === 'rodrik') {
      switch (this.stage) {
        case 0: return d(
          'Welcome home, ser. Your lord father is in the ground and Mudford Keep is yours — walls, debts, and all. The smallfolk look to you now. Ride east to the village and speak with Elder Marta; there is trouble brewing. Take Old Thunder from the stable — press E beside him to ride.',
          { label: 'I\'ll see to it.', fn: () => this.setStage(1) });
        case 5: return d(
          'That\'s castle-forged steel on your hip now — good. Listen: bandits under the one they call Rorge have made camp to the southeast. They\'ve bled the village for months. A lord protects his own. End him.',
          { label: 'Rorge dies today.', fn: () => this.setStage(6) });
        case 6: return d('Rorge\'s camp lies southeast, past the fields. Watch the palisade gap on the west side. The old gods keep you, ser.');
        case 7: return d(
          'By the old gods and the new — Rorge slain, his cutthroats scattered! Word is already flying to the great houses. You are a hedge knight no longer. Kneel... and rise, Lord of Mudford Keep.',
          { label: 'For the realm.', fn: () => { this.setStage(8); this.game.onActComplete(); } });
        case 8: return d(
          'Rest while you can, my lord... though there is a matter. Rorge\'s men spoke of a chest their king kept apart from the plunder — wrapped in chains, never opened. Whatever he feared is yours by right now.',
          { label: 'What was in it?', fn: () => this.setStage(9) });
        case 17: return d(
          'Two dragons in the sky and only yours came home — the songs write themselves, my lord. Here: your father\'s war-prize, reforged. Valyrian steel. "Winterbite," he called it. It will cut the cold ones as surely as dragonglass.',
          { label: 'Take Winterbite. (Valyrian steel: +10 damage, harms White Walkers)', fn: () => {
            p.hasValyrian = true;
            p.dmg += 10;
            this.game.upgradeSword(true);
            this.game.ui.toast('Winterbite acquired — Valyrian steel!', 'gold');
            this.setStage(18);
            this.game.onActTwoComplete();
          } });
        case 18: return d('The banners fly for you, Dragonlord. Act III will bring the march on the capital — when you are ready.');
        default:
          if (this.stage >= 9) return d('The realm holds its breath, my lord. See to your quest — the beacon marks the way.');
          return d('Elder Marta awaits you in the village to the east, ser.');
      }
    }

    if (npc.id === 'marta') {
      switch (this.stage) {
        case 0: return d('Speak with your steward first, ser. He\'s been pacing the courtyard since dawn.');
        case 1: return d(
          'So the young knight comes at last. Wolves out of the northern woods have taken two goats, and the miller\'s boy near lost an arm. Thin the pack — four should do it — and the village will remember you kindly.',
          { label: 'Consider it done.', fn: () => this.setStage(2) });
        case 2: return d(`Four wolves, ser. The woods north of the keep. You\'ve felled ${this.wolfKills} so far.`);
        case 3: return d(
          'The woods are quieter already — the village sleeps easier for it. Here, thirty gold, scraped together honest. And look — the runt of that pack followed you home, white as snow. She\'s taken to you. Keep her.',
          { label: 'Take the gold — and Snow. (+30 gold, direwolf ally)', fn: () => {
            p.gold += 30;
            this.game.entities.addAlly('snow');
            this.game.ui.toast('+30 gold · Snow the direwolf joins you!', 'gold');
            this.setStage(4);
          } });
        default: return d('The village stands with Mudford Keep, m\'lord. Always.');
      }
    }

    if (npc.id === 'tobbo') {
      switch (this.stage) {
        case 4:
          if (p.wood >= LOGS_NEEDED) return d(
            'Six good logs — that\'ll fire the forge proper. Give me but a moment... There. Castle-forged steel, ser. Mind the edge; it could shave a septon.',
            { label: `Hand over the logs. (Sword upgrade: ${p.dmg} → ${p.dmg + 6} damage)`, fn: () => {
              p.wood -= LOGS_NEEDED; p.dmg += 6;
              this.game.upgradeSword();
              this.game.ui.toast('Castle-forged steel acquired! Damage increased.', 'gold');
              this.setStage(5);
            } });
          return d(`A lord-to-be swinging that butter knife? Bring me ${LOGS_NEEDED} logs from the woods — chop the trees with your blade — and I\'ll forge you castle-forged steel. You have ${p.wood}.`);
        case 10: return d('An egg, is it? Set it down beside my forge fire there — the coals never die. Go on, press E beside the flames.');
        default:
          if (this.stage > 4) return d('How\'s the steel treating you, ser? Sharpest work I\'ve done since the Greyjoy business.');
          return d('Forge is cold till I\'ve reason to light it, ser.');
      }
    }

    if (npc.id === 'chest') {
      return d(
        'Under a bandit\'s bedroll you find it: a chest wrapped in chains. Inside, nested in singed wool — an egg. Black as midnight, scaled, and warm as a loaf from the oven.',
        { label: 'Take the dragon egg.', fn: () => {
          this.game.entities.removeNpc('chest');
          this.game.ui.toast('Dragon egg acquired — it is warm...', 'gold');
          this.setStage(10);
        } });
    }

    if (npc.id === 'forgefire') {
      return d(
        'The coals breathe like a sleeping animal. The egg near leaps in your hands, drinking the heat. You set it in the embers... a crack. Another. A wet black snout pushes through the shell.',
        { label: 'A dragon is born.', fn: () => {
          this.game.entities.removeNpc('forgefire');
          this.game.entities.spawnDragonHatchling();
          this.game.ui.toast('Vhagrik the hatchling has hatched! He will follow you.', 'gold');
          this.setStage(11);
        } });
    }

    if (npc.id === 'bryn') {
      if (this.stage === 11) return d(
        'Ser Bryn of the Saltpans, m\'lord. I\'ve served three lords and buried two. When I heard a dragon cried in Mudford, I rode a week without sleep. My sword is yours — if you\'ll have an honest blade.',
        { label: 'Rise, Ser Bryn. Mudford is your home now. (Knight ally joins)', fn: () => {
          this.game.entities.removeNpc('bryn');
          this.game.entities.addAlly('bryn');
          this.game.ui.toast('Ser Bryn joins you!', 'gold');
          this.game.ui.toast('Riders on the road! Vale raiders make for the keep — stop them!');
          this.setStage(12);
        } });
      return d('At your side, m\'lord. Point me at something worth killing.');
    }

    if (npc.id === 'cairn') {
      return d(
        'Stones stacked by hands three hundred years dead. Beneath the frost-cap you find them: blades of dragonglass, black and sharp as the night the Watch buried them.',
        { label: 'Take the dragonglass dagger. (New weapon)', fn: () => {
          this.game.entities.removeNpc('cairn');
          this.game.grantWeapon('dagger');
          this.game.ui.toast('It can slay White Walkers.', 'gold');
          this.setStage(15);
        } });
    }

    // generic villagers / guards
    return d(this.flavorLine(npc.name.length + this.stage));
  }
}
