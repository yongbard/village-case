// 검증 솔버: 일부러 단순하게. inPlay 직업의 모든 단사 배치 × 모든 오염 대상 조합을 consistent() 로 거른다.
// 오염 대상 후보는 -1 과, 오염원의 범위(adj4 → 이웃 4칸, any → 판 전체) 중 inPlay 직업이 없는 칸.
// 대상이 증인인지, -1 이 허용되는지 같은 오염 규칙은 전부 consistent() 가 판정한다.
// 3×4 이하, inPlay 4개 이하에서만 쓴다.
import { nbr4 } from './board';
import { role } from './roles';
import { consistent } from './rules';
import { witnessValue } from './solve';
import { type Knowledge, type RoleId, type World } from './types';

export function solveBrute(k: Knowledge): World[] {
  const n = k.w * k.h;
  if (n > 12 || k.inPlay.length > 4) throw new Error('solveBrute: too large');
  const out: World[] = [];
  const roles: RoleId[] = Array.from({ length: n }, (_, i) => witnessValue(k, i));
  const used: boolean[] = Array(n).fill(false);
  const taint: number[] = Array(n).fill(-1);
  const world: World = { roles, taint };

  const tryTaints = (tainters: number[], j: number): void => {
    if (j === tainters.length) {
      if (consistent(k, world)) out.push({ roles: [...roles], taint: [...taint] });
      return;
    }
    const p = tainters[j];
    const pool = role(roles[p]).taint === 'adj4' ? nbr4(k.w, k.h, p) : Array.from({ length: n }, (_, q) => q);
    for (const t of [-1, ...pool.filter((q) => !used[q])]) {
      taint[p] = t;
      tryTaints(tainters, j + 1);
    }
    taint[p] = -1;
  };

  const place = (j: number): void => {
    if (j === k.inPlay.length) {
      const tainters = roles.flatMap((id, i) => (role(id).taint ? [i] : []));
      tryTaints(tainters, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const prev = roles[i];
      used[i] = true;
      roles[i] = k.inPlay[j];
      place(j + 1);
      roles[i] = prev;
      used[i] = false;
    }
  };

  place(0);
  return out;
}
