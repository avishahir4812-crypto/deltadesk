/**
 * Deterministic pseudo-random utilities.
 * The entire simulated market is derived from string seeds (symbol + day),
 * so every user sees the same "market" at the same moment.
 */

export function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngOf(key: string): Rng {
  return mulberry32(hash32(key));
}

/** Standard normal sample via Box-Muller. */
export function gauss(r: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
