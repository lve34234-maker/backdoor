// Deterministic pseudo-random number generator (mulberry32).
// Lets us reproduce a run from a seed while still generating a fresh
// layout for every door when the seed itself is randomised at new-game time.

export class Random {
  constructor(seed) {
    this.seed = seed >>> 0;
    this._state = this.seed || 1;
  }

  static fromString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return new Random(h >>> 0);
  }

  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  bool(chance = 0.5) {
    return this.next() < chance;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weightedPick(entries) {
    // entries: [{ value, weight }]
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  // Derive an independent child RNG for a sub-system (e.g. per-door seed)
  child(salt) {
    return new Random((this._state ^ (Random._hashSalt(salt))) >>> 0);
  }

  static _hashSalt(salt) {
    let h = 0x811c9dc5;
    const s = String(salt);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
