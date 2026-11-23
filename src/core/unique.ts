// 유일해 검사 (설계 5.2 G1·G2·G3).
// 다 조사한 관찰로 맞는 세계를 한 번만 구하고, 능력(G2)은 그 세계 목록을 답으로 나눠 따진다.
import { isEvil, role } from './roles';
import { abilityAnswer, campAt, consistent, modeAt, pairSameFact } from './rules';
import { WORLD_CAP, forEachWorld, solve } from './solve';
import { type AbilityObs, type CaseDef, type Knowledge, type Mode, type World } from './types';

/**
 * 칸마다 선·악 문자 (g 선 = 증인·말썽꾼, e 악 = 공범·주범). G1·G3 은 이 문자열로 비교한다.
 * 진영(4가지)이 아니라 선·악인 이유: 사건은 악 칸을 정확히 다 체포하면 풀리고, 선을 체포하면
 * 증인이든 말썽꾼이든 똑같이 평판 -2 라 플레이에 차이가 없다. 진영으로 비교하면 좀도둑↔두목,
 * 숨은이↔참말하는 증인처럼 관찰이 똑같은 맞바꿈 때문에 유일해가 거의 나오지 않는다.
 */
export function signature(w: World): string {
  return w.roles.map((_, i) => (isEvil(campAt(w, i)) ? 'e' : 'g')).join('');
}

/** 전부 조사, 시각 계기 진술까지 공개, 능력·체포 없음 */
export function fullKnowledge(def: CaseDef): Knowledge {
  return {
    w: def.w,
    h: def.h,
    inPlay: [...def.inPlay],
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

/** G2 가 보는 세계의 요약: 선·악 문자열, 칸마다 악인가, 능력 칸마다 말하는 방식 */
interface Pt {
  sig: string;
  evil: boolean[];
  mode: Map<number, Mode>;
}

function uniform(ws: Pt[]): boolean {
  return ws.every((p) => p.sig === ws[0].sig);
}

/**
 * G2: 남은 능력 칸 cells 로, 어떤 답이 나와도 선·악 배치가 하나로 좁혀지는 대상을 고를 수 있는가.
 * 세계 p 에서 칸 c 의 답: 'true' → 같은 편인가, 'false' → 그 반대, 'any' → 두 묶음 모두에 넣는다.
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
          const same = p.evil[a] === p.evil[b];
          if (m === 'any' || (m === 'true') === same) yes.push(p);
          if (m === 'any' || (m === 'true') !== same) no.push(p);
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
  // 능력 k 번의 답으로 나뉘는 묶음은 많아야 2^k 개이고 묶음마다 선·악 배치가 하나여야 하므로,
  // 서로 다른 선·악 배치가 2^k 개를 넘으면 더 볼 것 없이 'ambiguous' 다.
  const maxSigs = 2 ** cells.length;
  const sigs = new Set<string>();
  // G2 에 필요한 것만 남겨 같은 것은 하나로 합친다 (선·악 배치 + 능력 칸의 말하는 방식)
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
    const mode = new Map(cells.map((c) => [c, modeAt(w, c)] as const));
    const key = `${sig}|${cells.map((c) => mode.get(c)).join(',')}`;
    if (!pts.has(key)) pts.set(key, { sig, evil: [...sig].map((ch) => ch === 'e'), mode });
  });
  if (sigs.size > maxSigs) return { ok: false, reason: 'ambiguous' };
  if (capped) return { ok: false, reason: 'tooMany' };
  if (!g2([...pts.values()], cells, n)) return { ok: false, reason: 'ambiguous' };
  // 실제 세계는 맞는 세계이므로 목록 안에 있고, G2 가 성립하면 실제 답으로 남는 묶음의 배치가 곧 실제 배치다.
  return { ok: true, signature: signature(def.truth) };
}

/**
 * 다 조사한 뒤 능력을 G2 대로 쓴 관찰: 실제 답(abilityAnswer)으로 선·악이 하나로 좁혀지는 대상을 찾아 능력 관찰을 더한다.
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
          const m = modeAt(w, cell);
          return m === 'any' || same === (m === 'true' ? pairSameFact(w, a, b) : !pairSameFact(w, a, b));
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
