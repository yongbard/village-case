import { expect, test } from 'vitest';
import { speechLines } from './speech';

const text = (id: string, spot?: { w: number; h: number; cell: number }) =>
  Object.fromEntries(speechLines(id, spot).map((l) => [l.label, l.text]));

test('witness shows both truth and lie ranges, with real counts at a corner', () => {
  const t = text('postman', { w: 3, h: 3, cell: 0 });
  expect(t['참말일 때']).toContain('붙은 2칸');
  expect(t['거짓말일 때']).toBe('0 ~ 2명 중 실제와 다른 수를 말합니다.');
  expect(t['세는 법']).toContain('그림자');
});

test('pharmacist at an edge counts 5 cells', () => {
  expect(text('pharmacist', { w: 3, h: 3, cell: 1 })['거짓말일 때']).toBe('0 ~ 5명 중 실제와 다른 수를 말합니다.');
});

test('braggart only lies, lost only tells truth from the shifted cell', () => {
  const b = text('braggart');
  expect(b['참말일 때']).toBeUndefined();
  expect(b['거짓말일 때']).toBeDefined();
  const l = text('lost', { w: 3, h: 3, cell: 2 }); // 오른쪽 끝 → 왼쪽 2번 칸 기준
  expect(l['참말일 때']).toContain('2번 칸 주변 5칸');
  expect(l['거짓말일 때']).toBeUndefined();
});

test('disguised roles point to the face form; gossip has no statement', () => {
  expect(text('thief')['거짓말 범위']).toBeDefined();
  expect(text('shill')['거짓말 범위']).toBeUndefined();
  expect(text('smooth')['거짓말 범위']).toBeDefined();
  expect(text('gossip')['말투']).toBe('진술이 없습니다.');
  expect(text('hidden')['거짓말 범위']).toBeUndefined();
  expect(text('reporter')['거짓일 때']).toContain('반대로');
});
