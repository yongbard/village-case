import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { expect, test } from 'vitest';
import { readNames } from './fontName';

const FONTS = fileURLToPath(new URL('../public/fonts/', import.meta.url));
// 나눔 라이선스(OFL)의 예약 이름: 부분 집합(수정본)은 이 이름을 글꼴 이름으로 쓸 수 없다
const RESERVED = /nanum|나눔/i;

test('served handwriting subset is renamed away from the reserved Nanum names', async () => {
  const sfnt = await subsetFont(readFileSync(join(FONTS, 'hand-pen.woff2')), 'a', { targetFormat: 'truetype' });
  const names = readNames(sfnt).filter((n) => [1, 4, 6, 16].includes(n.nameID));
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter((n) => RESERVED.test(n.value))).toEqual([]);
  expect(names.find((n) => n.nameID === 1)?.value).toBe('Village Hand');
});

test('font css does not use a reserved name', () => {
  const css = readFileSync(fileURLToPath(new URL('../ui/fonts.css', import.meta.url)), 'utf8');
  expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(RESERVED);
});

test('served body subsets are renamed away from the reserved Plex name', async () => {
  for (const file of ['sans-500.woff2', 'sans-700.woff2']) {
    const sfnt = await subsetFont(readFileSync(join(FONTS, file)), 'a', { targetFormat: 'truetype' });
    const names = readNames(sfnt).filter((n) => [1, 4, 6, 16].includes(n.nameID));
    expect(names.filter((n) => /plex/i.test(n.value)), file).toEqual([]);
    expect(names.find((n) => n.nameID === 1)?.value, file).toBe('Village Sans');
  }
});
