import { describe, it, expect } from 'vitest';
import { idx, xy, nbr4, nbr8, rowOf, colOf, steps, diagOf, sideCells, halvesOf } from './board';

describe('board geometry', () => {
  it('nbr8 center of 3x3 has 8, corner has 3', () => {
    expect(nbr8(3, 3, 4).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(nbr8(3, 3, 0).sort((a, b) => a - b)).toEqual([1, 3, 4]);
  });

  it('nbr4 corner of 4x5 has 2', () =>
    expect(nbr4(4, 5, 0).sort((a, b) => a - b)).toEqual([1, 4]));

  it('rowOf/colOf exclude self', () => {
    expect(rowOf(4, 3, 5)).toEqual([4, 6, 7]);
    expect(colOf(4, 3, 5)).toEqual([1, 9]);
  });

  it('steps is manhattan', () => expect(steps(4, 0, 11)).toBe(5)); // (0,0)→(3,2)
});

describe('boss-hunt geometry', () => {
  it('diagOf lists both diagonals without the cell', () => {
    expect(diagOf(3, 3, 4)).toEqual([0, 2, 6, 8]);
    expect(diagOf(4, 4, 1)).toEqual([4, 6, 11]);
  });
  it('sideCells takes whole rows/columns on that side', () => {
    expect(sideCells(3, 3, 4, 'up')).toEqual([0, 1, 2]);
    expect(sideCells(3, 3, 4, 'right')).toEqual([2, 5, 8]);
    expect(sideCells(3, 3, 0, 'up')).toEqual([]);
    expect(sideCells(4, 3, 5, 'left')).toEqual([0, 4, 8]);
  });
  it('halvesOf skips the middle column on odd width', () => {
    expect(halvesOf(3, 3)).toEqual([[0, 3, 6], [2, 5, 8]]);
    expect(halvesOf(4, 2)).toEqual([[0, 1, 4, 5], [2, 3, 6, 7]]);
  });
});
