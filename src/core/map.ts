import { noise } from '../utils/random';

// Constants
const MAP_COLS = 80;
const MAP_ROWS = 50;
const BORDER = 4;

type Tile = 0 | 1;
let map: Tile[][] = [];

export function generateMap() {
  map = [];
  const scale = 0.08;
  for (let r = 0; r < MAP_ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      if (r < BORDER || r >= MAP_ROWS - BORDER || c < BORDER || c >= MAP_COLS - BORDER) {
        map[r][c] = 0;
      } else {
        map[r][c] = noise(c * scale, r * scale) > 0 ? 1 : 0;
      }
    }
  }
}

export function isLand(c: number, r: number) {
  return map[r][c] === 1;
}

export function getMap() {
  return map;
} 