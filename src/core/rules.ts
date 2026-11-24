import { colOf, diagOf, halvesOf, nbr4, nbr8, rowOf, sideCells, steps } from './board';
import { ROLES, isEvil, role } from './roles';
import { ANY_WITNESS, type Camp, type CaseDef, type Clue, type Knowledge, type Mode, type RoleId, type World } from './types';

/**
 * 진술을 판정하는 시점: 'real' = 실제 세계, 'shield' = 협박당한 증인이 보는 세계(주범을 선으로 치고,
 * 주범을 가리키는 진술에서는 대역만 주범으로 본다).
 */
export type View = 'real' | 'shield';

export function campAt(world: World, i: number): Camp {
  return role(world.roles[i]).camp;
}

const evilAt = (world: World, i: number): boolean => isEvil(campAt(world, i));

/** 칸 i 에 effect 를 하는 원천이 있는가 */
function hitBy(world: World, i: number, effect: 'lie' | 'shield' | 'frame'): boolean {
  return world.taint.some((t, j) => t === i && role(world.roles[j]).effect === effect);
}

/** 모사꾼이 누명을 씌운 칸인가 */
export function framedAt(world: World, i: number): boolean {
  return hitBy(world, i, 'frame');
}

/** 악을 세는 진술(수 세기·거리·붙어 사는 악·세탁소)에서 세어지는가: 그림자는 빠지고 누명 쓴 사람은 들어간다 */
export function countedAt(world: World, i: number, view: View = 'real'): boolean {
  const d = role(world.roles[i]);
  const evil = isEvil(d.camp) && !d.hiddenFromCounts && !(view === 'shield' && d.camp === 'boss');
  return evil || framedAt(world, i);
}

/** 관계 진술(지목·알리바이·같은 편·사진사·신부·기자)이 보는 악 */
export function evilIn(world: World, i: number, view: View = 'real'): boolean {
  const d = role(world.roles[i]);
  return isEvil(d.camp) && !(view === 'shield' && d.camp === 'boss');
}

/** 주범을 가리키는 진술(개 주인·종지기)이 보는 주범: 실제로는 주범과 대역, 협박당하면 대역만 */
export function bossLike(world: World, i: number, view: View = 'real'): boolean {
  const d = role(world.roles[i]);
  return (view === 'real' && d.camp === 'boss') || !!d.decoy;
}

export function modeAt(world: World, i: number): Mode {
  const def = role(world.roles[i]);
  if (def.camp === 'witness') {
    if (hitBy(world, i, 'lie')) return 'false';
    if (hitBy(world, i, 'shield')) return 'shield';
  }
  if (def.mode) return def.mode;
  return def.camp === 'witness' || def.camp === 'trouble' ? 'true' : 'false';
}

export const isCountKind = (k: Clue['kind']): boolean =>
  k === 'evil4' || k === 'evil8' || k === 'evilRow' || k === 'evilCol' || k === 'diag';

/** 수 세기 진술이 세는 칸 (기준 칸 제외) */
export function countCells(w: number, h: number, c: Clue): number[] {
  switch (c.kind) {
    case 'evil4': return nbr4(w, h, c.base);
    case 'evil8': return nbr8(w, h, c.base);
    case 'evilRow': return rowOf(w, h, c.base);
    case 'evilCol': return colOf(w, h, c.base);
    case 'diag': return diagOf(w, h, c.base);
    default: throw new Error(`not a count clue: ${c.kind}`);
  }
}

/** 수 세기 진술의 실제 수 */
export function countValue(w: number, h: number, world: World, c: Clue, view: View = 'real'): number {
  return countCells(w, h, c).filter((i) => countedAt(world, i, view)).length;
}

export function clueFact(w: number, h: number, world: World, c: Clue, view: View = 'real'): boolean {
  const counted = (i: number) => countedAt(world, i, view);
  const evil = (i: number) => evilIn(world, i, view);
  const boss = (i: number) => bossLike(world, i, view);
  const all = Array.from({ length: w * h }, (_, i) => i);
  switch (c.kind) {
    case 'evil4':
    case 'evil8':
    case 'evilRow':
    case 'evilCol':
    case 'diag':
      return countValue(w, h, world, c, view) === c.n;
    case 'nearest': {
      const ds = all.filter((i) => i !== c.base && counted(i)).map((i) => steps(w, c.base, i));
      return (ds.length === 0 ? 0 : Math.min(...ds)) === c.n;
    }
    case 'pairOne':
      return evil(c.a!) !== evil(c.b!);
    case 'sameSide':
      return evil(c.a!) === evil(c.b!);
    case 'alibi':
      return !evil(c.a!);
    case 'accuse':
      return evil(c.a!);
    case 'atLeastOne':
      return c.cells!.some(evil);
    case 'adjPair': {
      const has = all.some((i) => counted(i) && nbr4(w, h, i).some((j) => j > i && counted(j)));
      return (has ? 1 : 0) === c.n;
    }
    case 'halves': {
      const [L, R] = halvesOf(w, h);
      return Math.sign(R.filter(counted).length - L.filter(counted).length) === c.n;
    }
    case 'bossDir':
      return sideCells(w, h, c.base, c.dir!).some(boss);
    case 'bossRow':
      return all.filter((i) => Math.floor(i / w) + 1 === c.r && boss(i)).length === c.n;
  }
}

/** 칸 cell 의 말하는 방식으로 진술 c 를 할 수 있는가 */
export function statementHolds(w: number, h: number, world: World, cell: number, c: Clue): boolean {
  return holdsAs(w, h, world, c, modeAt(world, cell));
}

/** 말하는 방식 m 으로 진술 c 를 할 수 있는가 (솔버가 증인의 오염 여부를 모를 때 방식마다 따진다) */
export function holdsAs(w: number, h: number, world: World, c: Clue, m: Mode): boolean {
  switch (m) {
    case 'true': return clueFact(w, h, world, c);
    case 'false': return !clueFact(w, h, world, c);
    case 'any': return true;
    case 'over': return c.n! > countValue(w, h, world, c);
    case 'shield': return clueFact(w, h, world, c, 'shield');
  }
}

/** 실제로 같은 편인가 */
export function pairSameFact(world: World, a: number, b: number): boolean {
  return evilAt(world, a) === evilAt(world, b);
}

/** 칸 cell 이 기자 능력으로 "a·b 가 같은 편인가"에 할 답. 'any' = 어느 답이든 */
export function abilityTruth(world: World, cell: number, a: number, b: number): boolean | 'any' {
  return abilityAs(world, modeAt(world, cell), a, b);
}

/** 말하는 방식 m 으로 할 "a·b 가 같은 편인가"의 답 */
export function abilityAs(world: World, m: Mode, a: number, b: number): boolean | 'any' {
  switch (m) {
    case 'true':
    case 'over':
      return pairSameFact(world, a, b);
    case 'false':
      return !pairSameFact(world, a, b);
    case 'shield':
      return evilIn(world, a, 'shield') === evilIn(world, b, 'shield');
    case 'any':
      return 'any';
  }
}

/** 작은 결정적 정수 해시 (Math.random 사용 금지) */
export function hash4(a: number, b: number, c: number, d: number): number {
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
  const t = abilityTruth(def.truth, cell, a, b);
  return t === 'any' ? hash4(def.seed, cell, a, b) % 2 === 0 : t;
}

/** 원천 i 의 대상이 될 수 있는 칸: 범위 안, 자기 아님, lie·shield 는 진짜 증인, frame 은 선 */
export function taintEligible(w: number, h: number, roles: RoleId[], i: number): number[] {
  const d = role(roles[i]);
  if (!d.taint) return [];
  const pool = d.taint === 'adj4' ? nbr4(w, h, i) : Array.from({ length: w * h }, (_, j) => j);
  return pool.filter((j) => {
    if (j === i) return false;
    const c = role(roles[j]).camp;
    return d.effect === 'frame' ? !isEvil(c) : c === 'witness';
  });
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

  // 증인 아닌 직업은 inPlay 와 같은 다중 집합, 직업이 정해진 증인은 roster 이하
  const want = new Map<RoleId, number>();
  for (const r of k.inPlay) want.set(r, (want.get(r) ?? 0) + 1);
  const seen = new Map<RoleId, number>();
  for (let i = 0; i < n; i++) {
    const r = world.roles[i];
    if (r !== ANY_WITNESS && !(r in ROLES)) return false;
    seen.set(r, (seen.get(r) ?? 0) + 1);
  }
  for (const [r, c] of seen) {
    if (r === ANY_WITNESS) continue;
    if (role(r).camp === 'witness') {
      if (c > (k.roster[r] ?? 0)) return false;
    } else if (want.get(r) !== c) return false;
  }
  for (const [r, c] of want) if (!(r in ROLES) || role(r).camp === 'witness' || seen.get(r) !== c) return false;

  const targets = new Set<number>();
  for (let i = 0; i < n; i++) {
    const r = world.roles[i];
    const rd = role(r);
    if (!cellAdmits(k, i, r)) return false;

    // 배치 규칙: 망보기 주변 8칸에 진짜 주범
    if (rd.place === 'bossIn8' && !nbr8(w, h, i).some((j) => campAt(world, j) === 'boss')) return false;

    // 오염: 대상은 대상 후보 중 하나(후보가 없을 때만 -1), 두 원천이 같은 대상을 고르지 않는다
    const t = world.taint[i];
    if (rd.taint) {
      const eligible = taintEligible(w, h, world.roles, i);
      if (eligible.length > 0 ? !eligible.includes(t) : t !== -1) return false;
      if (t >= 0) {
        if (targets.has(t)) return false;
        targets.add(t);
      }
    } else if (t !== -1) {
      return false;
    }
  }

  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (c && !statementHolds(w, h, world, i, c)) return false;
  }
  for (const o of k.abilities) {
    const t = abilityTruth(world, o.cell, o.a, o.b);
    if (t !== 'any' && t !== o.same) return false;
  }
  return true;
}
