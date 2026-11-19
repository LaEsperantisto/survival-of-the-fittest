// Procedural audio: wind bed + a wandering desert song + event SFX. No assets.
// The score rotates through genres every 90-240 s (bar-aligned). Each switch
// rolls a new genre, a random key and a random mode — bright pools by day,
// lonesome pools by night, with a small chance to break the bias.
// Orthogonal to all that: an instrument layer. Each genre picks a synth voice
// (pluck / saw / breath / bow) that colors every melody note; ~15% of bars
// mid-piece re-roll the voice while the genre and melody keep playing.
type Genre = "drone" | "wanderer" | "nightwind" | "caravan" | "hearth" | "embers";
const DAY_GENRES: Genre[] = ["drone", "wanderer", "wanderer", "caravan", "caravan", "nightwind"];
const NIGHT_GENRES: Genre[] = ["drone", "nightwind", "nightwind", "caravan", "wanderer"];
// Inside a Base the score turns warm: low unhurried material, no drums.
const HEARTH_GENRES: Genre[] = ["hearth", "hearth", "embers", "drone"];
const BAR_LEN: Record<Genre, number> = { drone: 3.2, wanderer: 2.2, nightwind: 4.4, caravan: 2.0, hearth: 3.4, embers: 5.0 };
// Mode pools: intervals in semitones over the current root.
const DAY_MODES = [[0, 4, 7, 9, 12, 16, 19], [0, 2, 4, 7, 9, 12, 14, 16], [0, 2, 5, 7, 9, 12, 14]];
const NIGHT_MODES = [[0, 1, 4, 5, 7, 8, 10, 12], [0, 2, 3, 5, 7, 8, 10, 12], [0, 3, 5, 7, 10, 12, 15]];
const HEARTH_MODES = [[0, 2, 4, 7, 9, 12, 14], [0, 4, 5, 7, 9, 12, 16], [0, 2, 4, 7, 11, 12, 14]];
const ARP = [0, 2, 4, 2, 3, 5, 4, 1];
const ARP_CARAVAN = [0, 0, 3, 2, 4, 3, 2, 0];

// Instrument layer: one voice colors every melodic note of the current bar.
type Voice = "pluck" | "saw" | "breath" | "bow";
const GENRE_VOICE: Record<Genre, Voice> = {
  drone: "saw",      // sustained filtered saw: the desert synth pad
  wanderer: "pluck", // short decaying plucks: strummed strings on the move
  nightwind: "breath", // airy noise bandpass: panpipes in the cold wind
  caravan: "bow",    // slow-attack saw: a long aching caravan fiddle
  hearth: "pluck",   // soft low plucks: firelight strings, close and unhurried
  embers: "bow",     // one long warm note: the fire talking to itself
};
const ALL_VOICES: Voice[] = ["pluck", "saw", "breath", "bow"];

export class Audio {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private musicTimer = 0;
  private nextBar = 0;
  private barCount = 0;
  private musicOn = true;
  private isDay = true;
  private genre: Genre = "drone";
  private genreEnd = 0;                    // audio-clock time of the next style roll
  private voice: Voice = GENRE_VOICE[this.genre]; // current instrument
  private breathBuf: AudioBuffer | null = null;   // white noise for the breath voice
  private root = 98.0;                     // current key's fundamental (Hz)
  private deg: number[] = DAY_MODES[0];    // current mode's intervals
  private noiseBuf: AudioBuffer | null = null;
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
      this.noiseBuf = buf; // reused for the Caravan genre's hand-drums
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 380;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 100; // shallower sweep: a distant moan, not a howl
      lfo.connect(lfoGain).connect(filt.frequency);
      lfo.start();
      this.windFilter = filt; this.windLfoGain = lfoGain;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = this.windLevel();
      src.connect(filt).connect(this.windGain).connect(this.ctx.destination);
      src.start();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.startMusic();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.windGain) this.windGain.gain.value = this.windLevel();
    if (this.ctx && this.musicGain)
      this.musicGain.gain.setTargetAtTime((this.musicOn ? 0.16 : 0) * v, this.ctx.currentTime, 0.4);
  }

  /** Sandstorm: the wind bed roars with the storm (driven every frame). */
  setStorm(i: number) {
    if (i === this.stormI) return;
    this.stormI = i;
    if (this.windGain) this.windGain.gain.value = this.windLevel();
  }
  private stormI = 0;

  // Inside a Base (cosy 0..1 crossfade from the game): the wind bed ducks and
  // muffles behind the walls, the score turns to the hearth pool, and a lit
  // fire crackles close. All three fade in over a few seconds, never snap.
  private cozy = 0;
  private indoors = false;
  private hearthOn = false;
  private hearthTimer = 0;
  private windFilter: BiquadFilterNode | null = null;
  private windLfoGain: GainNode | null = null;

  private windLevel() { return (0.06 + this.stormI * 0.28) * (1 - 0.75 * this.cozy) * this.volume; }

  setCozy(c: number) {
    if (!this.ctx || Math.abs(c - this.cozy) < 0.005) return;
    this.cozy = c;
    if (this.windGain) this.windGain.gain.value = this.windLevel();
    const t = this.ctx.currentTime;
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(380 - 270 * c, t, 0.5); // muffled howl
    if (this.windLfoGain) this.windLfoGain.gain.setTargetAtTime(100 * (1 - 0.6 * c), t, 0.5);
  }

  /** Base state switch: duck the song, re-roll it warm (in) or wild (out) at the next bar. */
  setIndoors(b: boolean) {
    if (b === this.indoors || !this.ctx || !this.musicGain) return;
    this.indoors = b;
    const t = this.ctx.currentTime, lvl = (this.musicOn ? 0.16 : 0) * this.volume;
    this.musicGain.gain.setTargetAtTime(lvl * 0.25, t, 0.9);
    this.musicGain.gain.setTargetAtTime(lvl, t + 2.2, 1.4); // ~3-5 s crossfade
    this.genreEnd = Math.min(this.genreEnd, this.nextBar); // re-roll at the next bar
  }

  /** Crackle layer for a lit fire in the room; ticks are scheduled live while on. */
  setHearth(on: boolean) {
    if (on === this.hearthOn) return;
    this.hearthOn = on;
    if (this.hearthTimer) { clearInterval(this.hearthTimer); this.hearthTimer = 0; }
    if (on && this.ctx) this.hearthTimer = window.setInterval(() => this.crackleBurst(), 260);
  }

  private crackleBurst() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    for (let i = 0, k = 1 + Math.floor(Math.random() * 3); i < k; i++) {
      const at = t + Math.random() * 0.24, big = Math.random() < 0.12;
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.6 + Math.random() * 1.2;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 900 + Math.random() * 2800; bp.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime((big ? 0.035 : 0.006 + Math.random() * 0.01) * this.volume, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (big ? 0.14 : 0.035 + Math.random() * 0.05));
      src.connect(bp).connect(g).connect(this.ctx.destination);
      src.start(at); src.stop(at + 0.2);
    }
  }

  /** On/off ambient score (Settings > Music). */
  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.setTargetAtTime((on ? 0.16 : 0) * this.volume, this.ctx.currentTime, 0.6);
  }

  /** Day/night signal from the game loop: re-rolls the song, retunes the drone. */
  setDay(day: boolean) {
    if (this.isDay === day) return;
    this.isDay = day;
    if (!this.ctx || !this.droneOscs.length) return;
    this.rollGenre(this.ctx.currentTime);
  }

  private startMusic() {
    if (!this.ctx || this.musicGain) return;
    const ctx = this.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 * this.volume : 0;
    this.musicGain.connect(ctx.destination);
    // feedback delay: sparse plucks ring out across the dunes
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.musicGain.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
    // root, fifth and octave drone under everything, always in the current key
    [1, 1.5, 2].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? "sine" : "triangle";
      o.frequency.value = this.root * m; o.detune.value = i * 3 - 3;
      const g = ctx.createGain(); g.gain.value = 0.03 / (i + 1);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.017;
      const lg = ctx.createGain(); lg.gain.value = 0.018;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(this.musicGain!);
      o.start();
      this.droneOscs.push(o);
    });
    this.genreEnd = ctx.currentTime + 90 + Math.random() * 150;
    this.musicTimer = window.setInterval(() => this.compose(), 500);
  }

  // Roll a new genre, key and mode. genreEnd is stamped onto a bar start, so
  // the song never changes key mid-phrase.
  private rollGenre(at: number) {
    const pool = this.indoors ? HEARTH_GENRES : this.isDay ? DAY_GENRES : NIGHT_GENRES;
    let g = pool[Math.floor(Math.random() * pool.length)];
    if (g === this.genre) g = pool[Math.floor(Math.random() * pool.length)];
    this.genre = g;
    this.voice = GENRE_VOICE[g]; // the instrument switches with the genre
    this.root = 55 * 2 ** ((4 + Math.floor(Math.random() * 12)) / 12); // D2..C#3, any of 12
    const modes = this.indoors ? HEARTH_MODES : this.isDay ? DAY_MODES : NIGHT_MODES;
    this.deg = modes[Math.floor(Math.random() * modes.length)];
    this.genreEnd = at + 90 + Math.random() * 150;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.droneOscs.forEach((o, i) => o.frequency.setTargetAtTime(this.root * [1, 1.5, 2][i], t, 5));
    }
  }

  // Lookahead scheduler: keeps ~1.6 s of song queued at all times.
  private compose() {
    if (!this.ctx || !this.musicGain || !this.musicOn) return;
    if (this.nextBar < this.ctx.currentTime - 0.2) this.nextBar = this.ctx.currentTime + 0.3;
    while (this.nextBar < this.ctx.currentTime + 1.6) {
      if (this.nextBar >= this.genreEnd) this.rollGenre(this.nextBar);
      else if (Math.random() < 0.15) this.rerollVoice(); // mid-piece instrument swap
      this.scheduleBar(this.nextBar);
      this.nextBar += BAR_LEN[this.genre];
      this.barCount++;
    }
  }

  private scheduleBar(t: number) {
    const root = this.root, deg = this.deg;
    const n = (oct: number, i: number) =>
      root * oct * 2 ** (deg[((i % deg.length) + deg.length) % deg.length] / 12);
    const bar = BAR_LEN[this.genre];
    switch (this.genre) {
      case "drone": {
        // bass: one long low note per bar; pad: a soft triad over it
        this.note(n(1, 0), t, bar * 0.95, 0.18);
        [0, 2, 4].forEach(i => this.note(n(2, i), t + 0.05, bar * 0.9, 0.03));
        // arpeggio: steady 8-step figure with the odd rest
        for (let s = 0; s < 8; s++) {
          if (Math.random() < 0.15) continue;
          this.note(n(4, ARP[s]), t + (s * bar) / 8, 0.9, 0.12);
        }
        // melody: sparse notes an octave up
        if (Math.random() < 0.6) {
          const m = 1 + Math.floor(Math.random() * 6);
          this.note(n(4, m), t + Math.floor(Math.random() * 5) * (bar / 8), 1.4, 0.13);
        }
        break;
      }
      case "wanderer": {
        // all motion: plucked arpeggio over a short bass ping, no pads
        this.note(n(1, 0), t, bar * 0.55, 0.16);
        for (let s = 0; s < 8; s++) {
          if (Math.random() < 0.1) continue;
          this.note(n(Math.random() < 0.3 ? 3 : 4, ARP[s]), t + (s * bar) / 8, 0.55, 0.12);
        }
        if (Math.random() < 0.7) {
          const m = 1 + Math.floor(Math.random() * 5);
          this.note(n(5, m), t + Math.floor(Math.random() * 6) * (bar / 8), 0.8, 0.11);
        }
        break;
      }
      case "nightwind": {
        // long aching lines over a deep hum; no arpeggio at all
        this.note(n(1, 0), t, bar * 0.95, 0.15);
        if (Math.random() < 0.4) [0, 2, 4].forEach(i => this.note(n(2, i), t + 0.1, bar * 0.85, 0.025));
        const lines = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < lines; k++) {
          const m = Math.floor(Math.random() * deg.length);
          const dur = 1.6 + Math.random() * (bar - 1.2);
          this.note(n(4, m), t + Math.random() * (bar - 1), dur, 0.12);
        }
        break;
      }
      case "caravan": {
        // hand-drums and a driving pentatonic bass
        for (let s = 0; s < 8; s++) {
          if (s === 0 || s === 3 || s === 4) this.drum(t + (s * bar) / 8);
          if (s % 2 === 1) this.brush(t + (s * bar) / 8);
        }
        this.note(n(1, 0), t, bar * 0.45, 0.17);
        this.note(n(1, 3), t + bar / 2, bar * 0.4, 0.14);
        for (let s = 0; s < 8; s++) {
          if (Math.random() < 0.25) continue;
          this.note(n(3, ARP_CARAVAN[s]), t + (s * bar) / 8, 0.4, 0.1);
        }
        if (Math.random() < 0.4) {
          const m = 1 + Math.floor(Math.random() * 4);
          this.note(n(4, m), t + Math.floor(Math.random() * 4) * (bar / 4), 0.7, 0.07);
        }
        break;
      }
      case "hearth": {
        // firelight: a low warm chord, soft plucks a register up, rarely one bright note
        this.note(n(1, 0), t, bar * 0.95, 0.15);
        [0, 2, 4].forEach((i) => this.note(n(2, i), t + 0.08 + i * 0.06, bar * 0.8, 0.035));
        for (let s = 0; s < 4; s++) {
          if (Math.random() < 0.35) continue;
          this.note(n(2, ARP[s * 2]), t + (s * bar) / 4 + Math.random() * 0.12, 0.7, 0.09);
        }
        if (Math.random() < 0.35) this.note(n(3, 1 + Math.floor(Math.random() * deg.length)), t + Math.random() * bar * 0.5, 1.6, 0.07);
        break;
      }
      case "embers": {
        // almost nothing: a deep hum and the occasional long low bowed line
        this.note(n(1, 0), t, bar * 0.98, 0.13);
        if (Math.random() < 0.6) {
          const m = Math.floor(Math.random() * deg.length);
          this.note(n(2, m), t + Math.random() * (bar - 2), 1.8 + Math.random() * 2, 0.09);
        }
        if (Math.random() < 0.3) this.note(n(3, 0), t + bar * 0.5, 0.9, 0.05);
        break;
      }
    }
  }

  // Caravan percussion: a low slide and a brushed hit, both from existing parts.
  private drum(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.22);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.3);
  }
  private brush(t: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random() * 3.9); src.stop(t + 0.1);
  }

  // Mid-piece instrument swap: same genre, same melody, new timbre.
  private rerollVoice() {
    const others = ALL_VOICES.filter(v => v !== this.voice);
    this.voice = others[Math.floor(Math.random() * others.length)];
  }

  // One melodic note, voiced by the current instrument: the voice picks the
  // source (osc/noise), the attack and the decay shape, so the melody is
  // untouched when the instrument changes under it.
  private note(freq: number, t: number, dur: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    switch (this.voice) {
      case "pluck": this.pluckNote(freq, t, dur, gain); break;
      case "saw": this.sawNote(freq, t, dur, gain); break;
      case "breath": this.breathNote(freq, t, dur, gain); break;
      case "bow": this.bowNote(freq, t, dur, gain); break;
    }
  }

  // plucked: near-instant triangle plus a slightly detuned bright partial,
  // both decaying fast — short notes regardless of the written duration.
  private pluckNote(freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const d = Math.min(dur, 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    g.connect(this.musicGain!);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
    o.connect(g); o.start(t); o.stop(t + d + 0.05);
    // comb-ish snap: a 2nd harmonic a hair sharp, dead in a third of the note
    const h = ctx.createOscillator(); h.type = "square"; h.frequency.value = freq * 2.01;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(gain * 0.22, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.08, d * 0.35));
    h.connect(hg).connect(g); h.start(t); h.stop(t + d);
  }

  // saw/synth: sustained sawtooth through a soft lowpass
  private sawNote(freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.8;
    f.frequency.value = Math.min(3200, Math.max(700, freq * 6));
    const g = ctx.createGain();
    this.sustainEnv(g.gain, t, dur, gain * 0.7, 0.09);
    o.connect(f).connect(g).connect(this.musicGain!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // breath: white noise through a narrow bandpass at the pitch (panpipe-ish),
  // doubled by a faint sine fundamental so the note still carries its pitch
  private breathNote(freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    if (!this.breathBuf) {
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * 2, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.breathBuf = buf;
    }
    const src = ctx.createBufferSource(); src.buffer = this.breathBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 10;
    const ng = ctx.createGain();
    this.sustainEnv(ng.gain, t, dur, gain * 1.6, 0.22);
    src.connect(f).connect(ng).connect(this.musicGain!);
    src.start(t, Math.random() * 1.9); src.stop(t + dur + 0.05);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const og = ctx.createGain();
    this.sustainEnv(og.gain, t, dur, gain * 0.8, 0.3);
    o.connect(og).connect(this.musicGain!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // bowed: slow-attack sustained saw with a slow vibrato
  private bowNote(freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 5; // detune cents
    vib.connect(vg).connect(o.detune); vib.start(t); vib.stop(t + dur + 0.05);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.7;
    f.frequency.value = Math.min(2600, Math.max(600, freq * 4));
    const g = ctx.createGain();
    this.sustainEnv(g.gain, t, dur, gain * 0.8, Math.min(0.35, dur * 0.3));
    o.connect(f).connect(g).connect(this.musicGain!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // attack → plateau → release, shared by the sustained voices
  private sustainEnv(p: AudioParam, t: number, dur: number, peak: number, attack: number) {
    const a = Math.min(attack, dur * 0.5);
    const rel = t + a + (dur - a) * 0.75;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, rel);
    p.exponentialRampToValueAtTime(0.001, t + dur);
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
  hurt() {
    // a meaty impact thud plus a low body groan
    this.noiseHit(0.3, 420, 0.38);
    this.blip(95, 0.35, "square", 0.3, -45);
    setTimeout(() => this.blip(175, 0.16, "sawtooth", 0.18, -95), 60);
  }
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
