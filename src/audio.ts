// Procedural audio: wind bed + generative ambient score + event SFX. No assets.

const DAY_SCALE = [196.0, 220.0, 246.9, 293.7, 329.6, 392.0];        // G pentatonic-ish, bright
const NIGHT_SCALE = [147.0, 164.8, 196.0, 220.0, 261.6, 293.7];      // D minor pentatonic, lonesome

export class Audio {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private musicTimer = 0;
  private musicOn = true;
  private isDay = true;
  volume = 0.7;
  private heartTimer = 0;

  resume() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const sr = this.ctx.sampleRate;
      // pink-ish wind noise, looped
      const buf = this.ctx.createBuffer(1, sr * 4, sr);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + 0.01 * w; b1 = 0.96 * b1 + 0.04 * w;
        d[i] = (b0 + b1) * 2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 380;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain).connect(filt.frequency);
      lfo.start();
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.12 * this.volume;
      src.connect(filt).connect(this.windGain).connect(this.ctx.destination);
      src.start();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.startMusic();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.windGain) this.windGain.gain.value = 0.12 * v;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.setTargetAtTime((this.musicOn ? 0.09 : 0) * v, this.ctx.currentTime, 0.4);
  }

  /** On/off ambient score (Settings > Music). */
  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.setTargetAtTime((on ? 0.09 : 0) * this.volume, this.ctx.currentTime, 0.6);
  }

  /** Day/night signal from the game loop: retunes the drone. */
  setDay(day: boolean) {
    if (this.isDay === day) return;
    this.isDay = day;
    if (!this.ctx || !this.droneOscs.length) return;
    const t = this.ctx.currentTime;
    const roots = day ? [98, 147, 196] : [73.4, 110, 147];
    this.droneOscs.forEach((o, i) => o.frequency.setTargetAtTime(roots[i], t, 5));
  }

  private startMusic() {
    if (!this.ctx || this.musicGain) return;
    const ctx = this.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.09 * this.volume : 0;
    this.musicGain.connect(ctx.destination);
    // feedback delay: sparse plucks ring out across the dunes
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.musicGain.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
    const roots = this.isDay ? [98, 147, 196] : [73.4, 110, 147];
    roots.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? "sine" : "triangle";
      o.frequency.value = f; o.detune.value = i * 3 - 3;
      const g = ctx.createGain(); g.gain.value = 0.03 / (i + 1);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.017;
      const lg = ctx.createGain(); lg.gain.value = 0.018;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(this.musicGain!);
      o.start();
      this.droneOscs.push(o);
    });
    this.musicTimer = window.setInterval(() => this.musicBar(), 2600);
  }

  // A slow, sparse random walk over a pentatonic scale: the score breathes with
  // long silences, bright by day, lonesome at night.
  private musicBar() {
    if (!this.ctx || !this.musicGain || !this.musicOn) return;
    if (Math.random() < 0.35) return;
    const scale = this.isDay ? DAY_SCALE : NIGHT_SCALE;
    const f = scale[Math.floor(Math.random() * scale.length)];
    const t = this.ctx.currentTime + 0.05;
    const o = this.ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const o2 = this.ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.001;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    const g2 = this.ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.musicGain);
    o.start(t); o.stop(t + 2); o2.start(t); o2.stop(t + 2);
    if (Math.random() < 0.3) setTimeout(() => this.musicBar(), 900 + Math.random() * 900);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.2, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  private noiseHit(dur: number, freq: number, gain = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain * this.volume;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  tick() { this.noiseHit(0.06, 900, 0.14); }          // mining tick
  blockBreak() { this.noiseHit(0.2, 500, 0.3); }      // block broken
  place() { this.blip(320, 0.07, "square", 0.12); }
  door() { this.blip(180, 0.25, "sawtooth", 0.12, -80); }
  drink() { this.blip(240, 0.18, "sine", 0.18, 120); }
  pickup() { this.blip(660, 0.1, "sine", 0.16, 200); }
  savePing() { this.blip(880, 0.35, "sine", 0.2, 220); }
  error() { this.blip(140, 0.2, "square", 0.12, -40); }
  hurt() { this.blip(110, 0.25, "triangle", 0.3, -30); }
  death() { this.blip(90, 1.2, "sawtooth", 0.35, -60); }
  warn() { this.blip(640, 0.4, "square", 0.14, -160); setTimeout(() => this.blip(640, 0.4, "square", 0.14, -160), 500); }
  thud() { this.noiseHit(0.35, 200, 0.35); }
  win() { [520, 660, 780, 1040].forEach((f, i) => setTimeout(() => this.blip(f, 0.28, "sine", 0.2, 30), i * 170)); }

  heartbeat(dt: number, health: number) {
    if (health <= 0 || health > 30) return;
    this.heartTimer -= dt;
    if (this.heartTimer <= 0) {
      this.heartTimer = 0.9 + health / 30;
      this.blip(55, 0.12, "sine", 0.4);
      setTimeout(() => this.blip(50, 0.1, "sine", 0.25), 140);
    }
  }
}
