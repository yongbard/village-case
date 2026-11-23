import { test } from 'vitest';
import { crossCheckSlice } from './crossCheck';

test('backtracking equals brute force on 3000 random small cases (2/6)', () => {
  crossCheckSlice(2);
}, 120_000);
