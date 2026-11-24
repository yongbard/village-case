// 진술·능력 결과·자백을 화면 문장으로 (주범 사냥 설계 4.3). 직업 말머리 + 사실. 사실에는 칸 번호를 직접 적는다(1부터).
// 문장은 겉 직업과 진술만으로 만든다: 위장한 악인이나 거짓말하게 된 증인도 똑같은 문장으로 말한다.
import { halvesOf, sideCells, steps } from '../core/board';
import { countCells, isCountKind } from '../core/rules';
import { type Confession } from '../core/game';
import { type AbilityObs, type Clue, type Dir, type RoleId } from '../core/types';

/** 직업마다 말머리 (사실 정보 없음). {a}·{b} 는 대상 칸 번호 */
const PREFIX: Record<RoleId, string> = {
  postman: '배달 돌며 봤어요.',
  pharmacist: '약 사러 온 이웃 얘기예요.',
  mayor: '반상회 명부 기준이에요.',
  guard: '순찰 기록이에요.',
  taxi: '택시로 대각선 길을 달렸어요.',
  baker: '새벽 배달 길 기준이에요.',
  photographer: '사진을 현상해 봤어요.',
  priest: '고해를 들었어요.',
  barber: '손님들 얘기를 들었어요.',
  laundry: '맡긴 옷들을 세어 봤어요.',
  dog: '개가 짖은 쪽이에요.',
  restaurant: '{a}번은 밤새 우리 가게에 있었어요.',
  grandma: '{a}번이 밤마다 수상하게 나가던데.',
  operator: '{a}번과 {b}번은 밤마다 통화해요.',
  bellringer: '종탑에서 봤어요.',
  reporter: '취재해 보니',
  braggart: '내가 다 봤다니까!',
  lost: '우리 집 근처 얘기예요.',
  gossip: '들은 얘기예요~',
};

/** 칸 목록 "2·4·6·8" (1부터, 오름차순) */
const list = (cells: number[]) => [...cells].sort((a, b) => a - b).map((i) => i + 1).join('·');

const DIR_NAME: Record<Dir, string> = { up: '위쪽 가로줄', down: '아래쪽 가로줄', left: '왼쪽 세로줄', right: '오른쪽 세로줄' };

/** 진술 c 의 사실 부분 */
function fact(c: Clue, w: number, h: number): string {
  const many = (n: number) => (n === 0 ? '악은 없어요.' : `악은 ${n}명이에요.`);
  switch (c.kind) {
    case 'evil4': return `상하좌우 ${list(countCells(w, h, c))}번 중 ${many(c.n!)}`;
    case 'evil8': return `둘러싼 ${list(countCells(w, h, c))}번 중 ${many(c.n!)}`;
    case 'evilRow': return `같은 가로줄 ${list(countCells(w, h, c))}번 중 ${many(c.n!)}`;
    case 'evilCol': return `같은 세로줄 ${list(countCells(w, h, c))}번 중 ${many(c.n!)}`;
    case 'diag': return `대각선 ${list(countCells(w, h, c))}번 중 ${many(c.n!)}`;
    case 'nearest': return c.n === 0 ? '저 말고는 악이 없어요.' : `가장 가까운 악은 상하좌우로 ${c.n}칸 가야 있어요.`;
    case 'pairOne': return `${c.a! + 1}번과 ${c.b! + 1}번 중 정확히 1명이 악이에요.`;
    case 'atLeastOne': return `${list(c.cells!)}번 중 적어도 1명은 악이에요.`;
    case 'adjPair': return `악끼리 상하좌우로 붙어 사는 집이 ${c.n === 1 ? '있어요' : '없어요'}.`;
    case 'halves': {
      const [L, R] = halvesOf(w, h);
      const l = `왼쪽(${list(L)}번)`;
      const r = `오른쪽(${list(R)}번)`;
      if (c.n === 0) return `${l}과 ${r}의 악 수가 같아요.`;
      return c.n === 1 ? `악은 ${l}보다 ${r}에 더 많아요.` : `악은 ${r}보다 ${l}에 더 많아요.`;
    }
    case 'bossDir': return `${DIR_NAME[c.dir!]}(${list(sideCells(w, h, c.base, c.dir!))}번)에 주범이 있어요.`;
    case 'alibi': return `${c.a! + 1}번은 선이에요.`;
    case 'accuse': return `${c.a! + 1}번은 악이에요.`;
    case 'sameSide': return `${c.a! + 1}번과 ${c.b! + 1}번은 같은 편이에요.`;
    case 'bossRow': {
      const row = `위에서 ${c.r}번째 가로줄(${list(rowCells(w, c.r!))}번)에`;
      return c.n === 0 ? `${row} 주범은 없어요.` : `${row} 주범이 ${c.n}명 있어요.`;
    }
  }
}

const rowCells = (w: number, r: number) => Array.from({ length: w }, (_, x) => (r - 1) * w + x);

function prefix(face: RoleId, a?: number, b?: number): string {
  return (PREFIX[face] ?? '').replace(/\{a\}/g, String((a ?? 0) + 1)).replace(/\{b\}/g, String((b ?? 0) + 1));
}

/** w×h 판에서 칸 cell 이 겉 직업 face 로 한 진술 c 의 문장 */
export function clueText(c: Clue, cell: number, w: number, h: number, face: RoleId): string {
  void cell;
  const p = prefix(face, c.a, c.b);
  return p ? `${p} ${fact(c, w, h)}` : fact(c, w, h);
}

/** 진술 c 가 가리키는 칸 (판에 빨간 동그라미), 두 사람 관계면 잇는 실 */
export function clueMarks(c: Clue, w: number, h: number): { cells: number[]; link?: [number, number] } {
  if (isCountKind(c.kind)) return { cells: [...countCells(w, h, c)].sort((a, b) => a - b) };
  const all = Array.from({ length: w * h }, (_, i) => i);
  switch (c.kind) {
    case 'nearest': return { cells: c.n === 0 ? [] : all.filter((i) => i !== c.base && steps(w, c.base, i) === c.n) };
    case 'pairOne':
    case 'sameSide':
      return { cells: [c.a!, c.b!], link: [c.a!, c.b!] };
    case 'alibi':
    case 'accuse':
      return { cells: [c.a!] };
    case 'atLeastOne': return { cells: [...c.cells!].sort((a, b) => a - b) };
    case 'adjPair': return { cells: [] };
    case 'halves': {
      const [L, R] = halvesOf(w, h);
      return { cells: [...L, ...R].sort((a, b) => a - b) };
    }
    case 'bossDir': return { cells: sideCells(w, h, c.base, c.dir!) };
    case 'bossRow': return { cells: rowCells(w, c.r!) };
    default: return { cells: [] };
  }
}

/** 시각 계기 전의 진술 자리 */
export function pendingText(trigger: number): string {
  return `${trigger}시간에 말함`;
}

/** 능력 결과 문장 (겉 직업 face 의 말머리) */
export function abilityText(o: AbilityObs, face: RoleId): string {
  const p = prefix(face);
  const f = `${o.a + 1}번과 ${o.b + 1}번은 ${o.same ? '같은 편' : '다른 편'}이에요.`;
  return p ? `${p} ${f}` : f;
}

/** 자백 문장 */
export function confessionText(cf: Confession, w: number, h: number): string {
  const who = cf.decoy ? '나는 대역이었소. ' : '';
  if (cf.col === null) return `자백: ${who}아무것도 모르오.`;
  const cells = Array.from({ length: w * h }, (_, i) => i).filter((i) => i % w === cf.col! - 1);
  return `자백: ${who}주범 중 1명은 왼쪽에서 ${cf.col}번째 세로줄(${list(cells)}번)에 있소.`;
}
