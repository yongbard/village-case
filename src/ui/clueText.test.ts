import { expect, test } from 'vitest';
import { abilityText, clueText, pendingText } from './clueText';

test('clue text per kind, 1-based cells', () => {
  expect(clueText({ kind: 'evil4', base: 0, n: 1 }, 0)).toBe('이웃 4칸에 악이 1명');
  expect(clueText({ kind: 'evil8', base: 4, n: 2 }, 4)).toBe('둘레 8칸에 악이 2명');
  expect(clueText({ kind: 'evil8', base: 5, n: 0 }, 4)).toBe('6번 칸 둘레 8칸에 악이 0명'); // 길치
  expect(clueText({ kind: 'evilRow', base: 2, n: 1 }, 2)).toBe('내 가로줄에 악이 1명');
  expect(clueText({ kind: 'evilCol', base: 2, n: 0 }, 2)).toBe('내 세로줄에 악이 0명');
  expect(clueText({ kind: 'nearest', base: 3, n: 2 }, 3)).toBe('가장 가까운 악까지 2걸음');
  expect(clueText({ kind: 'nearest', base: 3, n: 0 }, 3)).toBe('악이 아무도 없다');
  expect(clueText({ kind: 'pairOne', base: 1, a: 0, b: 8 }, 1)).toBe('1번과 9번 중 정확히 한 명이 악');
  expect(clueText({ kind: 'bossRow', base: 7, n: 3 }, 7)).toBe('주범은 3번째 가로줄에 있다');
});

test('pending trigger and ability result', () => {
  expect(pendingText(12)).toBe('12시간에 말함');
  expect(abilityText({ cell: 0, a: 1, b: 4, same: true })).toBe('2번과 5번은 같은 편');
  expect(abilityText({ cell: 0, a: 1, b: 4, same: false })).toBe('2번과 5번은 다른 편');
});
