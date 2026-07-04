// Touch controls: left-half virtual joystick, right-half drag-to-look,
// and on-screen action buttons. Enabled when a coarse pointer is detected
// (or on the first real touch), by adding .touch to <body>.

export function initTouch(game, actions) {
  const state = { move: { x: 0, y: 0 }, active: false, sprint: false, attackHeld: false, enabled: false };
  game.touch = state;

  const enable = () => {
    if (state.enabled) return;
    state.enabled = true;
    game.isTouch = true;
    document.body.classList.add('touch');
  };
  if (('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches) enable();
  else window.addEventListener('touchstart', enable, { once: true, passive: true });

  const el = (id) => document.getElementById(id);
  const joyZone = el('joyZone'), lookZone = el('lookZone');
  const base = el('joyBase'), thumb = el('joyThumb');
  const RADIUS = 55;

  // ---------- joystick ----------
  let joyId = null, origin = null;
  joyZone.addEventListener('touchstart', (e) => {
    if (game.ui.anyPanelOpen()) return;
    e.preventDefault();
    if (joyId !== null) return;
    const t = e.changedTouches[0];
    joyId = t.identifier;
    origin = { x: t.clientX, y: t.clientY };
    base.style.left = origin.x + 'px'; base.style.top = origin.y + 'px';
    thumb.style.left = origin.x + 'px'; thumb.style.top = origin.y + 'px';
    base.style.display = thumb.style.display = 'block';
    state.active = true;
  }, { passive: false });
  joyZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
      const m = Math.hypot(dx, dy);
      if (m > RADIUS) { dx = dx / m * RADIUS; dy = dy / m * RADIUS; }
      thumb.style.left = (origin.x + dx) + 'px';
      thumb.style.top = (origin.y + dy) + 'px';
      state.move.x = dx / RADIUS;
      state.move.y = -dy / RADIUS;   // up on screen = forward
      state.sprint = Math.hypot(state.move.x, state.move.y) > 0.88;
    }
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      state.active = false;
      state.move.x = 0; state.move.y = 0;
      state.sprint = false;
      base.style.display = thumb.style.display = 'none';
    }
  };
  joyZone.addEventListener('touchend', joyEnd);
  joyZone.addEventListener('touchcancel', joyEnd);

  // ---------- look ----------
  let lookId = null, last = null;
  lookZone.addEventListener('touchstart', (e) => {
    if (game.ui.anyPanelOpen()) return;
    e.preventDefault();
    if (lookId !== null) return;
    const t = e.changedTouches[0];
    lookId = t.identifier;
    last = { x: t.clientX, y: t.clientY };
  }, { passive: false });
  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      const p = game.player;
      p.yaw -= (t.clientX - last.x) * 0.005;
      p.pitch -= (t.clientY - last.y) * 0.005;
      p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch));
      last = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });
  const lookEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookZone.addEventListener('touchend', lookEnd);
  lookZone.addEventListener('touchcancel', lookEnd);

  // ---------- buttons ----------
  const bind = (id, onDown, onUp) => {
    const b = el(id);
    if (!b) return;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); onDown(); }, { passive: false });
    if (onUp) {
      b.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
      b.addEventListener('touchcancel', () => onUp());
    }
  };
  bind('btnAttack', () => { state.attackHeld = true; actions.attack(); }, () => { state.attackHeld = false; });
  bind('btnJump', () => { game.player.keys['Space'] = true; }, () => { game.player.keys['Space'] = false; });
  bind('btnPlace', () => actions.placeBlock());
  bind('btnInteract', () => actions.interact());
  bind('btnWeapon', () => actions.cycleWeapon());
  bind('btnQ', () => actions.useBandage());
  bind('btnF', () => actions.useKit());
  bind('btnWhistle', () => actions.whistle());
}
