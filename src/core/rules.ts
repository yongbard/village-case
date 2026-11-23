import { colOf, nbr4, nbr8, rowOf, steps, xy } from './board';
import { ROLES, isEvil, role } from './roles';
import { ANY_WITNESS, type Camp, type CaseDef, type Clue, type Knowledge, type Mode, type RoleId, type World } from './types';

export function campAt(world: World, i: number): Camp {
  return role(world.roles[i]).camp;
}

const evilAt = (world: World, i: number): boolean => isEvil(campAt(world, i));

/** 악을 세는 진술에서 세어지는 칸: 공범·주범, 단 그림자는 제외 */
const countedAt = (world: World, i: number): boolean =>
  evilAt(world, i) && !role(world.roles[i]).hiddenFromCounts;

export function modeAt(world: World, i: number): Mode {
  const def = role(world.roles[i]);
  if (def.camp === 'witness' && world.taint.some((t) => t === i)) return 'false';
  if (def.mode) return def.mode;
  return def.camp === 'witness' || def.camp === 'trouble' ? 'true' : 'false';
}

export function clueFact(w: number, h: number, world: World, c: Clue): boolean {
  const count = (cells: number[]) => cells.filter((i) => countedAt(world, i)).length;
  switch (c.kind) {
    case 'evil4':
      return count(nbr4(w, h, c.base)) === c.n;
    case 'evil8':
      return count(nbr8(w, h, c.base)) === c.n;
    case 'evilRow':
      return count(rowOf(w, h, c.base)) === c.n;
    case 'evilCol':
      return count(colOf(w, h, c.base)) === c.n;
    case 'nearest': {
      let best = 0;
      let found = false;
      for (let i = 0; i < world.roles.length; i++) {
        if (i === c.base || !countedAt(world, i)) continue;
        const d = steps(w, c.base, i);
        if (!found || d < best) {
          best = d;
          found = true;
        }
      }
      return best === c.n;
    }
    case 'pairOne':
      return evilAt(world, c.a!) !== evilAt(world, c.b!);
    case 'bossRow': {
      const i = world.roles.findIndex((_, k) => campAt(world, k) === 'boss');
      return i >= 0 && xy(w, i)[1] + 1 === c.n;
    }
  }
}

export function pairSameFact(world: World, a: number, b: number): boolean {
  return evilAt(world, a) === evilAt(world, b);
}

/** 작은 결정적 정수 해시 (Math.random 사용 금지) */
function hash4(a: number, b: number, c: number, d: number): number {
  let x = 0x811c9dc5;
  for (const v of [a, b, c, d]) {
    x ^= v | 0;
    x = Math.imul(x, 0x01000193);
    x ^= x >>> 15;
    x = Math.imul(x, 0x2c1b3c6d);
    x ^= x >>> 12;
  }
  return x >>> 0;
}

export function abilityAnswer(def: CaseDef, cell: number, a: number, b: number): boolean {
  const mode = modeAt(def.truth, cell);
  if (mode === 'any') return hash4(def.seed, cell, a, b) % 2 === 0;
  const fact = pairSameFact(def.truth, a, b);
  return mode === 'true' ? fact : !fact;
}

/** 칸 i 의 진짜 직업이 r 일 때, 그 칸의 겉 직업·체포로 드러난 직업·알려진 선악과 맞는가 */
export function cellAdmits(k: Knowledge, i: number, r: RoleId): boolean {
  const rd = role(r);

  // 겉 직업
  const f = k.faces[i];
  if (f !== undefined) {
    const fd = role(f);
    if (fd.camp === 'witness') {
      const disguises = rd.camp === 'accomplice' || rd.camp === 'boss' || rd.face === 'witness';
      if (!disguises && !(rd.camp === 'witness' && (r === ANY_WITNESS || r === f || f === ANY_WITNESS))) return false;
    } else if (r !== f) {
      return false;
    }
  }

  // 체포로 드러난 진짜 직업
  const a = k.arrested[i];
  if (a !== undefined) {
    if (a === ANY_WITNESS) {
      if (rd.camp !== 'witness') return false;
    } else if (r !== a && !(r === ANY_WITNESS && role(a).camp === 'witness')) {
      return false;
    }
  }

  // 알려진 선·악
  const ks = k.knownSides?.[i];
  return ks === undefined || ks === (isEvil(rd.camp) ? 'evil' : 'good');
}

export function consistent(k: Knowledge, world: World): boolean {
  const { w, h } = k;
  const n = w * h;
  if (world.roles.length !== n || world.taint.length !== n) return false;

  // inPlay 직업은 각 정확히 한 칸, 나머지는 증인
  const inPlay = new Set(k.inPlay);
  if (inPlay.size !== k.inPlay.length) return false;
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const r = world.roles[i];
    if (r !== ANY_WITNESS && !(r in ROLES)) return false;
    if (campAt(world, i) === 'witness') continue;
    if (!inPlay.has(r)) return false;
    seen.set(r, (seen.get(r) ?? 0) + 1);
  }
  for (const r of k.inPlay) if (seen.get(r) !== 1) return false;

  for (let i = 0; i < n; i++) {
    const r = world.roles[i];
    const rd = role(r);

    if (!cellAdmits(k, i, r)) return false;

    // 배치 규칙
    if (rd.place === 'bossIn8' && !nbr8(w, h, i).some((j) => campAt(world, j) === 'boss')) return false;

    // 오염
    const t = world.taint[i];
    if (rd.taint) {
      const pool = rd.taint === 'adj4' ? nbr4(w, h, i) : Array.from({ length: n }, (_, j) => j);
      const eligible = pool.filter((j) => j !== i && campAt(world, j) === 'witness');
      if (eligible.length > 0 ? !eligible.includes(t) : t !== -1) return false;
    } else if (t !== -1) {
      return false;
    }
  }

  // 보이는 진술
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (!c) continue;
    const m = modeAt(world, i);
    if (m !== 'any' && clueFact(w, h, world, c) !== (m === 'true')) return false;
  }

  // 능력 관찰
  for (const o of k.abilities) {
    const m = modeAt(world, o.cell);
    if (m !== 'any' && o.same !== (m === 'true' ? pairSameFact(world, o.a, o.b) : !pairSameFact(world, o.a, o.b))) return false;
  }
  return true;
}
