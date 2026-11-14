// Deterministic hash-based noise. Same seed string -> same world on any device.

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number { // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number { return t * t * (3 - 2 * t); }

export function value2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm2(x: number, y: number, seed: number, oct = 4, lac = 2, gain = 0.5): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += value2(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm; // 0..1
}

export function ridge2(x: number, y: number, seed: number, oct = 3): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = Math.abs(value2(x * freq, y * freq, seed + i * 101) * 2 - 1);
    sum += (1 - n) * amp; norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm; // 0..1, ridged
}

export function noise1(t: number, seed: number): number {
  const x = Math.floor(t), f = smooth(t - x);
  const a = hash2(x, 0, seed), b = hash2(x + 1, 0, seed);
  return a + (b - a) * f; // 0..1
}
