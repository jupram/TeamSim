export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function createSeededRandom(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function nextSeedState(state: number): [number, number] {
  const nextState = (Math.imul(1664525, state >>> 0) + 1013904223) >>> 0;
  return [nextState, nextState / 4294967296];
}

export function sampleNormal(mean: number, variance: number, random: () => number): number {
  const safeVariance = Math.max(0, variance);
  if (safeVariance === 0) {
    return mean;
  }

  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * Math.sqrt(safeVariance);
}
