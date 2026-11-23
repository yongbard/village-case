// 진술·능력 결과를 화면 문장으로. 칸 번호는 1부터.
import { type AbilityObs, type Clue } from '../core/types';

/** 칸 cell 이 한 진술 c 의 문장 */
export function clueText(c: Clue, cell: number): string {
  switch (c.kind) {
    case 'evil4':
      return `이웃 4칸에 악이 ${c.n}명`;
    case 'evil8':
      return c.base === cell ? `둘레 8칸에 악이 ${c.n}명` : `${c.base + 1}번 칸 둘레 8칸에 악이 ${c.n}명`;
    case 'evilRow':
      return `내 가로줄에 악이 ${c.n}명`;
    case 'evilCol':
      return `내 세로줄에 악이 ${c.n}명`;
    case 'nearest':
      return c.n === 0 ? '악이 아무도 없다' : `가장 가까운 악까지 ${c.n}걸음`;
    case 'pairOne':
      return `${c.a! + 1}번과 ${c.b! + 1}번 중 정확히 한 명이 악`;
    case 'bossRow':
      return `주범은 ${c.n}번째 가로줄에 있다`;
  }
}

/** 시각 계기 전의 진술 자리 */
export function pendingText(trigger: number): string {
  return `${trigger}시간에 말함`;
}

/** 능력 결과 문장 */
export function abilityText(o: AbilityObs): string {
  return `${o.a + 1}번과 ${o.b + 1}번은 ${o.same ? '같은 편' : '다른 편'}`;
}
