// 템플릿 증상(알약·둥근 상자, 왼쪽 색 띠, 동그라미)이 style.css 에 다시 생기지 않게 막는다
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test('no pills or rounded boxes', () => {
  expect(css.match(/border-radius:\s*(999px|[5-9]px|\d{2,}px)[^;]*/g) ?? []).toEqual([]);
});
test('no one-sided thick stripes', () => {
  expect(css.match(/border-left(-width)?:\s*[3-9]px[^;]*/g) ?? []).toEqual([]);
});
test('only pins are round', () => {
  // 판 위 칸을 두르는 손으로 그린 빨간 동그라미(.cell.…::after)는 판의 일부라 그대로 둔다
  const round = rules.filter((r) => /border-radius:\s*50%/.test(r.body)).map((r) => r.sel);
  expect(round.filter((s) => !/pin/.test(s) && !/^(\.cell\.[\w-]+::after,?\s*)+$/.test(s))).toEqual([]);
});
test('every design token is used', () => {
  // --paper-line·--paper-deep·--wood·--pin 은 이 검사 전부터 안 쓰였다 (지우지 않고 둔다)
  const declared = [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
  const unused = declared.filter((t) => !css.includes(`var(${t}`) && !['--paper-line', '--paper-deep', '--wood', '--pin'].includes(t));
  expect([...new Set(unused)]).toEqual([]);
});
