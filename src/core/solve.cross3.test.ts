import { test } from 'vitest';
import { crossCheckSlice } from './crossCheck';

test('backtracking equals brute force on 3000 random small cases (3/6)', () => {
  crossCheckSlice(3);
}, 120_000);
