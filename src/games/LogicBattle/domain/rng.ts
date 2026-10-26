// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/rng.ts — PRNG Determinístico (Mulberry32)
// Puro: zero I/O, zero Math.random(), 100% reproduzível via ?seed=
// ──────────────────────────────────────────────────────────────────────────────

export interface SeededRng {
  readonly initialSeed: number
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
  pick: <T>(items: readonly T[]) => T
  shuffle: <T>(items: readonly T[]) => T[]
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number): SeededRng {
  const nextFloat = mulberry32(seed)

  const nextInt = (minInclusive: number, maxInclusive: number): number => {
    const lo = Math.ceil(Math.min(minInclusive, maxInclusive))
    const hi = Math.floor(Math.max(minInclusive, maxInclusive))
    return Math.floor(nextFloat() * (hi - lo + 1)) + lo
  }

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error('SeededRng.pick: empty array')
    }
    return items[Math.floor(nextFloat() * items.length)]
  }

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(nextFloat() * (i + 1))
      const tmp = copy[i]
      copy[i] = copy[j]
      copy[j] = tmp
    }
    return copy
  }

  return {
    initialSeed: seed >>> 0,
    nextFloat,
    nextInt,
    pick,
    shuffle,
  }
}
