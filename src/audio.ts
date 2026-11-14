// Procedural audio: wind bed + event SFX. No assets, no music.

export class Audio {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
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
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.windGain) this.windGain.gain.value = 0.12 * v;
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
