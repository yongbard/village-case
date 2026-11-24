export type Camp = 'witness' | 'trouble' | 'accomplice' | 'boss';
export type Side = 'good' | 'evil'; // 선 = 증인·말썽꾼, 악 = 공범·주범
export type RoleId = string;
export const ANY_WITNESS = '*w'; // 직업을 모르는 진짜 증인
export type Mode = 'true' | 'false' | 'any' | 'over' | 'shield'; // over: 실제보다 큰 수(허풍쟁이), shield: 주범을 선으로 치고 참말(협박당한 증인)
export type ClueKind =
  | 'evil4'
  | 'evil8'
  | 'evilRow'
  | 'evilCol'
  | 'nearest'
  | 'pairOne'
  | 'bossRow'
  | 'diag'
  | 'atLeastOne'
  | 'adjPair'
  | 'halves'
  | 'bossDir'
  | 'alibi'
  | 'accuse'
  | 'sameSide';
export type Dir = 'up' | 'down' | 'left' | 'right';
/**
 * 진술. base 는 기준 칸(보통 말한 칸, 길치는 옆집). n 의 뜻: 수 세기·거리는 수, halves 는 -1 왼쪽이 많음 / 0 같음 / 1 오른쪽이 많음,
 * adjPair 는 1 있음 / 0 없음, bossRow 는 r 번째 가로줄의 주범 수. a·b 는 대상 칸, cells 는 atLeastOne 의 세 칸.
 */
export interface Clue {
  kind: ClueKind;
  base: number;
  n?: number;
  a?: number;
  b?: number;
  cells?: number[];
  r?: number; // bossRow 가로줄 (1부터)
  dir?: Dir; // bossDir
}
export interface RoleDef {
  id: RoleId;
  name: string;
  camp: Camp;
  tier: 1 | 2 | 3 | 4 | 5;
  desc: string;
  clue?: ClueKind; // 이 직업이 겉 직업일 때 진술 형식
  ability?: 'pairSame'; // 이 직업이 겉 직업일 때 능력
  trigger?: number; // 진술이 공개되는 경과 시간
  mode?: Mode; // 진짜 직업일 때 말하는 방식. 기본: 증인 'true', 공범·주범 'false'
  face?: 'self' | 'witness'; // 기본: 증인·말썽꾼 'self', 공범·주범 'witness'
  taint?: 'adj4' | 'any'; // 대상 범위
  effect?: 'lie' | 'shield' | 'frame'; // 대상에게 하는 일: 거짓말시킴(바꿔치기·매수), 주범 감싸기(협박), 누명
  decoy?: boolean; // 대역: 주범을 가리키는 진술에서 주범으로 세어짐
  place?: 'bossIn8';
  hiddenFromCounts?: boolean; // 그림자
  shift?: 'right'; // 길치
  weight: number; // 생성 가중치 (조정값)
}
export interface World {
  roles: RoleId[];
  taint: number[]; // taint[i] = i 칸 오염원의 대상 칸, 아니면 -1
}
export interface AbilityObs {
  cell: number;
  a: number;
  b: number;
  same: boolean;
}
export interface Knowledge {
  w: number;
  h: number;
  inPlay: RoleId[]; // 이번 사건의 말썽꾼·공범·주범 (같은 직업이 여럿이면 여러 번, 정렬)
  roster: Record<RoleId, number>; // 이번 사건의 직업별 인원 (증인 포함, 사건 시작 때 공개)
  faces: (RoleId | undefined)[]; // undefined = 조사 안 함
  clues: (Clue | null)[]; // 보이는 진술 (없으면 null)
  abilities: AbilityObs[];
  arrested: (RoleId | undefined)[]; // 체포로 드러난 진짜 직업
  knownSides?: (Side | undefined)[]; // 해설용: 이미 추리한 선·악
}
export interface CaseDef {
  seed: number;
  w: number;
  h: number;
  truth: World;
  faces: RoleId[];
  clues: (Clue | null)[];
  inPlay: RoleId[];
  roster: Record<RoleId, number>;
}
