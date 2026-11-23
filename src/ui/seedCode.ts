// 사건 코드: 무한 모드 n 번째 사건과 그 시드를 "n-시드" 로 적는다. 같은 코드는 같은 사건이다.
export interface CaseCode {
  n: number;
  seed: number;
}

/** 숫자만 넣은 시드가 쓰는 단계 (endlessParams(10)) */
export const PLAIN_SEED_N = 10;
const MAX_SEED = 4294967295;
const MAX_N = 999;

export const formatCode = (c: CaseCode): string => `${c.n}-${c.seed}`;

/** "n-시드" 또는 0 이상의 정수. 그 밖의 입력은 null. */
export function parseCode(raw: string): CaseCode | null {
  const t = raw.trim();
  const m = /^(?:(\d{1,3})-)?(\d{1,10})$/.exec(t);
  if (!m) return null;
  const seed = Number(m[2]);
  if (seed > MAX_SEED) return null;
  if (m[1] === undefined) return { n: PLAIN_SEED_N, seed };
  const n = Number(m[1]);
  return n >= 1 && n <= MAX_N ? { n, seed } : null;
}
