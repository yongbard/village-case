export interface Save {
  v: 1;
  cleared: number[];
  seenCards: string[];
  endlessBest: number;
  endless?: { n: number; rep: number; seed: number };
}

export const SAVE_KEY = 'village-case-save';

const defaultSave = (): Save => ({ v: 1, cleared: [], seenCards: [], endlessBest: 0 });

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function parse(x: unknown): Save | null {
  if (!isObj(x) || x.v !== 1) return null;
  const { cleared, seenCards, endlessBest, endless } = x;
  if (!Array.isArray(cleared) || !cleared.every(isNum)) return null;
  if (!Array.isArray(seenCards) || !seenCards.every((s) => typeof s === 'string')) return null;
  if (!isNum(endlessBest)) return null;
  const s: Save = { v: 1, cleared: [...cleared], seenCards: [...seenCards], endlessBest };
  if (endless !== undefined) {
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
