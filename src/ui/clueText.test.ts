import { expect, test } from 'vitest';
import { abilityText, clueMarks, clueText, confessionText, pendingText } from './clueText';

// 3×3 판, 5번 칸(0부터 4)이 말할 때
test('count statements name every counted cell', () => {
  expect(clueText({ kind: 'evil4', base: 4, n: 1 }, 4, 3, 3, 'postman')).toBe('배달 돌며 봤어요. 우리 집 위아래 양옆(2·4·6·8번)에서 수상한 사람을 1명 봤어요.');
  expect(clueText({ kind: 'evil4', base: 0, n: 0 }, 0, 3, 3, 'postman')).toBe('배달 돌며 봤어요. 우리 집 위아래 양옆(2·4번)에서 수상한 사람은 못 봤어요.');
  expect(clueText({ kind: 'evil8', base: 4, n: 2 }, 4, 3, 3, 'pharmacist')).toBe('약 사러 온 이웃 얘기예요. 우리 집 둘레(1·2·3·4·6·7·8·9번)에 수상한 사람이 2명 있어요.');
  expect(clueText({ kind: 'evilRow', base: 4, n: 1 }, 4, 3, 3, 'mayor')).toBe('반상회 명부 기준이에요. 우리 가로줄(4·6번)에 수상한 사람이 1명 있어요.');
  expect(clueText({ kind: 'evilCol', base: 4, n: 0 }, 4, 3, 3, 'guard')).toBe('순찰 기록이에요. 우리 세로줄(2·8번)에는 수상한 사람이 없어요.');
  expect(clueText({ kind: 'diag', base: 4, n: 1 }, 4, 3, 3, 'taxi')).toBe('택시로 대각선 길을 달렸어요. 우리 집 대각선 길(1·3·7·9번)에서 수상한 사람을 1명 봤어요.');
  expect(clueText({ kind: 'evil8', base: 5, n: 4 }, 4, 3, 3, 'braggart')).toBe('내가 다 봤다니까! 6번 집 둘레(2·3·5·8·9번)에 수상한 사람이 4명 있어요.');
  expect(clueText({ kind: 'evil8', base: 5, n: 0 }, 4, 3, 3, 'lost')).toBe('우리 집 근처 얘기예요. 6번 집 둘레(2·3·5·8·9번)에 수상한 사람은 없어요.'); // 길치: 옆집 기준 칸
});

test('distance, relation and boss statements', () => {
  expect(clueText({ kind: 'nearest', base: 4, n: 2 }, 4, 3, 3, 'baker')).toBe('새벽 배달 길 기준이에요. 제일 가까운 수상한 사람은 우리 집에서 위아래·양옆으로 2칸 가야 있어요.');
  expect(clueText({ kind: 'nearest', base: 4, n: 0 }, 4, 3, 3, 'baker')).toBe('새벽 배달 길 기준이에요. 저 말고는 수상한 사람이 없어요.');
  expect(clueText({ kind: 'pairOne', base: 4, a: 2, b: 6 }, 4, 3, 3, 'photographer')).toBe('사진을 현상해 봤어요. 3번과 7번 중 딱 1명만 수상해요.');
  expect(clueText({ kind: 'atLeastOne', base: 4, cells: [0, 5, 7] }, 4, 3, 3, 'priest')).toBe('고해를 들었어요. 1·6·8번 중에 수상한 사람이 적어도 1명 있어요.');
  expect(clueText({ kind: 'adjPair', base: 4, n: 1 }, 4, 3, 3, 'barber')).toBe('손님들 얘기를 들었어요. 수상한 사람끼리 위아래나 양옆으로 붙어 사는 집이 있어요.');
  expect(clueText({ kind: 'adjPair', base: 4, n: 0 }, 4, 3, 3, 'barber')).toBe('손님들 얘기를 들었어요. 수상한 사람끼리 위아래나 양옆으로 붙어 사는 집이 없어요.');
  expect(clueText({ kind: 'halves', base: 4, n: 1 }, 4, 3, 3, 'laundry')).toBe('맡긴 옷들을 세어 봤어요. 수상한 사람은 왼쪽(1·4·7번)보다 오른쪽(3·6·9번)에 더 많아요.');
  expect(clueText({ kind: 'halves', base: 4, n: -1 }, 4, 3, 3, 'laundry')).toBe('맡긴 옷들을 세어 봤어요. 수상한 사람은 오른쪽(3·6·9번)보다 왼쪽(1·4·7번)에 더 많아요.');
  expect(clueText({ kind: 'halves', base: 4, n: 0 }, 4, 3, 3, 'laundry')).toBe('맡긴 옷들을 세어 봤어요. 왼쪽(1·4·7번)과 오른쪽(3·6·9번)에 수상한 사람 수가 같아요.');
  expect(clueText({ kind: 'bossDir', base: 4, dir: 'up' }, 4, 3, 3, 'dog')).toBe('개가 짖은 쪽이에요. 제 위쪽(1·2·3번)에서 주범을 봤어요.');
  expect(clueText({ kind: 'bossDir', base: 4, dir: 'right' }, 4, 3, 3, 'dog')).toBe('개가 짖은 쪽이에요. 제 오른쪽(3·6·9번)에서 주범을 봤어요.');
  expect(clueText({ kind: 'alibi', base: 4, a: 5 }, 4, 3, 3, 'restaurant')).toBe('6번은 밤새 우리 가게에 있었어요. 6번은 수상한 사람이 아니에요.');
  expect(clueText({ kind: 'accuse', base: 4, a: 7 }, 4, 3, 3, 'grandma')).toBe('8번이 밤마다 수상하게 나가던데. 8번은 수상한 사람이에요.');
  expect(clueText({ kind: 'accuse', base: 4, a: 6 }, 4, 3, 3, 'gossip')).toBe('들은 얘기예요~ 7번은 수상한 사람이에요.');
  expect(clueText({ kind: 'bossDir', base: 5, dir: 'up' }, 4, 3, 3, 'dog')).toBe('개가 짖은 쪽이에요. 6번 집 위쪽(1·2·3번)에서 주범을 봤어요.'); // 기준 칸이 남의 집
  expect(clueText({ kind: 'sameSide', base: 4, a: 2, b: 6 }, 4, 3, 3, 'operator')).toBe('3번과 7번은 밤마다 통화해요. 3번과 7번은 같은 편이에요.');
  expect(clueText({ kind: 'bossRow', base: 4, r: 2, n: 1 }, 4, 3, 3, 'bellringer')).toBe('종탑에서 봤어요. 위에서 2번째 가로줄(4·5·6번)에 주범이 1명 있어요.');
  expect(clueText({ kind: 'bossRow', base: 4, r: 3, n: 0 }, 4, 3, 3, 'bellringer')).toBe('종탑에서 봤어요. 위에서 3번째 가로줄(7·8·9번)에 주범은 없어요.');
});

test('same sentence whatever the speaker’s true role', () => {
  // clueText 는 진짜 직업을 받지 않는다: 같은 진술·겉 직업이면 문장이 같다
  const c = { kind: 'evil4' as const, base: 4, n: 2 };
  expect(clueText(c, 4, 3, 3, 'postman')).toBe(clueText({ ...c }, 4, 3, 3, 'postman'));
  expect(clueText.length).toBe(5);
});

test('pending trigger, ability result and confession', () => {
  expect(pendingText(12)).toBe('12시간에 말함');
  expect(abilityText({ cell: 0, a: 1, b: 4, same: true }, 'reporter')).toBe('취재해 보니 2번과 5번은 같은 편이에요.');
  expect(abilityText({ cell: 0, a: 1, b: 4, same: false }, 'reporter')).toBe('취재해 보니 2번과 5번은 다른 편이에요.');
  expect(confessionText({ cell: 0, decoy: true, col: 3 }, 3, 3)).toBe('자백: 나는 대역이었소. 주범 중 1명은 왼쪽에서 3번째 세로줄(3·6·9번)에 있소.');
  expect(confessionText({ cell: 0, decoy: false, col: 1 }, 3, 3)).toBe('자백: 주범 중 1명은 왼쪽에서 1번째 세로줄(1·4·7번)에 있소.');
  expect(confessionText({ cell: 0, decoy: false, col: null }, 3, 3)).toBe('자백: 아무것도 모르오.');
});

test('clueMarks: cells a statement points at, with a link for two-person relations', () => {
  expect(clueMarks({ kind: 'sameSide', base: 4, a: 2, b: 6 }, 3, 3)).toEqual({ cells: [2, 6], link: [2, 6] });
  expect(clueMarks({ kind: 'pairOne', base: 4, a: 0, b: 8 }, 3, 3)).toEqual({ cells: [0, 8], link: [0, 8] });
  expect(clueMarks({ kind: 'evil4', base: 4, n: 1 }, 3, 3)).toEqual({ cells: [1, 3, 5, 7] });
  expect(clueMarks({ kind: 'alibi', base: 4, a: 5 }, 3, 3)).toEqual({ cells: [5] });
  expect(clueMarks({ kind: 'bossRow', base: 4, r: 1, n: 1 }, 3, 3)).toEqual({ cells: [0, 1, 2] });
  expect(clueMarks({ kind: 'halves', base: 4, n: 0 }, 3, 3)).toEqual({ cells: [0, 2, 3, 5, 6, 8] });
  expect(clueMarks({ kind: 'adjPair', base: 4, n: 1 }, 3, 3)).toEqual({ cells: [] });
  expect(clueMarks({ kind: 'nearest', base: 4, n: 1 }, 3, 3)).toEqual({ cells: [1, 3, 5, 7] });
});
