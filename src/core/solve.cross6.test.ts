import { test } from 'vitest';
import { crossCheckSlice } from './crossCheck';

test('backtracking equals brute force on 3000 random small cases (6/6)', () => {
  crossCheckSlice(6);
}, 120_000);
