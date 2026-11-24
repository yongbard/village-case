import { expect, test } from 'vitest';
import { ROLES, isEvil } from '../core/roles';
import { ANY_WITNESS } from '../core/types';
import { FALLBACK, PORTRAITS, portraitOf } from './portraits';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

test('every role has its own portrait', () => {
  for (const id of Object.keys(ROLES)) expect(PORTRAITS[id], id).toBeDefined();
  const arts = Object.keys(ROLES).map((id) => PORTRAITS[id].art);
  expect(new Set(arts).size).toBe(arts.length);
  const bgs = Object.keys(ROLES).map((id) => PORTRAITS[id].bg);
  expect(new Set(bgs).size).toBeGreaterThanOrEqual(12);
});

test('portrait markup is plain shapes on a 60x60 box', () => {
  for (const p of [...Object.values(PORTRAITS), FALLBACK]) {
    expect(p.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.art).toMatch(/<(path|circle|ellipse|rect)\b/);
    expect(p.art).not.toMatch(/<svg|<script|<image|href=|on\w+=/i);
  }
});

test('evil portraits sit on darker backgrounds on average', () => {
  const ids = Object.keys(ROLES);
  const avg = (xs: string[]) => xs.reduce((a, id) => a + lum(PORTRAITS[id].bg), 0) / xs.length;
  const evil = ids.filter((id) => isEvil(ROLES[id].camp));
  const witness = ids.filter((id) => ROLES[id].camp === 'witness');
  expect(avg(evil)).toBeLessThan(avg(witness) * 0.85);
});

test('unknown ids and the any-witness fall back to the silhouette', () => {
  expect(portraitOf(ANY_WITNESS)).toBe(FALLBACK);
  expect(portraitOf('nope')).toBe(FALLBACK);
});
