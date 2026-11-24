import { abilityAnswer, campAt } from './rules';
import { isEvil, role } from './roles';
import { ANY_WITNESS, type AbilityObs, type CaseDef, type Clue, type Knowledge, type Side } from './types';

export type Note = 'good' | 'evil' | 'unsure';
export interface Game {
  def: CaseDef;
  hour: number;
  rep: number;
  investigated: boolean[];
  arrested: boolean[];
  used: boolean[];
  abilities: AbilityObs[];
  notes: (Note | undefined)[];
  status: 'playing' | 'solved' | 'failed';
}

const inRange = (g: Game, i: number): boolean => Number.isInteger(i) && i >= 0 && i < g.def.w * g.def.h;

export function newGame(def: CaseDef, rep = 10): Game {
  const n = def.w * def.h;
  return {
    def,
    hour: 0,
    rep,
    investigated: Array(n).fill(false),
    arrested: Array(n).fill(false),
    used: Array(n).fill(false),
    abilities: [],
    notes: Array(n).fill(undefined),
    status: 'playing',
  };
}

const set = <T>(arr: T[], i: number, v: T): T[] => arr.map((x, k) => (k === i ? v : x));

export function investigate(g: Game, cell: number): Game {
  if (g.status !== 'playing' || !inRange(g, cell) || g.investigated[cell] || g.arrested[cell]) return g;
  return { ...g, hour: g.hour + 2, investigated: set(g.investigated, cell, true) };
}

export function arrest(g: Game, cell: number): Game {
  if (g.status !== 'playing' || !inRange(g, cell) || g.arrested[cell]) return g;
  const arrested = set(g.arrested, cell, true);
  const rep = isEvil(campAt(g.def.truth, cell)) ? g.rep : g.rep - 2;
  const solved = g.def.truth.roles.every((_, i) => !isEvil(campAt(g.def.truth, i)) || arrested[i]);
  const status = solved ? 'solved' : rep <= 0 ? 'failed' : 'playing';
  return { ...g, hour: g.hour + 1, arrested, rep, status };
}

export function useAbility(g: Game, cell: number, a: number, b: number): Game {
  if (g.status !== 'playing' || !inRange(g, cell) || !inRange(g, a) || !inRange(g, b)) return g;
  if (!g.investigated[cell] || g.used[cell]) return g;
  if (role(g.def.faces[cell]).ability !== 'pairSame') return g;
  if (a === b || a === cell || b === cell) return g;
  const obs: AbilityObs = { cell, a, b, same: abilityAnswer(g.def, cell, a, b) };
  return { ...g, used: set(g.used, cell, true), abilities: [...g.abilities, obs] };
}

/** 메모는 사건이 끝난 뒤에는 바꿀 수 없다(같은 객체를 돌려준다). */
export function setNote(g: Game, cell: number, note?: Note): Game {
  if (g.status !== 'playing' || !inRange(g, cell) || g.notes[cell] === note) return g;
  return { ...g, notes: set(g.notes, cell, note) };
}

export function visibleClue(g: Game, cell: number): Clue | null {
  if (!inRange(g, cell) || !g.investigated[cell]) return null;
  const trigger = role(g.def.faces[cell]).trigger;
  if (trigger !== undefined && g.hour < trigger) return null;
  return g.def.clues[cell];
}

export function knowledgeOf(g: Game): Knowledge {
  const { def } = g;
  const n = def.w * def.h;
  const idx = Array.from({ length: n }, (_, i) => i);
  return {
    w: def.w,
    h: def.h,
    inPlay: def.inPlay,
    roster: def.roster,
    faces: idx.map((i) => (g.investigated[i] ? def.faces[i] : undefined)),
    clues: idx.map((i) => visibleClue(g, i)),
    abilities: g.abilities,
    arrested: idx.map((i) => {
      if (!g.arrested[i]) return undefined;
      const r = def.truth.roles[i];
      return r === ANY_WITNESS ? def.faces[i] : r;
    }),
  };
}

/**
 * 힌트에 넘길 관찰: knowledgeOf 에 이미 아는 선·악(knownSides)을 더한다. proven 은 앞 힌트가 증명한 칸이고,
 * 겉 직업이 말썽꾼인 칸은 그 말썽꾼 자신(선)이라 보이는 대로 안다. 다음 힌트는 이 칸들을 다시 가리키지 않는다.
 */
export function hintKnowledge(g: Game, proven: readonly (Side | undefined)[]): Knowledge {
  const k = knowledgeOf(g);
  k.knownSides = k.faces.map(
    (f, i) => proven[i] ?? (f !== undefined && role(f).camp === 'trouble' ? 'good' : undefined),
  );
  return k;
}
