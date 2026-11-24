// 검증 솔버: 일부러 단순하게. inPlay 직업(같은 직업 여럿 가능)의 모든 배치 × 모든 오염 대상 조합을 consistent() 로 거른다.
// 같은 직업은 칸 번호 오름차순으로만 놓아 같은 세계를 한 번씩만 낸다.
// 오염 대상 후보는 -1 과 원천의 범위(adj4 → 이웃 4칸, any → 판 전체). inPlay 칸은 누명 대상(말썽꾼)일 때만.
// 대상이 증인인지·선인지, -1 이 허용되는지, 겹치는지 같은 오염 규칙은 전부 consistent() 가 판정한다.
// 3×4 이하, inPlay 4개 이하에서만 쓴다.
import { nbr4 } from './board';
import { role } from './roles';
import { cellAdmits, consistent } from './rules';
import { witnessValue } from './solve';
import { type Knowledge, type RoleId, type World } from './types';

export function solveBrute(k: Knowledge): World[] {
  const n = k.w * k.h;
  if (n > 12 || k.inPlay.length > 4) throw new Error('solveBrute: too large');
  const inPlay = [...k.inPlay].sort();
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
    const d = role(roles[p]);
    const pool = d.taint === 'adj4' ? nbr4(k.w, k.h, p) : Array.from({ length: n }, (_, q) => q);
    // 속도만을 위해: inPlay 칸은 누명(말썽꾼)일 때만 후보로 둔다. 걸러도 되는지는 consistent 가 다시 판정한다.
    const cand = pool.filter((q) => !used[q] || (d.effect === 'frame' && role(roles[q]).camp === 'trouble'));
    for (const t of [-1, ...cand]) {
      // 속도만을 위해: 앞 원천과 같은 대상은 consistent 가 늘 거절한다
      if (t >= 0 && tainters.slice(0, j).some((q) => taint[q] === t)) continue;
      taint[p] = t;
      tryTaints(tainters, j + 1);
    }
    taint[p] = -1;
  };

  const place = (j: number, from: number): void => {
    if (j === inPlay.length) {
      // 속도만을 위해: 칸별 판정(cellAdmits)은 consistent 의 일부라 오염을 고르기 전에 먼저 걸러도 같다
      for (let i = 0; i < n; i++) if (!used[i] && !cellAdmits(k, i, roles[i])) return;
      const tainters = roles.flatMap((id, i) => (role(id).taint ? [i] : []));
      tryTaints(tainters, 0);
      return;
    }
    const start = j > 0 && inPlay[j] === inPlay[j - 1] ? from : 0;
    for (let i = start; i < n; i++) {
      if (used[i] || !cellAdmits(k, i, inPlay[j])) continue;
      const prev = roles[i];
      used[i] = true;
      roles[i] = inPlay[j];
      place(j + 1, i + 1);
      roles[i] = prev;
      used[i] = false;
    }
  };

  place(0, 0);
  return out;
}
