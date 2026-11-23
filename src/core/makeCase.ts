import { nbr4, nbr8 } from './board';
import { pick, type Rng } from './rng';
import { role } from './roles';
import { clueFact, modeAt } from './rules';
import { ANY_WITNESS, type Clue, type RoleId, type World } from './types';

/** 오염원마다 대상 칸을 고른다: 대상이 될 수 있는 진짜 증인 중 무작위, 없으면 -1. 오염원이 아니면 -1. */
export function assignTaint(r: Rng, w: number, h: number, roles: RoleId[]): number[] {
  const n = w * h;
  return roles.map((id, i) => {
    const t = role(id).taint;
    if (!t) return -1;
    const pool = t === 'adj4' ? nbr4(w, h, i) : Array.from({ length: n }, (_, j) => j);
    const eligible = pool.filter((j) => j !== i && role(roles[j]).camp === 'witness');
    return eligible.length > 0 ? pick(r, eligible) : -1;
  });
}

/** 겉 직업: 진짜 증인은 자기 직업, 말썽꾼(self)은 자기 직업, 숨은이·공범·주범은 증인 직업 중 무작위 */
export function makeFaces(r: Rng, truth: World, witnessPool: RoleId[]): RoleId[] {
  return truth.roles.map((id) => {
    const def = role(id);
    if (def.camp === 'witness') return id === ANY_WITNESS ? pick(r, witnessPool) : id;
    const disguises = def.camp === 'accomplice' || def.camp === 'boss' || def.face === 'witness';
    return disguises ? pick(r, witnessPool) : id;
  });
}

/** 숫자 진술의 가능한 값 범위 [lo, hi] */
function range(w: number, h: number, kind: Clue['kind'], base: number): [number, number] {
  switch (kind) {
    case 'evil4': return [0, nbr4(w, h, base).length];
    case 'evil8': return [0, nbr8(w, h, base).length];
    case 'evilRow': return [0, w - 1];
    case 'evilCol': return [0, h - 1];
    case 'nearest': return [0, w + h - 2];
    case 'bossRow': return [1, h];
    case 'pairOne': throw new Error('pairOne has no range');
  }
}

/**
 * cell 칸이 겉 직업 face 의 형식으로 하는 진술. 참·거짓은 modeAt(truth, cell) 을 따른다
 * ('any' 면 동전 던지기). 진술이 없는 겉 직업이거나 만들 수 없으면 null.
 */
export function makeClue(r: Rng, w: number, h: number, truth: World, cell: number, face: RoleId): Clue | null {
  const def = role(face);
  const kind = def.clue;
  if (!kind) return null;
  const m = modeAt(truth, cell);
  const want = m === 'any' ? r() < 0.5 : m === 'true';

  let base = cell;
  if (def.shift === 'right') {
    const x = cell % w;
    base = x < w - 1 ? cell + 1 : cell - 1;
  }

  if (kind === 'pairOne') {
    const pairs: [number, number][] = [];
    for (let a = 0; a < w * h; a++) {
      for (let b = a + 1; b < w * h; b++) {
        if (a === cell || b === cell) continue;
        if (clueFact(w, h, truth, { kind, base, a, b }) === want) pairs.push([a, b]);
      }
    }
    if (pairs.length === 0) return null;
    const [a, b] = pick(r, pairs);
    return { kind, base, a, b };
  }

  const [lo, hi] = range(w, h, kind, base);
  const ns: number[] = [];
  for (let v = lo; v <= hi; v++) if (clueFact(w, h, truth, { kind, base, n: v }) === want) ns.push(v);
  if (ns.length === 0) return null;
  return { kind, base, n: pick(r, ns) };
}
