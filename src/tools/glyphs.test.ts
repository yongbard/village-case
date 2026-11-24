import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { displayGlyphs } from './glyphs';

const SRC = fileURLToPath(new URL('..', import.meta.url));

test('every displayable glyph is in the font subset (run npm run fonts if this fails)', () => {
  const have = new Set(readFileSync(join(SRC, 'public', 'fonts', 'glyphs.txt'), 'utf8'));
  const missing = [...displayGlyphs(SRC)].filter((c) => !have.has(c));
  expect(missing.join('')).toBe('');
});

test('glyph set has printable ASCII and the game title', () => {
  const g = displayGlyphs(SRC);
  for (const c of '0123456789-~·?!()마을수사록체포오인') expect(g).toContain(c);
});
