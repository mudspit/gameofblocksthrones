// Procedural 8-bit-ish sound engine — WebAudio only, no asset files.
// Call init() from a user gesture; every effect is synthesized on the fly.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('gob_sound') !== 'off';
    this.last = {};
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
      // shared noise buffer
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('gob_sound', this.enabled ? 'on' : 'off');
    return this.enabled;
  }

  // ---- background music (quiet, looping, independent of sfx) ----
  initMusic() {
    if (this.music) return;
    this.music = new Audio('assets/music.mp3');
    this.music.loop = true;
    this.musicVol = Math.min(1, Math.max(0, parseFloat(localStorage.getItem('gob_music_vol') || '0.22')));
    this.musicOn = localStorage.getItem('gob_music') !== 'off';
    this.music.volume = this.musicVol;
  }

  startMusic() {
    this.initMusic();
    if (this.musicOn) this.music.play().catch(() => {});
  }

  toggleMusic() {
    this.initMusic();
    this.musicOn = !this.musicOn;
    localStorage.setItem('gob_music', this.musicOn ? 'on' : 'off');
    if (this.musicOn) this.music.play().catch(() => {});
    else this.music.pause();
    return this.musicOn;
  }

  setMusicVolume(v) {
    this.initMusic();
    this.musicVol = Math.min(1, Math.max(0, v));
    localStorage.setItem('gob_music_vol', String(this.musicVol));
    this.music.volume = this.musicVol;
  }

  play(name, throttleMs = 70) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < throttleMs) return;
    this.last[name] = now;
    if (typeof this['sfx_' + name] === 'function') this['sfx_' + name]();
  }

  // ---- synth helpers ----
  tone(freq, type, dur, vol, endFreq = null, delay = 0) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, filterFreq, type = 'lowpass', delay = 0, endFreq = null) {
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  // ---- effects ----
  sfx_swing()  { this.noise(0.11, 0.12, 1400, 'bandpass', 0, 500); }
  sfx_hit()    { this.tone(110, 'square', 0.09, 0.3, 60); this.noise(0.05, 0.18, 900); }
  sfx_clink()  { this.tone(1250, 'triangle', 0.06, 0.14, 950); }
  sfx_chop()   { this.noise(0.07, 0.28, 520); this.tone(130, 'square', 0.05, 0.18, 90); }
  sfx_place()  { this.tone(210, 'sine', 0.07, 0.2, 150); }
  sfx_arrow()  { this.tone(900, 'sine', 0.2, 0.1, 280); this.noise(0.12, 0.07, 2500, 'highpass'); }
  sfx_fire()   { this.noise(0.5, 0.3, 900, 'lowpass', 0, 200); this.tone(90, 'sawtooth', 0.4, 0.12, 50); }
  sfx_roar()   { this.tone(150, 'sawtooth', 0.8, 0.3, 55); this.noise(0.7, 0.16, 400, 'lowpass', 0.05, 120); }
  sfx_walker() { this.tone(1300, 'sine', 0.65, 0.09, 1900); this.tone(1240, 'sine', 0.7, 0.07, 1760, null, 0.05); }
  sfx_hurt()   { this.tone(160, 'square', 0.14, 0.26, 75); }
  sfx_coin()   { this.tone(880, 'sine', 0.07, 0.16); this.tone(1320, 'sine', 0.1, 0.16, null, 0.07); }
  sfx_pickup() { this.tone(520, 'sine', 0.06, 0.16); this.tone(680, 'sine', 0.09, 0.16, null, 0.06); }
  sfx_heal()   { this.tone(420, 'sine', 0.28, 0.14, 640); }
  sfx_quest()  { this.tone(660, 'triangle', 0.13, 0.16); this.tone(880, 'triangle', 0.22, 0.16, null, 0.11); }
  sfx_night()  { this.tone(72, 'sine', 1.8, 0.2, 52); this.noise(1.4, 0.05, 240, 'lowpass', 0.1, 90); }
  sfx_death()  { this.tone(300, 'sawtooth', 1.1, 0.22, 55); }
  sfx_ui()     { this.tone(520, 'sine', 0.04, 0.08); }
  sfx_levelup() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'sine', 0.12, 0.16, null, i * 0.08));
  }
  sfx_fanfare() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 'triangle', 0.16, 0.18, null, i * 0.13));
    this.tone(1047, 'triangle', 0.55, 0.2, null, 0.52);
  }
}
