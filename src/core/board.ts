import { type Dir } from './types';

/**
 * Convert grid coordinates to linear index (left-to-right, top-to-bottom)
 * @param w grid width
 * @param x column (0-based)
 * @param y row (0-based)
 * @returns linear index (0-based)
 */
export function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

/**
 * Convert linear index to grid coordinates
 * @param w grid width
 * @param i linear index (0-based)
 * @returns [x, y] coordinates (0-based)
 */
export function xy(w: number, i: number): [number, number] {
  return [i % w, Math.floor(i / w)];
}

/**
 * Get 4-neighbors (up, down, left, right) of a cell
 * @param w grid width
 * @param h grid height
 * @param i cell index
 * @returns array of neighbor indices
 */
export function nbr4(w: number, h: number, i: number): number[] {
  const [x, y] = xy(w, i);
  const neighbors: number[] = [];

  // up
  if (y > 0) neighbors.push(idx(w, x, y - 1));
  // down
  if (y < h - 1) neighbors.push(idx(w, x, y + 1));
  // left
  if (x > 0) neighbors.push(idx(w, x - 1, y));
  // right
  if (x < w - 1) neighbors.push(idx(w, x + 1, y));

  return neighbors;
}

/**
 * Get 8-neighbors (all surrounding cells) of a cell
 * @param w grid width
 * @param h grid height
 * @param i cell index
 * @returns array of neighbor indices
 */
export function nbr8(w: number, h: number, i: number): number[] {
  const [x, y] = xy(w, i);
  const neighbors: number[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue; // skip self
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        neighbors.push(idx(w, nx, ny));
      }
    }
  }

  return neighbors;
}

/**
 * Get all cells in the same row as i, excluding i
 * @param w grid width
 * @param h grid height
 * @param i cell index
 * @returns array of indices in same row, excluding i
 */
export function rowOf(w: number, h: number, i: number): number[] {
  const [, y] = xy(w, i);
  const row: number[] = [];
  for (let x = 0; x < w; x++) {
    const index = idx(w, x, y);
    if (index !== i) {
      row.push(index);
    }
  }
  return row;
}

/**
 * Get all cells in the same column as i, excluding i
 * @param w grid width
 * @param h grid height
 * @param i cell index
 * @returns array of indices in same column, excluding i
 */
export function colOf(w: number, h: number, i: number): number[] {
  const [x] = xy(w, i);
  const col: number[] = [];
  for (let y = 0; y < h; y++) {
    const index = idx(w, x, y);
    if (index !== i) {
      col.push(index);
    }
  }
  return col;
}

/** 칸 i 를 지나는 두 대각선 위의 칸 (i 제외, 칸 번호 순) */
export function diagOf(w: number, h: number, i: number): number[] {
  const [x, y] = xy(w, i);
  const out: number[] = [];
  for (let j = 0; j < w * h; j++) {
    const [a, b] = xy(w, j);
    if (j !== i && Math.abs(a - x) === Math.abs(b - y)) out.push(j);
  }
  return out;
}

/** 칸 i 에서 본 한 방향의 칸 전부: up/down 은 위/아래 가로줄 전부, left/right 는 왼쪽/오른쪽 세로줄 전부 (칸 번호 순) */
export function sideCells(w: number, h: number, i: number, dir: Dir): number[] {
  const [x, y] = xy(w, i);
  const out: number[] = [];
  for (let j = 0; j < w * h; j++) {
    const [a, b] = xy(w, j);
    if ((dir === 'up' && b < y) || (dir === 'down' && b > y) || (dir === 'left' && a < x) || (dir === 'right' && a > x)) out.push(j);
  }
  return out;
}

/** 왼쪽 절반과 오른쪽 절반의 칸 (가로 폭이 홀수면 가운데 세로줄 제외) */
export function halvesOf(w: number, h: number): [number[], number[]] {
  const half = Math.floor(w / 2);
  const all = Array.from({ length: w * h }, (_, j) => j);
  return [all.filter((j) => j % w < half), all.filter((j) => j % w >= w - half)];
}

/**
 * Calculate Manhattan distance between two cells
 * @param w grid width
 * @param a first cell index
 * @param b second cell index
 * @returns Manhattan distance
 */
export function steps(w: number, a: number, b: number): number {
  const [x1, y1] = xy(w, a);
  const [x2, y2] = xy(w, b);
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}
