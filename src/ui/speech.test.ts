import { expect, test } from 'vitest';
import { ROLES } from '../core/roles';
import { speechLines } from './speech';

const text = (id: string, spot?: { w: number; h: number; cell: number }) =>
  Object.fromEntries(speechLines(id, spot).map((l) => [l.label, l.text]));

test('witness shows both truth and lie ranges, with real counts at a corner', () => {
  const t = text('postman', { w: 3, h: 3, cell: 0 });
  expect(t['참말일 때']).toContain('붙은 2칸');
  expect(t['거짓말일 때']).toBe('0 ~ 2명 중 실제와 다른 수를 말합니다.');
  expect(t['세는 법']).toContain('그림자');
  expect(t['세는 법']).toContain('누명');
  expect(t['말투']).toContain('협박');
});

test('pharmacist at an edge counts 5 cells', () => {
  expect(text('pharmacist', { w: 3, h: 3, cell: 1 })['거짓말일 때']).toBe('0 ~ 5명 중 실제와 다른 수를 말합니다.');
});

test('braggart over-states, lost only tells truth from the shifted cell, gossip always wrong', () => {
  const b = text('braggart');
  expect(b['참말일 때']).toBeUndefined();
  expect(b['거짓말일 때']).toContain('큰 수');
  const l = text('lost', { w: 3, h: 3, cell: 2 }); // 오른쪽 끝 → 왼쪽 2번 칸 기준
  expect(l['참말일 때']).toContain('2번 칸 주변 5칸');
  expect(l['거짓말일 때']).toBeUndefined();
  const g = text('gossip');
  expect(g['참말일 때']).toBeUndefined();
  expect(g['거짓말일 때']).toContain('선');
});

test('every new statement shape has truth and lie lines', () => {
  for (const id of ['taxi', 'priest', 'barber', 'laundry', 'dog', 'restaurant', 'grandma', 'operator', 'bellringer']) {
    const t = text(id);
    expect(t['참말일 때'], id).toBeTruthy();
    expect(t['거짓말일 때'], id).toBeTruthy();
  }
  expect(text('priest')['거짓말일 때']).toContain('모두 선');
  expect(text('dog')['거짓말일 때']).toContain('없습니다');
});

test('disguised roles point to the face form; shill tells the truth', () => {
  expect(text('thief')['거짓말 범위']).toBeDefined();
  expect(text('decoy')['거짓말 범위']).toBeDefined();
  expect(text('shill')['거짓말 범위']).toBeUndefined();
  expect(text('reporter')['거짓일 때']).toContain('반대로');
  for (const id of Object.keys(ROLES)) expect(text(id)['말투'], id).toBeTruthy();
});
