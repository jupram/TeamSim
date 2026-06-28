import type { Distribution, DistributionType } from "./types";

export const distributionOptions: Array<{ type: DistributionType; label: string }> = [
  { type: "normal", label: "Normal" },
  { type: "uniform", label: "Uniform" },
  { type: "exponential", label: "Exponential" },
  { type: "lognormal", label: "Log-normal" }
];

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

export function sampleDistribution(distribution: Distribution, random: () => number): number {
  const mean = distribution.mean;
  const variance = Math.max(0, distribution.variance);
  if (variance === 0) {
    return mean;
  }

  switch (distribution.type ?? "normal") {
    case "uniform": {
      const halfWidth = Math.sqrt(3 * variance);
      return mean - halfWidth + random() * halfWidth * 2;
    }
    case "exponential": {
      const scale = Math.sqrt(variance);
      const shiftedOrigin = mean - scale;
      return shiftedOrigin - scale * Math.log(Math.max(1 - random(), Number.EPSILON));
    }
    case "lognormal": {
      const safeMean = Math.max(mean, Number.EPSILON);
      const sigmaSquared = Math.log(1 + variance / (safeMean * safeMean));
      const mu = Math.log(safeMean) - sigmaSquared / 2;
      return Math.exp(sampleNormal(mu, sigmaSquared, random));
    }
    case "normal":
    default:
      return sampleNormal(mean, variance, random);
  }
}
