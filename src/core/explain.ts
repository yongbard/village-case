// 단계 솔버 (설계 5.5): 해설·난이도·힌트.
// 다 정해지는 칸마다 "그 칸이 반대편이면 모순이 되는 가장 작은 사실 묶음"을 찾아 한 단계씩 적는다.
// 선·악 단위로 따진다(설계 5.2 G1): 좀도둑↔두목, 숨은이↔증인은 관찰로 구별되지 않는다.
import { nbr4, steps } from './board';
import { isEvil, role } from './roles';
import { campAt, clueFact, consistent, modeAt, pairSameFact } from './rules';
import { clueRefs, forEachWorld, solve, witnessValue, worldKey, WORLD_CAP } from './solve';
import { type CaseDef, type Knowledge, type Side, type World } from './types';

export type Fact =
  | { type: 'clue'; cell: number }
  | { type: 'ability'; index: number }
  | { type: 'side'; cell: number; side: Side };
export interface Step {
  cell: number;
  side: Side;
  because: Fact[] | 'all';
}
export type Hint = { kind: 'step'; step: Step } | { kind: 'investigate'; cell: number };

const MAX_REASON = 3;
const HINT_CAP = 2000;
/** 처음 반례 묶음을 만들 때 맞바꿈의 재료로 쓰는 다 아는 관찰의 세계 수 */
const SEED_BASES = 8;
/** 풀어서 반례를 찾을 때 한 번에 더 모아 두는 세계 수 */
const DFS_KEEP = 8;
/** 반례 묶음 크기 상한 (메모리) */
const POOL_MAX = 20000;
/** 맞바꿔 반례를 만들 때 재료로 쓰는 세계 수 */
const MUT_SOURCES = 12;

const flip = (s: Side): Side => (s === 'good' ? 'evil' : 'good');
const evilBit = (s: Side): number => (s === 'evil' ? 1 : 0);
const sideOfWorld = (w: World, i: number): Side => (isEvil(campAt(w, i)) ? 'evil' : 'good');

/** 관찰 k 에서 이미 선·악을 아는 칸 (알려진 선악, 체포로 드러난 직업) */
function knownSideAt(k: Knowledge, i: number): Side | undefined {
  const ks = k.knownSides?.[i];
  if (ks !== undefined) return ks;
  const a = k.arrested[i];
  return a === undefined ? undefined : isEvil(role(a).camp) ? 'evil' : 'good';
}

/** 반례 묶음의 세계 하나: 칸마다 악인가, 진술·능력 관찰마다 그 세계에서 맞는가 */
interface Rec {
  w: World;
  evil: Uint8Array;
  ok: Uint8Array; // [0, n) 진술(칸 번호), [n, n + 능력 수) 능력 관찰
}

interface Ctx {
  k: Knowledge;
  n: number;
  /** 진술·능력을 뺀 관찰 (겉 직업·inPlay·체포·처음부터 알던 선악) */
  base: Knowledge;
  /** 사실이 닿는 칸: 진술 = 말한 칸 + 참조 칸, 능력 = 쓴 칸 + 두 대상 */
  cells: Map<Fact, number[]>;
  /** 판 전체를 참조하는 진술(가장 가까운 악, 주범 줄). 이어짐을 넓히지 않는다. */
  global: Set<Fact>;
  /** 반례 묶음: lists[c * 2 + 악?1:0] = 칸 c 가 그 편인 세계들 */
  lists: Rec[][];
  keys: Set<string>;
  size: number;
}

function makeCtx(k: Knowledge, clueFacts: Fact[]): Ctx {
  const n = k.w * k.h;
  const cells = new Map<Fact, number[]>();
  const global = new Set<Fact>();
  for (const f of clueFacts) {
    if (f.type === 'clue') {
      const c = k.clues[f.cell]!;
      cells.set(f, [...new Set([f.cell, ...clueRefs(k.w, k.h, c)])]);
      if (c.kind === 'nearest' || c.kind === 'bossRow') global.add(f);
    } else if (f.type === 'ability') {
      const o = k.abilities[f.index];
      cells.set(f, [o.cell, o.a, o.b]);
    }
  }
  const base: Knowledge = {
    ...k,
    clues: Array(n).fill(null),
    abilities: [],
    knownSides: Array.from({ length: n }, (_, i) => k.knownSides?.[i]),
  };
  return { k, n, base, cells, global, lists: Array.from({ length: 2 * n }, () => []), keys: new Set(), size: 0 };
}

/** 세계를 반례 묶음에 넣는다. w 는 base 와 맞아야 한다. 이미 있거나 묶음이 꽉 차면 undefined. */
function addWorld(ctx: Ctx, w: World): Rec | undefined {
  if (ctx.size >= POOL_MAX) return undefined;
  const key = worldKey(w);
  if (ctx.keys.has(key)) return undefined;
  ctx.keys.add(key);
  const { k, n } = ctx;
  const evil = new Uint8Array(n);
  for (let i = 0; i < n; i++) evil[i] = isEvil(campAt(w, i)) ? 1 : 0;
  const ok = new Uint8Array(n + k.abilities.length);
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (!c) continue;
    const m = modeAt(w, i);
    ok[i] = m === 'any' || clueFact(k.w, k.h, w, c) === (m === 'true') ? 1 : 0;
  }
  k.abilities.forEach((o, j) => {
    const m = modeAt(w, o.cell);
    const fact = pairSameFact(w, o.a, o.b);
    ok[n + j] = m === 'any' || o.same === (m === 'true' ? fact : !fact) ? 1 : 0;
  });
  const rec: Rec = { w, evil, ok };
  for (let i = 0; i < n; i++) ctx.lists[i * 2 + evil[i]].push(rec);
  ctx.size++;
  return rec;
}

/** base 의 c·d 칸 직업을 맞바꾼 세계. 증인 직업은 새 칸의 정규 값으로, 오염 대상은 규칙에 맞게 고친다. */
function swapped(k: Knowledge, base: World, c: number, d: number): World {
  const n = k.w * k.h;
  const roles = [...base.roles];
  const put = (i: number, r: string) => (roles[i] = role(r).camp === 'witness' ? witnessValue(k, i) : r);
  put(c, base.roles[d]);
  put(d, base.roles[c]);
  const taint = [...base.taint];
  taint[c] = base.taint[d];
  taint[d] = base.taint[c];
  for (let i = 0; i < n; i++) {
    const t = role(roles[i]).taint;
    if (!t) {
      taint[i] = -1;
      continue;
    }
    const pool = t === 'adj4' ? nbr4(k.w, k.h, i) : Array.from({ length: n }, (_, j) => j);
    const elig = pool.filter((j) => j !== i && role(roles[j]).camp === 'witness');
    if (elig.length === 0) taint[i] = -1;
    else if (!elig.includes(taint[i])) taint[i] = elig[0];
  }
  return { roles, taint };
}

/** 처음 반례 묶음: 다 아는 관찰의 세계와, 그 세계에서 선·악이 다른 두 칸을 맞바꾼 것 중 base 와 맞는 것 */
function seedPool(ctx: Ctx, full: World[]): void {
  const { k, n } = ctx;
  for (const b of full.slice(0, SEED_BASES)) {
    addWorld(ctx, b);
    for (let c = 0; c < n; c++) for (let d = c + 1; d < n; d++) {
      if (sideOfWorld(b, c) === sideOfWorld(b, d)) continue;
      const w = swapped(k, b, c, d);
      if (consistent(ctx.base, w)) addWorld(ctx, w);
    }
  }
}

function holds(ctx: Ctx, r: Rec, f: Fact): boolean {
  if (f.type === 'clue') return r.ok[f.cell] === 1;
  if (f.type === 'ability') return r.ok[ctx.n + f.index] === 1;
  return r.evil[f.cell] === evilBit(f.side);
}

/**
 * S 가 "칸 c 는 s" 를 증명하는가: base 에 S 의 진술·능력·선악만 더한 관찰에서 c 가 반대편인 세계가 하나도 없으면 증명한다.
 * 반례 묶음에서 먼저 찾고(consistent 를 base 와 사실별 검사로 나눈 것과 같다), 없으면 풀어서 찾는다.
 */
function proves(ctx: Ctx, S: Fact[], c: number, s: Side): boolean {
  const list = ctx.lists[c * 2 + evilBit(flip(s))];
  outer: for (let i = 0; i < list.length; i++) {
    const r = list[i];
    for (const f of S) if (!holds(ctx, r, f)) continue outer;
    if (i > 0) {
      list[i] = list[0];
      list[0] = r;
    }
    return false;
  }
  // S 를 만족하고 c 가 s 인 세계에서 c 와 반대편 칸 하나를 맞바꿔 본다
  const src = ctx.lists[c * 2 + evilBit(s)];
  let tried = 0;
  const sat = (r: Rec) => S.every((f) => holds(ctx, r, f));
  for (let i = 0; i < src.length && tried < MUT_SOURCES; i++) {
    const r0 = src[i];
    if (!sat(r0)) continue;
    tried++;
    for (let d = 0; d < ctx.n; d++) {
      if (r0.evil[d] === r0.evil[c]) continue;
      const w = swapped(ctx.k, r0.w, c, d);
      if (!consistent(ctx.base, w)) continue;
      const r = addWorld(ctx, w);
      if (r && sat(r)) return false;
    }
  }
  const { k, n, base } = ctx;
  const knownSides = [...base.knownSides!];
  const r: Knowledge = { ...base, clues: Array(n).fill(null), abilities: [], knownSides };
  for (const f of S) {
    if (f.type === 'clue') r.clues[f.cell] = k.clues[f.cell];
    else if (f.type === 'ability') r.abilities.push(k.abilities[f.index]);
    else knownSides[f.cell] = f.side;
  }
  knownSides[c] = flip(s);
  // c 와 S 가 닿는 칸을 먼저 채워 모순을 일찍 찾는다. 판 전체 진술은 말한 칸과, 사실값을 가르는 칸
  // (가장 가까운 악: 기준 칸에서 N 걸음 안, 가까운 순 / 주범 줄: 그 줄)
  const first = new Set<number>([c]);
  for (const f of S) {
    if (f.type === 'side') first.add(f.cell);
    else if (f.type === 'clue' && ctx.global.has(f)) {
      first.add(f.cell);
      const cl = k.clues[f.cell]!;
      const near = Array.from({ length: n }, (_, j) => j).filter((j) =>
        cl.kind === 'nearest' ? j !== cl.base && steps(k.w, cl.base, j) <= cl.n! : Math.floor(j / k.w) + 1 === cl.n,
      );
      if (cl.kind === 'nearest') near.sort((a, b) => steps(k.w, cl.base, a) - steps(k.w, cl.base, b));
      for (const x of near) first.add(x);
    } else for (const x of ctx.cells.get(f)!) first.add(x);
  }
  // 거짓말하는 증인은 이웃 4칸의 오염원이 있어야 하므로, 말한 칸의 이웃도 일찍 채운다
  for (const f of S) {
    if (f.type === 'clue') for (const x of nbr4(k.w, k.h, f.cell)) first.add(x);
    else if (f.type === 'ability') for (const x of nbr4(k.w, k.h, k.abilities[f.index].cell)) first.add(x);
  }
  const order = [...first];
  for (let i = 0; i < n; i++) if (!first.has(i)) order.push(i);
  let found = 0;
  forEachWorld(
    r,
    (w) => {
      addWorld(ctx, w);
      return ++found >= DFS_KEEP;
    },
    order,
  );
  return found === 0;
}

/**
 * 칸 c 의 진술·능력 묶음 (크기 0 ~ 3): 첫 사실은 c 에 닿고, 다음 사실은 c 나 앞에서 고른 사실이 닿는 칸에 닿는다.
 * 판 전체를 참조하는 진술은 어느 칸에나 닿지만 이어짐을 넓히지 않는다. 선·악 사실은 여기에 넣지 않고 따로 붙인다.
 */
function clueCombos(ctx: Ctx, facts: Fact[], c: number): Fact[][][] {
  const out: Fact[][][] = [[[]], [], [], []];
  const seen = new Set<string>();
  const idx = new Map(facts.map((f, i) => [f, i]));
  const rec = (chosen: Fact[], cs: Set<number>) => {
    const key = chosen.map((f) => idx.get(f)!).sort((a, b) => a - b).join(',');
    if (chosen.length > 0) {
      if (seen.has(key)) return;
      seen.add(key);
      out[chosen.length].push([...chosen].sort((a, b) => idx.get(a)! - idx.get(b)!));
    }
    if (chosen.length === MAX_REASON) return;
    for (const f of facts) {
      if (chosen.includes(f) || !ctx.cells.get(f)!.some((x) => cs.has(x))) continue;
      const next = ctx.global.has(f) ? cs : new Set([...cs, ...ctx.cells.get(f)!]);
      rec([...chosen, f], next);
    }
  };
  rec([], new Set([c]));
  return out;
}

/** sides[0, len) 에서 m 개를 고르는 묶음 중 가장 뒤 것이 from 이상인 것 (사전순) */
function* sideSubsets(len: number, m: number, from: number): Generator<number[]> {
  if (m === 0) {
    if (from <= 0) yield [];
    return;
  }
  const pick: number[] = [];
  function* rec(start: number): Generator<number[]> {
    if (pick.length === m - 1) {
      for (let last = Math.max(start, from); last < len; last++) yield [...pick, last];
      return;
    }
    for (let i = start; i < len; i++) {
      pick.push(i);
      yield* rec(i + 1);
      pick.pop();
    }
  }
  yield* rec(0);
}

/** 모든 세계에서 선·악이 같은데 아직 단계로 안 적은 칸을, 이유가 작은 순으로 limit 개까지 */
function stepsFrom(k: Knowledge, worlds: World[], limit: number): Step[] {
  const n = k.w * k.h;
  if (worlds.length === 0) return [];
  const facts: Fact[] = [];
  k.clues.forEach((c, cell) => c && facts.push({ type: 'clue', cell }));
  k.abilities.forEach((_, index) => facts.push({ type: 'ability', index }));
  const ctx = makeCtx(k, facts);
  seedPool(ctx, worlds);
  const forced: (Side | undefined)[] = Array.from({ length: n }, (_, i) => {
    if (knownSideAt(k, i) !== undefined) return undefined;
    const s = sideOfWorld(worlds[0], i);
    return worlds.every((w) => sideOfWorld(w, i) === s) ? s : undefined;
  });

  const sides: Fact[] = []; // 앞 단계에서 정한 선·악
  const combos: (Fact[][][] | undefined)[] = Array(n).fill(undefined);
  // seenSides[c][size] = 그 크기에서 이미 다 따져 본 선·악 사실 수 (-1 = 아직 안 봄)
  const seenSides: number[][] = Array.from({ length: n }, () => Array(MAX_REASON + 1).fill(-1));

  /** 칸 c 를 크기 size 의 새 묶음으로 증명해 본다. 앞에서 따져 본 묶음은 결과가 같으므로 다시 보지 않는다. */
  const search = (c: number, size: number): Fact[] | undefined => {
    const cc = (combos[c] ??= clueCombos(ctx, facts, c));
    const from = seenSides[c][size];
    const s = forced[c]!;
    for (let m = 0; m <= size; m++) {
      const group = cc[size - m];
      if (group.length === 0) continue;
      for (const sub of sideSubsets(sides.length, m, from < 0 ? 0 : m === 0 ? 1 : from)) {
        const extra = sub.map((i) => sides[i]);
        for (const g of group) {
          const S = [...g, ...extra];
          if (proves(ctx, S, c, s)) return S;
        }
      }
    }
    seenSides[c][size] = sides.length;
    return undefined;
  };

  const steps: Step[] = [];
  const left = new Set(forced.flatMap((s, i) => (s ? [i] : [])));
  while (left.size > 0 && steps.length < limit) {
    let pick: Step | undefined;
    for (let size = 0; size <= MAX_REASON && !pick; size++) {
      for (const c of [...left].sort((a, b) => a - b)) {
        const S = search(c, size);
        if (S) {
          pick = { cell: c, side: forced[c]!, because: S };
          break;
        }
      }
    }
    if (!pick) {
      const c = Math.min(...left);
      pick = { cell: c, side: forced[c]!, because: 'all' };
    }
    steps.push(pick);
    left.delete(pick.cell);
    sides.push({ type: 'side', cell: pick.cell, side: pick.side });
  }
  return steps;
}

/** 관찰 k 에서 정해지는 칸을 모두 단계로. 맞는 세계가 없거나 너무 많으면 빈 목록. */
export function explain(k: Knowledge): Step[] {
  const { worlds, capped } = solve(k, WORLD_CAP);
  if (capped) return [];
  return stepsFrom(k, worlds, Infinity);
}

/**
 * 이유 크기 1 → 1점, 2 → 2점, 3 → 4점, 'all' → 8점(겉 직업만으로 정해진 칸은 0점). 단계당 평균을 1 ~ 5 로 나눈다.
 * 경계값은 무한 모드 n = 1 ~ 30 (각 6판) 분포로 정했다: 3×3 1등급(n 1 ~ 2)은 1.9 ~ 2.9 → 1 ~ 2,
 * 4×5(n 18 ~ 30)는 3.0 ~ 7.2 → 3 ~ 5.
 */
const POINTS = [0, 1, 2, 4];
export const DIFFICULTY_BOUNDS = [2.0, 3.0, 4.5, 6.0] as const; // 평균이 이 값 이상이면 2, 3, 4, 5
export function difficulty(steps: Step[]): 1 | 2 | 3 | 4 | 5 {
  if (steps.length === 0) return 1;
  const total = steps.reduce((s, st) => s + (st.because === 'all' ? 8 : POINTS[st.because.length]), 0);
  const avg = total / steps.length;
  let d = 1;
  for (const b of DIFFICULTY_BOUNDS) if (avg >= b) d++;
  return d as 1 | 2 | 3 | 4 | 5;
}

/** 다음 한 단계. 관찰이 부족하면(세계가 너무 많거나 정해지는 칸이 없으면) 조사할 칸, 그것도 없으면 능력 칸. */
export function nextHint(k: Knowledge): Hint {
  const n = k.w * k.h;
  try {
    const { worlds, capped } = solve(k, HINT_CAP);
    if (!capped) {
      const [step] = stepsFrom(k, worlds, 1);
      if (step) return { kind: 'step', step };
    }
  } catch {
    // 아래의 조사 힌트로
  }
  for (let i = 0; i < n; i++) if (k.faces[i] === undefined && k.arrested[i] === undefined) return { kind: 'investigate', cell: i };
  const used = new Set(k.abilities.map((o) => o.cell));
  const abil = k.faces.flatMap((f, i) => (f !== undefined && role(f).ability ? [i] : []));
  return { kind: 'investigate', cell: abil.find((i) => !used.has(i)) ?? abil[0] ?? 0 };
}

const hasBatchim = (s: string): boolean => {
  const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const josa = (s: string, withB: string, without: string) => s + (hasBatchim(s) ? withB : without);
const sideName = (s: Side) => (s === 'good' ? '선' : '악');

/** "A", "A와 B", "A, B와 C" */
function joinAnd(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -2).map((x) => `${x}, `).join('')}${josa(items[items.length - 2], '과', '와')} ${items[items.length - 1]}`;
}

/** 해설 한 줄. 칸 번호는 1부터, 이름은 겉 직업. */
export function describeStep(step: Step, def: CaseDef): string {
  const head = `${step.cell + 1}번은 ${sideName(step.side)}: `;
  if (step.because === 'all') return `${head}모든 경우를 따져 보면 이렇게만 맞는다.`;
  const name = (i: number) => `${i + 1}번 ${role(def.faces[i]).name}`;
  if (step.because.length === 0) {
    const fd = role(def.faces[step.cell]);
    if (fd.camp === 'trouble') return `${head}겉 직업이 말썽꾼(${fd.name})이다.`;
    return `${head}겉 직업과 직업 목록만으로 정해진다.`;
  }
  const fs = step.because;
  const phrase = fs.every((f) => f.type === 'clue')
    ? `${joinAnd(fs.map((f) => name(f.cell)))}의 진술`
    : joinAnd(
        fs.map((f) =>
          f.type === 'clue'
            ? `${name(f.cell)}의 진술`
            : f.type === 'ability'
              ? `${f.index + 1}번째 능력 결과`
              : `${f.cell + 1}번이 ${sideName(f.side)}이라는 것`,
        ),
      );
  const opp = sideName(flip(step.side));
  return fs.length === 1 ? `${head}${phrase}만 보아도 ${opp}일 수 없다.` : `${head}${josa(phrase, '을', '를')} 함께 보면 ${opp}일 수 없다.`;
}
