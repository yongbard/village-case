import { test } from 'vitest';
import { crossCheckSlice } from './crossCheck';

test('backtracking equals brute force on 3000 random small cases (4/6)', () => {
  crossCheckSlice(4);
}, 120_000);
