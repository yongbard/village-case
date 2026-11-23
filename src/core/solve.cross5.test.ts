import { test } from 'vitest';
import { crossCheckSlice } from './crossCheck';

test('backtracking equals brute force on 3000 random small cases (5/6)', () => {
  crossCheckSlice(5);
}, 120_000);
