import { createNoise2D } from 'simplex-noise';

export function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noise2D: (x: number, y: number) => number;

export function initNoise(seed: number) {
  const rng = mulberry32(seed);
  noise2D = createNoise2D(rng);
}

export function noise(x: number, y: number) {
  return noise2D(x, y);
} 