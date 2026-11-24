export interface Save {
  v: 2;
  cleared: number[];
  seenCards: string[];
  endlessBest: number;
  endless?: { n: number; rep: number; seed: number };
}

export const SAVE_KEY = 'village-case-save';

const defaultSave = (): Save => ({ v: 2, cleared: [], seenCards: [], endlessBest: 0 });

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** v1(주범 사냥 이전): 해결 기록·본 카드·최고 기록만 옮기고, 규칙이 달라 이어 할 수 없는 무한 모드 사건은 버린다 */
function parse(x: unknown): Save | null {
  if (!isObj(x) || (x.v !== 1 && x.v !== 2)) return null;
  const v1 = x.v === 1;
  const { cleared, seenCards, endlessBest, endless } = x;
  if (!Array.isArray(cleared) || !cleared.every(isNum)) return null;
  if (!Array.isArray(seenCards) || !seenCards.every((s) => typeof s === 'string')) return null;
  if (!isNum(endlessBest)) return null;
  const s: Save = { v: 2, cleared: [...cleared], seenCards: [...seenCards], endlessBest };
  if (endless !== undefined && !v1) {
    if (!isObj(endless) || !isNum(endless.n) || !isNum(endless.rep) || !isNum(endless.seed)) return null;
    s.endless = { n: endless.n, rep: endless.rep, seed: endless.seed };
  }
  return s;
}

export function loadSave(store: Pick<Storage, 'getItem'>): Save {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return defaultSave();
    return parse(JSON.parse(raw)) ?? defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(store: Pick<Storage, 'setItem'>, s: Save): void {
  store.setItem(SAVE_KEY, JSON.stringify(s));
}
