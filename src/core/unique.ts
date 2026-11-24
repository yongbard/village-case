// 유일해 검사 (설계 5.2 G1·G2·G3, 주범 사냥 설계 4.6: 주범 자리가 하나로 정해지는가).
// 다 조사한 관찰로 맞는 세계를 한 번만 구하고, 능력(G2)은 그 세계 목록을 답으로 나눠 따진다.
import { role } from './roles';
import { abilityAnswer, abilityTruth, campAt, consistent, evilIn, modeAt } from './rules';
import { WORLD_CAP, forEachWorld, solve } from './solve';

/** 관찰과 맞는 세계가 하나라도 있는가 */
export function existsWorld(k: Knowledge): boolean {
  let found = false;
  forEachWorld(k, () => (found = true));
  return found;
}
import { type AbilityObs, type CaseDef, type Knowledge, type Mode, type World } from './types';

/**
 * 칸마다 주범인가 (b 주범, . 나머지). G1·G3 은 이 문자열로 비교한다.
 * 게임은 주범을 모두 잡으면 풀리므로 주범 자리만 하나로 정해지면 된다. 공범·말썽꾼·증인 자리는 여러 가능성이 남아도 된다.
 */
export function signature(w: World): string {
  return w.roles.map((_, i) => (campAt(w, i) === 'boss' ? 'b' : '.')).join('');
}

/** 전부 조사, 시각 계기 진술까지 공개, 능력·체포 없음 */
export function fullKnowledge(def: CaseDef): Knowledge {
  return {
    w: def.w,
    h: def.h,
    inPlay: [...def.inPlay],
    roster: { ...def.roster },
    faces: [...def.faces],
    clues: [...def.clues],
    abilities: [],
    arrested: Array(def.w * def.h).fill(undefined),
  };
}

/** 겉 직업에 능력이 있는 칸 */
export function abilityCells(def: CaseDef): number[] {
  return def.faces.flatMap((f, i) => (role(f).ability ? [i] : []));
}

export type CheckResult =
  | { ok: true; signature: string }
  | { ok: false; reason: 'ambiguous' | 'tooMany' | 'truthMismatch' };

/** G2 가 보는 세계의 요약: 주범 문자열, 칸마다 악인가(실제·협박 시점), 능력 칸마다 말하는 방식 */
interface Pt {
  sig: string;
  evil: boolean[];
  evilShield: boolean[];
  mode: Map<number, Mode>;
}

function uniform(ws: Pt[]): boolean {
  return ws.every((p) => p.sig === ws[0].sig);
}

/**
 * G2: 남은 능력 칸 cells 로, 어떤 답이 나와도 주범 자리가 하나로 좁혀지는 대상을 고를 수 있는가.
 * 세계 p 에서 칸 c 의 답: 'true'·'over' → 같은 편인가, 'false' → 그 반대, 'shield' → 주범을 선으로 친 같은 편, 'any' → 두 묶음 모두에.
 */
function g2(ws: Pt[], cells: number[], n: number): boolean {
  if (uniform(ws)) return true;
  if (cells.length === 0) return false;
  for (const c of cells) {
    const rest = cells.filter((x) => x !== c);
    for (let a = 0; a < n; a++) {
      if (a === c) continue;
      for (let b = a + 1; b < n; b++) {
        if (b === c) continue;
        const yes: Pt[] = [];
        const no: Pt[] = [];
        for (const p of ws) {
          const m = p.mode.get(c)!;
          const ans = m === 'any' ? 'any'
            : m === 'shield' ? p.evilShield[a] === p.evilShield[b]
            : m === 'false' ? p.evil[a] !== p.evil[b]
            : p.evil[a] === p.evil[b];
          if (ans !== false) yes.push(p);
          if (ans !== true) no.push(p);
        }
        if ((yes.length === 0 || g2(yes, rest, n)) && (no.length === 0 || g2(no, rest, n))) return true;
      }
    }
  }
  return false;
}

export function checkCase(def: CaseDef): CheckResult {
  // G3: 실제 세계가 자기 겉 직업·진술·오염 규칙과 맞아야 한다. 게임은 기자 답을 def.truth 로
  // 계산하므로, 진영 배치만 맞고 규칙을 어기는 실제 세계는 틀린 답으로 이끈다.
  const k = fullKnowledge(def);
  if (!consistent(k, def.truth)) return { ok: false, reason: 'truthMismatch' };
  const cells = abilityCells(def);
  const n = def.w * def.h;
  // 능력이 없으면 세계를 다 세지 않고 묻는다: 실제 주범 칸마다 "그 칸이 주범이 아닌 세계"가 있으면 갈리지 않는다.
  // 없으면 모든 세계에서 실제 주범 칸이 다 주범이고, 주범 수는 inPlay 로 정해져 있으므로 주범 자리가 하나다.
  // (주범 사냥에서는 공범 자리가 여럿 남는 사건이 많아, 다 세면 WORLD_CAP 에 자주 걸린다.)
  if (cells.length === 0) {
    const bosses = def.truth.roles.flatMap((_, i) => (campAt(def.truth, i) === 'boss' ? [i] : []));
    for (const b of bosses) {
      const knownClaims = Array.from({ length: n }, (_, i) => (i === b ? ('notBoss' as const) : undefined));
      if (existsWorld({ ...k, knownClaims })) return { ok: false, reason: 'ambiguous' };
    }
    return { ok: true, signature: signature(def.truth) };
  }
  // 능력 k 번의 답으로 나뉘는 묶음은 많아야 2^k 개이고 묶음마다 주범 배치가 하나여야 하므로,
  // 서로 다른 주범 배치가 2^k 개를 넘으면 더 볼 것 없이 'ambiguous' 다.
  const maxSigs = 2 ** cells.length;
  const sigs = new Set<string>();
  // G2 에 필요한 것만 남겨 같은 것은 하나로 합친다 (주범 배치 + 선·악 배치 + 능력 칸의 말하는 방식)
  const pts = new Map<string, Pt>();
  let count = 0;
  let capped = false;
  forEachWorld(k, (w) => {
    if (count >= WORLD_CAP) {
      capped = true;
      return true;
    }
    count++;
    const sig = signature(w);
    sigs.add(sig);
    if (sigs.size > maxSigs) return true;
    if (cells.length === 0) return;
    const mode = new Map(cells.map((c) => [c, modeAt(w, c)] as const));
    const evil = w.roles.map((_, i) => evilIn(w, i));
    const evilShield = w.roles.map((_, i) => evilIn(w, i, 'shield'));
    const bits = (xs: boolean[]) => xs.map((x) => (x ? 1 : 0)).join('');
    const key = `${sig}|${bits(evil)}|${bits(evilShield)}|${cells.map((c) => mode.get(c)).join(',')}`;
    if (!pts.has(key)) pts.set(key, { sig, evil, evilShield, mode });
  });
  if (sigs.size > maxSigs) return { ok: false, reason: 'ambiguous' };
  if (capped) return { ok: false, reason: 'tooMany' };
  if (sigs.size > 1 && !g2([...pts.values()], cells, n)) return { ok: false, reason: 'ambiguous' };
  // 실제 세계는 맞는 세계이므로 목록 안에 있고, G2 가 성립하면 실제 답으로 남는 묶음의 배치가 곧 실제 배치다.
  return { ok: true, signature: signature(def.truth) };
}

/**
 * 다 조사한 뒤 능력을 G2 대로 쓴 관찰: 실제 답(abilityAnswer)으로 주범 자리가 하나로 좁혀지는 대상을 찾아 능력 관찰을 더한다.
 * 능력 칸이 없으면 fullKnowledge 그대로. 좁혀지는 길을 못 찾으면(G2 를 어긴 사건) 능력 없이 돌려준다.
 */
export function solvedKnowledge(def: CaseDef): Knowledge {
  const k = fullKnowledge(def);
  const n = def.w * def.h;
  const unique = (ws: World[]) => new Set(ws.map(signature)).size <= 1;
  const search = (ws: World[], left: number[], obs: AbilityObs[]): AbilityObs[] | null => {
    if (unique(ws)) return obs;
    for (const cell of left) {
      const rest = left.filter((x) => x !== cell);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (a === cell || b === cell) continue;
        const same = abilityAnswer(def, cell, a, b);
        const keep = ws.filter((w) => {
          const t = abilityTruth(w, cell, a, b);
          return t === 'any' || t === same;
        });
        const found = search(keep, rest, [...obs, { cell, a, b, same }]);
        if (found) return found;
      }
    }
    return null;
  };
  k.abilities = search(solve(k).worlds, abilityCells(def), []) ?? [];
  return k;
}
