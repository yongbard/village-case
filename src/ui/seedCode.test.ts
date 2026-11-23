import { describe, expect, it } from 'vitest';
import { formatCode, parseCode } from './seedCode';

describe('seedCode', () => {
  it('formats n-seed', () => expect(formatCode({ n: 3, seed: 521449003 })).toBe('3-521449003'));
  it('parses a code', () => expect(parseCode(' 3-521449003 ')).toEqual({ n: 3, seed: 521449003 }));
  it('parses a plain integer as stage 10', () => expect(parseCode('42')).toEqual({ n: 10, seed: 42 }));
  it('round-trips', () => expect(parseCode(formatCode({ n: 12, seed: 0 }))).toEqual({ n: 12, seed: 0 }));
  it('rejects bad input', () => {
    for (const s of ['', 'abc', '12x', '-5', '1.5', '0-5', '3-', '-3-4', '4294967296', '1-4294967296', '1234-5', '1-2-3'])
      expect(parseCode(s), s).toBeNull();
  });
});
