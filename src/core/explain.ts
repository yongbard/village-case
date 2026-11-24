// 단계 솔버 (설계 5.5, 주범 사냥 설계 4.7): 해설·난이도·힌트.
// 칸마다 꼬리표(선 0 / 공범 1 / 주범 2)를 두고, 모든 세계에서 꼬리표 집합이 좁혀지는 칸의 사실(Claim)을
// "그 사실이 아니면 모순이 되는 가장 작은 진술·능력 묶음"과 함께 한 단계씩 적는다.
// 앞 단계에서 정한 사실은 늘 깔고 따지며 묶음 크기에 세지 않는다. 주범 칸이 모두 정해지면 멈춘다.
import { steps } from './board';
import { role } from './roles';
import { abilityTruth, campAt, consistent, statementHolds, taintEligible } from './rules';
import { clueRefs, forEachWorld, overBudget, solve, witnessValue, worldKey, WORLD_CAP, type Budget } from './solve';
import { type CaseDef, type Camp, type Claim, type Knowledge, type World } from './types';

export type Fact = { type: 'clue'; cell: number } | { type: 'ability'; index: number };
export interface Step {
  cell: number;
  claim: Claim;
  because: Fact[] | 'all';
  /** 이유가 앞 단계에서 정한 사실에도 기대는가 (because 만으로는 증명되지 않는가) */
  usesEarlier: boolean;
}
export type Hint =
  | { kind: 'step'; step: Step }
  | { kind: 'investigate'; cell: number }
  | { kind: 'ability'; cell: number };

const MAX_REASON = 3;
const HINT_CAP = 2000;
/** 힌트 한 번에 쓰는 시간 (ms). 넘으면 그때까지 증명한 것만 쓴다. */
export const HINT_BUDGET_MS = 1500;
/** 처음 반례 묶음을 만들 때 맞바꿈의 재료로 쓰는 다 아는 관찰의 세계 수 */
const SEED_BASES = 8;
/** 풀어서 반례를 찾을 때 한 번에 더 모아 두는 세계 수 */
const DFS_KEEP = 8;
/** 반례 묶음 크기 상한 (메모리) */
const POOL_MAX = 20000;
/** 맞바꿔 반례를 만들 때 재료로 쓰는 세계 수 */
const MUT_SOURCES = 12;

/** 꼬리표: 0 선, 1 공범, 2 주범. 꼬리표 집합은 비트(1 선, 2 공범, 4 주범) */
const ALL = 7;
const labelOfCamp = (c: Camp): number => (c === 'boss' ? 2 : c === 'accomplice' ? 1 : 0);
const labelAt = (w: World, i: number): number => labelOfCamp(campAt(w, i));
const CLAIM_MASK: Record<Claim, number> = { good: 1, accomplice: 2, boss: 4, evil: 6, notBoss: 3 };
const LABEL_CLAIM: Claim[] = ['good', 'accomplice', 'boss'];
/** 꼬리표 집합 → 사실 (없으면 undefined: 모름 7, 선 또는 주범 5) */
function maskClaim(mask: number): Claim | undefined {
  return (Object.keys(CLAIM_MASK) as Claim[]).find((c) => CLAIM_MASK[c] === mask);
}

/** 관찰 k 에서 이미 아는 칸의 꼬리표 집합 (알려진 사실, 체포로 드러난 직업) */
function knownMaskAt(k: Knowledge, i: number): number {
  let m = ALL;
  const kc = k.knownClaims?.[i];
  if (kc !== undefined) m &= CLAIM_MASK[kc];
  const a = k.arrested[i];
  if (a !== undefined) m &= 1 << labelOfCamp(role(a).camp);
  return m;
}

/** 반례 묶음의 세계 하나: 칸마다 꼬리표, 진술·능력 관찰마다 그 세계에서 맞는가 */
interface Rec {
  dead: boolean; // 앞 단계에서 정한 사실과 어긋나 더는 반례가 될 수 없다
  w: World;
  label: Uint8Array;
  ok: Uint8Array; // [0, n) 진술(칸 번호), [n, n + 능력 수) 능력 관찰
}

interface Ctx {
  k: Knowledge;
  n: number;
  /** 진술·능력·알던 사실을 뺀 관찰 (겉 직업·inPlay·roster·체포). 알던 사실(knownClaims)은 처음 배경으로 둔다. */
  base: Knowledge;
  /** 사실이 닿는 칸: 진술 = 말한 칸 + 참조 칸, 능력 = 쓴 칸 + 두 대상 */
  cells: Map<Fact, number[]>;
  /** 판 전체를 참조하는 진술(가장 가까운 악, 붙어 사는 악, 세탁소). 이어짐을 넓히지 않는다. */
  global: Set<Fact>;
  /** 앞 단계에서 정한 사실: 칸마다 허용 꼬리표 비트 (7 = 아직). 반례 묶음에는 이와 맞는 세계만 둔다. */
  bg: Uint8Array;
  /** 반례 묶음: lists[c * 3 + 꼬리표] = 칸 c 가 그 꼬리표인 세계들 */
  lists: Rec[][];
  keys: Set<string>;
  size: number;
  /** 힌트용 시간 한도. 넘으면 풀어서 찾는 증명은 실패로 본다. */
  budget?: Budget;
}

const isGlobalKind = (kind: string) => kind === 'nearest' || kind === 'adjPair' || kind === 'halves';

function makeCtx(k: Knowledge, clueFacts: Fact[], budget?: Budget): Ctx {
  const n = k.w * k.h;
  const cells = new Map<Fact, number[]>();
  const global = new Set<Fact>();
  for (const f of clueFacts) {
    if (f.type === 'clue') {
      const c = k.clues[f.cell]!;
      cells.set(f, [...new Set([f.cell, ...clueRefs(k.w, k.h, c)])]);
      if (isGlobalKind(c.kind)) global.add(f);
    } else if (f.type === 'ability') {
      const o = k.abilities[f.index];
      cells.set(f, [o.cell, o.a, o.b]);
    }
  }
  const base: Knowledge = {
    ...k,
    clues: Array(n).fill(null),
    abilities: [],
    knownClaims: Array(n).fill(undefined),
  };
  const lists: Rec[][] = Array.from({ length: 3 * n }, () => []);
  // 알던 사실(힌트로 이미 정한 칸 등)은 앞 단계에서 정한 것처럼 배경으로 둔다: 이에 기대는 이유는 usesEarlier 가 된다
  const bg = new Uint8Array(n).fill(ALL);
  k.knownClaims?.forEach((c, i) => c !== undefined && (bg[i] = CLAIM_MASK[c]));
  return { k, n, base, cells, global, bg, lists, keys: new Set(), size: 0, budget };
}

/**
 * 세계를 반례 묶음에 넣는다. w 는 base 와 맞아야 한다.
 * 이미 있거나, 앞 단계에서 정한 사실과 어긋나거나, 묶음이 꽉 차면 undefined.
 */
function addWorld(ctx: Ctx, w: World): Rec | undefined {
  if (ctx.size >= POOL_MAX) return undefined;
  const { k, n } = ctx;
  const label = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    label[i] = labelAt(w, i);
    if (!(ctx.bg[i] & (1 << label[i]))) return undefined;
  }
  const key = worldKey(w);
  if (ctx.keys.has(key)) return undefined;
  ctx.keys.add(key);
  const ok = new Uint8Array(n + k.abilities.length);
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (c) ok[i] = statementHolds(k.w, k.h, w, i, c) ? 1 : 0;
  }
  k.abilities.forEach((o, j) => {
    const t = abilityTruth(w, o.cell, o.a, o.b);
    ok[n + j] = t === 'any' || t === o.same ? 1 : 0;
  });
  const rec: Rec = { dead: false, w, label, ok };
  for (let i = 0; i < n; i++) ctx.lists[i * 3 + label[i]].push(rec);
  ctx.size++;
  return rec;
}

/** base 의 c·d 칸 직업을 맞바꾼 세계. 증인 직업은 새 칸의 정규 값으로, 오염 대상은 규칙에 맞게(겹치지 않게) 고친다. */
function swapped(k: Knowledge, base: World, c: number, d: number): World {
  const n = k.w * k.h;
  const roles = [...base.roles];
  const put = (i: number, r: string) => (roles[i] = role(r).camp === 'witness' ? witnessValue(k, i) : r);
  put(c, base.roles[d]);
  put(d, base.roles[c]);
  const taint = [...base.taint];
  taint[c] = base.taint[d];
  taint[d] = base.taint[c];
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (!role(roles[i]).taint) {
      taint[i] = -1;
      continue;
    }
    const elig = taintEligible(k.w, k.h, roles, i).filter((j) => !used.has(j));
    if (elig.length === 0) taint[i] = -1;
    else if (!elig.includes(taint[i])) taint[i] = elig[0];
    if (taint[i] >= 0) used.add(taint[i]);
  }
  return { roles, taint };
}

/** 처음 반례 묶음: 다 아는 관찰의 세계와, 그 세계에서 꼬리표가 다른 두 칸을 맞바꾼 것 중 base 와 맞는 것 */
function seedPool(ctx: Ctx, full: World[]): void {
  const { k, n } = ctx;
  for (const b of full.slice(0, SEED_BASES)) {
    addWorld(ctx, b);
    for (let c = 0; c < n; c++) for (let d = c + 1; d < n; d++) {
      if (labelAt(b, c) === labelAt(b, d)) continue;
      const w = swapped(k, b, c, d);
      if (consistent(ctx.base, w)) addWorld(ctx, w);
    }
  }
}

/** 칸 cell 이 claim 으로 정해졌다: 배경에 더하고, 어긋나는 세계를 반례 묶음에서 뺀다 (배경은 좁아지기만 한다) */
function addBackground(ctx: Ctx, cell: number, claim: Claim): void {
  const mask = ctx.bg[cell] & CLAIM_MASK[claim];
  for (let l = 0; l < 3; l++) {
    if (mask & (1 << l)) continue;
    const wrong = ctx.lists[cell * 3 + l];
    for (const r of wrong) if (!r.dead) {
      r.dead = true;
      ctx.size--;
    }
  }
  ctx.bg[cell] = mask;
  for (let i = 0; i < ctx.lists.length; i++) ctx.lists[i] = ctx.lists[i].filter((r) => !r.dead);
}

function holds(ctx: Ctx, r: Rec, f: Fact): boolean {
  return f.type === 'clue' ? r.ok[f.cell] === 1 : r.ok[ctx.n + f.index] === 1;
}

/**
 * S 가 "칸 c 는 claim" 을 증명하는가: base 에 S 의 진술·능력(+ withBg 면 앞 단계에서 정한 사실)만 더한 관찰에서
 * c 가 claim 이 아닌 세계가 하나도 없으면 증명한다. 반례 묶음에서 먼저 찾고(묶음의 세계는 배경과 맞으므로
 * 배경이 없는 질문에도 반례가 된다), 없으면 맞바꿔 보고, 그래도 없으면 풀어서 찾는다.
 */
function proves(ctx: Ctx, S: Fact[], c: number, claim: Claim, withBg: boolean): boolean {
  const cm = CLAIM_MASK[claim];
  const counter = [0, 1, 2].filter((l) => !(cm & (1 << l)));
  for (const l of counter) {
    const list = ctx.lists[c * 3 + l];
    outer: for (let i = 0; i < list.length; i++) {
      const r = list[i];
      for (const f of S) if (!holds(ctx, r, f)) continue outer;
      if (i > 0) {
        list[i] = list[0];
        list[0] = r;
      }
      return false;
    }
  }
  // S 를 만족하고 c 가 claim 인 세계에서, c 에 claim 밖의 꼬리표를 줄 칸(배경 밖) 하나와 맞바꿔 본다
  const sat = (r: Rec) => S.every((f) => holds(ctx, r, f));
  if (withBg) {
    let tried = 0;
    for (let l = 0; l < 3 && tried < MUT_SOURCES; l++) {
      if (!(cm & (1 << l))) continue;
      const src = ctx.lists[c * 3 + l];
      for (let i = 0; i < src.length && tried < MUT_SOURCES; i++) {
        const r0 = src[i];
        if (!sat(r0)) continue;
        tried++;
        for (let d = 0; d < ctx.n; d++) {
          if (cm & (1 << r0.label[d]) || ctx.bg[d] !== ALL) continue;
          const w = swapped(ctx.k, r0.w, c, d);
          if (!consistent(ctx.base, w)) continue;
          const r = addWorld(ctx, w);
          if (r && sat(r)) return false;
        }
      }
    }
  }
  const { k, n, base } = ctx;
  const knownClaims = [...base.knownClaims!];
  const r: Knowledge = { ...base, clues: Array(n).fill(null), abilities: [], knownClaims };
  for (const f of S) {
    if (f.type === 'clue') r.clues[f.cell] = k.clues[f.cell];
    else r.abilities.push(k.abilities[f.index]);
  }
  if (withBg) ctx.bg.forEach((b, i) => b !== ALL && (knownClaims[i] = maskClaim(b)));
  // c 와 S 가 닿는 칸을 먼저 채워 모순을 일찍 찾는다. 판 전체 진술은 말한 칸과(가장 가까운 악이면 기준 칸에서 N 걸음 안, 가까운 순)
  const first = new Set<number>([c]);
  for (const f of S) {
    if (f.type === 'clue' && ctx.global.has(f)) {
      first.add(f.cell);
      const cl = k.clues[f.cell]!;
      if (cl.kind === 'nearest') {
        const near = Array.from({ length: n }, (_, j) => j).filter((j) => j !== cl.base && steps(k.w, cl.base, j) <= cl.n!);
        near.sort((a, b) => steps(k.w, cl.base, a) - steps(k.w, cl.base, b));
        for (const x of near) first.add(x);
      }
    } else for (const x of ctx.cells.get(f)!) first.add(x);
  }
  const order = [...first];
  for (let i = 0; i < n; i++) if (!first.has(i)) order.push(i);
  let found = 0;
  for (const l of counter) {
    if (withBg && !(ctx.bg[c] & (1 << l))) continue;
    knownClaims[c] = LABEL_CLAIM[l];
    forEachWorld(
      r,
      (w) => {
        addWorld(ctx, w);
        return ++found >= DFS_KEEP;
      },
      order,
      ctx.budget,
    );
    if (found > 0) return false;
  }
  // 한도로 멈춘 탐색은 반례가 없다는 증명이 아니다
  return !ctx.budget?.expired;
}

/**
 * 칸 c 의 진술·능력 묶음 (크기 0 ~ 3): 첫 사실은 c 에 닿고, 다음 사실은 c 나 앞에서 고른 사실이 닿는 칸에 닿는다.
 * 판 전체를 참조하는 진술은 어느 칸에나 닿지만 이어짐을 넓히지 않는다.
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

/**
 * 칸마다 가능한 꼬리표 집합. worlds 가 전부면(capped 아님) 그것으로, 아니면 worlds 에 안 나온 꼬리표마다
 * "그 꼬리표인 세계가 있는가"를 풀어서 묻는다. 한도로 멈춘 질문은 "있다"로 친다 (좁히는 쪽은 늘 증명이다).
 */
function possibleMasks(k: Knowledge, worlds: World[], capped: boolean, budget?: Budget): Uint8Array {
  const n = k.w * k.h;
  const known = Array.from({ length: n }, (_, i) => knownMaskAt(k, i));
  const mask = new Uint8Array(n);
  for (const w of worlds) for (let i = 0; i < n; i++) mask[i] |= 1 << labelAt(w, i);
  if (!capped) return mask;
  for (let i = 0; i < n; i++) {
    for (let l = 0; l < 3; l++) {
      if (mask[i] & (1 << l) || !(known[i] & (1 << l))) continue;
      if (overBudget(budget)) {
        mask[i] |= 1 << l;
        continue;
      }
      const knownClaims = [...(k.knownClaims ?? Array(n).fill(undefined))];
      knownClaims[i] = LABEL_CLAIM[l];
      let found = false;
      forEachWorld({ ...k, knownClaims }, () => (found = true), undefined, budget);
      if (found || budget?.expired) mask[i] |= 1 << l;
    }
  }
  return mask;
}

/**
 * 모든 세계에서 꼬리표 집합이 좁혀졌는데 아직 단계로 안 적은 칸을, 이유가 작은 순으로 limit 개까지.
 * worlds 는 관찰과 맞는 세계(capped 면 일부). 주범 칸이 모두 정해지면 멈춘다. budget 을 넘으면 더 찾지 않고,
 * 남은 칸은 'all' 로 적는다 (가능한 꼬리표는 세계 전부나 끝까지 푼 질문으로 구했으므로 'all' 도 증명이다).
 */
function stepsFrom(k: Knowledge, worlds: World[], capped: boolean, limit: number, budget?: Budget): Step[] {
  const n = k.w * k.h;
  if (worlds.length === 0) return [];
  const facts: Fact[] = [];
  k.clues.forEach((c, cell) => c && facts.push({ type: 'clue', cell }));
  k.abilities.forEach((_, index) => facts.push({ type: 'ability', index }));
  const ctx = makeCtx(k, facts, budget);
  const knewSome = ctx.bg.some((b) => b !== ALL);
  const possible = possibleMasks(k, worlds, capped, budget);
  seedPool(ctx, worlds);
  const forced: (Claim | undefined)[] = Array.from({ length: n }, (_, i) => {
    const p = possible[i];
    if (p === knownMaskAt(k, i)) return undefined; // 새로 알 것이 없다
    return maskClaim(p);
  });
  const bosses = k.inPlay.filter((id) => role(id).camp === 'boss').length;
  const bossesKnown = () => Array.from(ctx.bg).filter((b, i) => (b & knownMaskAt(k, i)) === 4).length;

  const combos: (Fact[][][] | undefined)[] = Array(n).fill(undefined);
  const out: Step[] = [];
  const left = new Set(forced.flatMap((s, i) => (s ? [i] : [])));
  while (left.size > 0 && out.length < limit && bossesKnown() < bosses) {
    let pick: Step | undefined;
    // 배경이 늘면 전에 안 되던 묶음이 될 수 있으므로 단계마다 다시 따진다
    search: for (let size = 0; size <= MAX_REASON; size++) {
      for (const c of [...left].sort((a, b) => a - b)) {
        const claim = forced[c]!;
        for (const S of (combos[c] ??= clueCombos(ctx, facts, c))[size]) {
          if (overBudget(budget)) break search;
          if (!proves(ctx, S, c, claim, true)) continue;
          // 한도로 멈춰 false 가 나와도 'S + 앞 단계' 로는 증명됐으므로 usesEarlier = true 는 맞는 말이다
          const usesEarlier = (out.length > 0 || knewSome) && !proves(ctx, S, c, claim, false);
          pick = { cell: c, claim, because: S, usesEarlier };
          break search;
        }
      }
    }
    if (!pick) {
      const c = Math.min(...left);
      pick = { cell: c, claim: forced[c]!, because: 'all', usesEarlier: false };
    }
    out.push(pick);
    left.delete(pick.cell);
    addBackground(ctx, pick.cell, pick.claim);
  }
  return out;
}

/** 관찰 k 에서 주범을 모두 정할 때까지의 단계. 맞는 세계가 없으면 빈 목록. */
export function explain(k: Knowledge): Step[] {
  const { worlds, capped } = solve(k, WORLD_CAP);
  return stepsFrom(k, worlds, capped, Infinity);
}

/**
 * explain 을 ms 안에서만: 시간 안에 다 따지면 explain 과 같은 단계, 넘으면 null.
 * 주범 3명·모사꾼이 있는 큰 판은 해설에 수십 초가 걸릴 수 있어, 스테이지 고르기와 무한 모드 결과 화면이 쓴다.
 */
export function explainWithin(k: Knowledge, ms: number): Step[] | null {
  const budget: Budget = { deadline: performance.now() + ms, expired: false };
  const { worlds, capped } = solve(k, WORLD_CAP, budget);
  if (overBudget(budget)) return null;
  const out = stepsFrom(k, worlds, capped, Infinity, budget);
  return budget.expired ? null : out;
}

/**
 * 이유 크기 1 → 1점, 2 → 2점, 3 → 4점, 'all' → 8점. 진술이 필요한 단계의 평균을 1 ~ 5 로 나눈다.
 * 경계값은 무한 모드 n = 1 ~ 30 (각 6판) 분포로 정했다: 3×3 1등급(n 1 ~ 2)은 0.8 ~ 1.2 → 1 ~ 2,
 * 4×5(n 18 ~ 30)는 0.7 ~ 5.0 으로 넓게 퍼지고 대부분 3 ~ 5 (스테이지는 난이도로 골라 쓴다).
 */
const POINTS = [0, 1, 2, 4];
export const DIFFICULTY_BOUNDS = [1.1, 1.8, 2.6, 3.4] as const; // 평균이 이 값 이상이면 2, 3, 4, 5
export function difficulty(all: Step[]): 1 | 2 | 3 | 4 | 5 {
  // 진술 없이 정해지는 단계(겉 직업·인원표만, 앞에서 정한 것만)는 0점이라 평균만 끌어내리므로 뺀다.
  // 주범 사냥에서는 인원표로 정해지는 칸이 많다.
  const stepList = all.filter((st) => st.because === 'all' || st.because.length > 0);
  if (stepList.length === 0) return 1;
  const total = stepList.reduce((s, st) => s + (st.because === 'all' ? 8 : POINTS[st.because.length]), 0);
  const avg = total / stepList.length;
  let d = 1;
  for (const b of DIFFICULTY_BOUNDS) if (avg >= b) d++;
  return d as 1 | 2 | 3 | 4 | 5;
}

/**
 * 다음 한 단계. 관찰이 부족하면(정해지는 칸이 없으면) 조사할 칸, 조사할 칸이 없으면 안 쓴 능력 칸.
 * 그것도 없으면(유효한 사건에서는 남은 칸이 이미 다 정해진 때뿐) 첫 능력 칸, 능력 칸도 없으면 0번 조사.
 * k.knownClaims 의 칸(앞 힌트로 정한 칸 등)과 체포한 칸은 새로 알 것이 없으면 다시 가리키지 않는다.
 * budgetMs 안에 세계·질문을 다 못 풀면 조사·능력 힌트로, 이유를 다 못 따지면 'all' 단계로 답한다. 단계는 늘 증명된 것이다.
 */
export function nextHint(k: Knowledge, budgetMs = HINT_BUDGET_MS): Hint {
  const n = k.w * k.h;
  const budget: Budget = { deadline: performance.now() + budgetMs, expired: false };
  try {
    const { worlds, capped } = solve(k, HINT_CAP, budget);
    if (!budget.expired) {
      const [step] = stepsFrom(k, worlds, capped, 1, budget);
      if (step) return { kind: 'step', step };
    }
  } catch {
    // 아래의 조사 힌트로
  }
  for (let i = 0; i < n; i++) if (k.faces[i] === undefined && k.arrested[i] === undefined) return { kind: 'investigate', cell: i };
  const used = new Set(k.abilities.map((o) => o.cell));
  const abil = k.faces.flatMap((f, i) => (f !== undefined && role(f).ability ? [i] : []));
  const cell = abil.find((i) => !used.has(i)) ?? abil[0];
  return cell === undefined ? { kind: 'investigate', cell: 0 } : { kind: 'ability', cell };
}

const hasBatchim = (s: string): boolean => {
  const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const josa = (s: string, withB: string, without: string) => s + (hasBatchim(s) ? withB : without);
export const CLAIM_NAME: Record<Claim, string> = { good: '선', evil: '악', boss: '주범', notBoss: '주범이 아님', accomplice: '공범' };

/** "A", "A와 B", "A, B와 C" */
function joinAnd(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -2).map((x) => `${x}, `).join('')}${josa(items[items.length - 2], '과', '와')} ${items[items.length - 1]}`;
}

/** 해설 한 줄. 칸 번호는 1부터, 이름은 겉 직업. */
export function describeStep(step: Step, def: CaseDef): string {
  const head = `${step.cell + 1}번은 ${CLAIM_NAME[step.claim]}: `;
  if (step.because === 'all') return `${head}모든 경우를 따져 보면 이렇게만 맞는다.`;
  const name = (i: number) => `${i + 1}번 ${role(def.faces[i]).name}`;
  if (step.because.length === 0) {
    if (step.usesEarlier) return `${head}앞에서 정한 것만으로 정해진다.`;
    const fd = role(def.faces[step.cell]);
    if (fd.camp === 'trouble') return `${head}겉 직업이 말썽꾼(${fd.name})이다.`;
    return `${head}겉 직업과 직업 목록만으로 정해진다.`;
  }
  const fs = step.because;
  const phrase = fs.every((f) => f.type === 'clue')
    ? `${joinAnd(fs.map((f) => name(f.cell)))}의 진술`
    : joinAnd(fs.map((f) => (f.type === 'clue' ? `${name(f.cell)}의 진술` : `${f.index + 1}번째 능력 결과`)));
  const tail = '다른 경우는 맞지 않는다.';
  if (step.usesEarlier) {
    const all = `앞에서 정한 것${fs.length === 1 ? '과' : ','} ${phrase}`;
    return `${head}${josa(all, '을', '를')} 함께 보면 ${tail}`;
  }
  return fs.length === 1 ? `${head}${phrase}만 보아도 ${tail}` : `${head}${josa(phrase, '을', '를')} 함께 보면 ${tail}`;
}
