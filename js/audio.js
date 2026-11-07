// Synthesised sound (no audio files needed)
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.7; this.crowdOn = true; this.amb = null; this.musicVol = 0.5; this.musicMode = 'menu'; this.musicTimer = null; this.step = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
    this.noise = buf;
    // ambient crowd
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6;
    this.ambG = c.createGain(); this.ambG.gain.value = this.crowdOn ? 0.16 : 0;
    src.connect(f); f.connect(this.ambG); this.ambG.connect(this.master); src.start(); this.ambF = f;
    this.musicG = c.createGain(); this.musicG.gain.value = this.musicVol * 0.5;
    const comp = c.createDynamicsCompressor(); this.musicG.connect(comp); comp.connect(this.master);
    this.startMusic(this.musicMode);
  }
  setMusicVol(v) { this.musicVol = v; if (this.musicG) this.musicG.gain.value = v * 0.5; }
  setMusicMode(m) { this.musicMode = m; }
  startMusic(mode) {
    if (mode) this.musicMode = mode; if (!this.ctx || this.musicTimer) return;
    this.nextT = this.ctx.currentTime + 0.15; this.step = 0;
    this.musicTimer = setInterval(() => { while (this.nextT < this.ctx.currentTime + 0.35) { this._mstep(this.step++, this.nextT); this.nextT += 60 / 116 / 4; } }, 90);
  }
  _mnote(f, t, dur, type, gain, cutoff = 2400, dest = this.musicG) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  _mstep(s, t) {
    if (this.musicVol <= 0.001) return;
    const c = this.ctx, st = s % 16, bar = Math.floor(s / 16) % 8, m = this.musicMode === 'match';
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G
    const ch = chords[bar % 4], root = ch[0] - 12;
    if (st === 0) for (const n of ch) { this._mnote(hz(n), t, 60 / 116 * 4 * 0.98, 'sawtooth', m ? 0.05 : 0.07, 900); this._mnote(hz(n) * 1.004, t, 60 / 116 * 4 * 0.98, 'sawtooth', m ? 0.04 : 0.05, 900); }
    if (st % 2 === 0) this._mnote(hz(root + (st % 8 === 6 ? 7 : 0)), t, 0.2, 'square', m ? 0.11 : 0.06, 520);
    const arp = [0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 2, 1, 2][st];
    this._mnote(hz(ch[arp] + 12 + (bar >= 4 ? 12 : 0)), t, 0.16, 'triangle', m ? 0.12 : 0.1, 3200);
    if (bar >= 4 && st % 4 === 2) this._mnote(hz(ch[2] + 24), t, 0.3, 'sine', 0.06, 5000); // lead sparkle
    if (st % 4 === 0) { // kick
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(m ? 0.9 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + 0.2);
    }
    if (m && this.noise) {
      const hit = (fq, gain, dur, type) => { const sN = c.createBufferSource(); sN.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = fq; const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); sN.connect(f); f.connect(g); g.connect(this.musicG); sN.start(t, Math.random() * 2); sN.stop(t + dur + 0.02); };
      if (st === 4 || st === 12) hit(1800, 0.5, 0.14, 'bandpass');
      if (st % 2 === 0) hit(7000, 0.18, 0.04, 'highpass');
    }
  }
  stinger() { if (!this.ctx) return; const t = this.ctx.currentTime; [69, 72, 76, 81].forEach((n, i) => this._mnote(440 * Math.pow(2, (n - 69) / 12), t + i * 0.09, 0.9, 'sawtooth', 0.12, 3500)); }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setCrowd(on) { this.crowdOn = on; if (this.ambG) this.ambG.gain.value = on ? 0.16 : 0; }
  _noise(dur, freq, q, gain, attack = 0.02, type = 'bandpass', delay = 0) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  _tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  kick(power = 1) { this._tone(150, 45, 0.16, 0.9 * (0.5 + power * 0.5)); this._noise(0.1, 1800, 0.8, 0.5 * power); }
  whistle() { this._tone(2900, 3100, 0.45, 0.12, 'sine'); this._tone(3000, 3250, 0.45, 0.1, 'sine', 0.0); }
  net() { this._noise(0.45, 900, 0.5, 0.35, 0.01); }
  post() { this._tone(900, 700, 0.5, 0.35, 'triangle'); this._tone(1350, 1000, 0.4, 0.15, 'sine'); }
  save() { this._noise(0.12, 600, 1, 0.55); this._tone(120, 60, 0.12, 0.5); }
  roar(big = 1) {
    if (!this.ctx) return; const c = this.ctx;
    if (this.ambG) { const t = c.currentTime; this.ambG.gain.cancelScheduledValues(t); this.ambG.gain.setValueAtTime(this.ambG.gain.value, t); this.ambG.gain.linearRampToValueAtTime(this.crowdOn ? 0.5 * big : 0, t + 0.25); this.ambG.gain.linearRampToValueAtTime(this.crowdOn ? 0.16 : 0, t + 4.5); }
    this.stinger(); this._noise(3.4, 700, 0.5, 0.45 * big, 0.3); this._noise(3.0, 1500, 0.7, 0.2 * big, 0.2);
  }
  groan() {
    if (!this.ctx) return; const c = this.ctx;
    if (this.ambG && this.crowdOn) { const t = c.currentTime; this.ambG.gain.cancelScheduledValues(t); this.ambG.gain.setValueAtTime(this.ambG.gain.value, t); this.ambG.gain.linearRampToValueAtTime(0.3, t + 0.2); this.ambG.gain.linearRampToValueAtTime(0.16, t + 2.5); }
    this._noise(1.8, 300, 0.7, 0.3, 0.2, 'lowpass');
  }
  tick() { this._tone(900, 900, 0.04, 0.12, 'square'); }
  click() { this._tone(600, 900, 0.06, 0.1, 'triangle'); }
}
