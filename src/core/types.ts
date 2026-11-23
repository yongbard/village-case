export type Camp = 'witness' | 'trouble' | 'accomplice' | 'boss';
export type RoleId = string;
export const ANY_WITNESS = '*w'; // 직업을 모르는 진짜 증인
export type Mode = 'true' | 'false' | 'any';
export type ClueKind =
  | 'evil4'
  | 'evil8'
  | 'evilRow'
  | 'evilCol'
  | 'nearest'
  | 'pairOne'
  | 'bossRow';
export interface Clue {
  kind: ClueKind;
  base: number;
  n?: number;
  a?: number;
  b?: number;
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
  taint?: 'adj4' | 'any';
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
  inPlay: RoleId[]; // 이번 사건의 말썽꾼·공범·주범 직업 전부, 각 정확히 1번
  faces: (RoleId | undefined)[]; // undefined = 조사 안 함
  clues: (Clue | null)[]; // 보이는 진술 (없으면 null)
  abilities: AbilityObs[];
  arrested: (RoleId | undefined)[]; // 체포로 드러난 진짜 직업
  knownCamps?: (Camp | undefined)[]; // 해설용: 이미 추리한 진영
}
export interface CaseDef {
  seed: number;
  w: number;
  h: number;
  truth: World;
  faces: RoleId[];
  clues: (Clue | null)[];
  inPlay: RoleId[];
}
