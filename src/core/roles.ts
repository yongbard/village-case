import { ANY_WITNESS, type Camp, type RoleDef, type RoleId } from './types';

const defs: RoleDef[] = [
  // 증인
  { id: 'postman', name: '우체부', camp: 'witness', tier: 1, clue: 'evil4', weight: 1,
    desc: '이웃 4칸에 악이 몇 명 있는지 알려 줍니다. 편지를 돌리다 보면 동네 사정을 압니다.' },
  { id: 'pharmacist', name: '약사', camp: 'witness', tier: 1, clue: 'evil8', weight: 1,
    desc: '주변 8칸에 악이 몇 명 있는지 알려 줍니다.' },
  { id: 'mayor', name: '이장', camp: 'witness', tier: 1, clue: 'evilRow', weight: 1,
    desc: '자기 가로줄(자기 빼고)에 악이 몇 명 있는지 알려 줍니다.' },
  { id: 'guard', name: '경비원', camp: 'witness', tier: 2, clue: 'evilCol', weight: 1,
    desc: '자기 세로줄(자기 빼고)에 악이 몇 명 있는지 알려 줍니다.' },
  { id: 'baker', name: '빵집 주인', camp: 'witness', tier: 2, clue: 'nearest', weight: 1,
    desc: '가장 가까운 악까지 몇 걸음인지 알려 줍니다. 새벽부터 동네를 훤히 봅니다.' },
  { id: 'photographer', name: '사진사', camp: 'witness', tier: 2, clue: 'pairOne', weight: 1,
    desc: '두 사람 중 정확히 한 명이 악이라고 알려 줍니다.' },
  { id: 'reporter', name: '기자', camp: 'witness', tier: 3, ability: 'pairSame', weight: 1,
    desc: '능력으로 두 칸을 골라 같은 편인지 물어볼 수 있습니다.' },
  { id: 'bellringer', name: '종지기', camp: 'witness', tier: 4, clue: 'bossRow', trigger: 12, weight: 1,
    desc: '12시간이 되면 주범이 몇 번째 가로줄에 있는지 종을 울려 알립니다.' },
  // 말썽꾼
  { id: 'braggart', name: '허풍쟁이', camp: 'trouble', tier: 1, clue: 'evil8', mode: 'false', weight: 1,
    desc: '약사처럼 말하지만 항상 거짓말을 합니다. 악은 아닙니다.' },
  { id: 'lost', name: '길치', camp: 'trouble', tier: 2, clue: 'evil8', mode: 'true', shift: 'right', weight: 1,
    desc: '약사처럼 참을 말하지만, 자기 오른쪽 칸(없으면 왼쪽)을 기준으로 셉니다.' },
  { id: 'gossip', name: '소문쟁이', camp: 'trouble', tier: 3, taint: 'adj4', weight: 1,
    desc: '진술이 없습니다. 이웃 4칸의 진짜 증인 한 명이 거짓을 말하게 만듭니다.' },
  { id: 'hidden', name: '숨은이', camp: 'trouble', tier: 3, face: 'witness', mode: 'true', weight: 1,
    desc: '증인 직업으로 보이는 선한 사람입니다. 그 진술은 참입니다.' },
  // 공범
  { id: 'thief', name: '좀도둑', camp: 'accomplice', tier: 1, weight: 1,
    desc: '증인으로 위장하고 거짓말을 합니다.' },
  { id: 'blackmailer', name: '협박꾼', camp: 'accomplice', tier: 2, taint: 'adj4', weight: 1,
    desc: '위장해 거짓말을 하고, 이웃 4칸의 진짜 증인 한 명도 거짓을 말하게 만듭니다.' },
  { id: 'lookout', name: '망보기', camp: 'accomplice', tier: 2, place: 'bossIn8', weight: 1,
    desc: '위장해 거짓말을 합니다. 주변 8칸 안에 반드시 주범이 있습니다.' },
  { id: 'shill', name: '바람잡이', camp: 'accomplice', tier: 3, mode: 'true', weight: 1,
    desc: '증인으로 위장했지만 진술은 참입니다.' },
  { id: 'smooth', name: '능청이', camp: 'accomplice', tier: 4, mode: 'any', weight: 1,
    desc: '위장한 악입니다. 진술이 참일 수도 거짓일 수도 있어 단서가 되지 못합니다.' },
  // 주범
  { id: 'chief', name: '두목', camp: 'boss', tier: 1, weight: 1,
    desc: '증인으로 위장하고 거짓말을 합니다.' },
  { id: 'shadow', name: '그림자', camp: 'boss', tier: 3, hiddenFromCounts: true, weight: 1,
    desc: '위장해 거짓말을 합니다. 악의 수와 가장 가까운 악을 세는 진술에서는 선으로 셉니다.' },
  { id: 'briber', name: '매수왕', camp: 'boss', tier: 4, taint: 'any', weight: 1,
    desc: '위장해 거짓말을 하고, 판 어디서든 진짜 증인 한 명을 거짓말쟁이로 만듭니다.' },
];

export const ROLES: Record<RoleId, RoleDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

const ANY_DEF: RoleDef = {
  id: ANY_WITNESS, name: '증인', camp: 'witness', tier: 1, mode: 'true', face: 'self', weight: 0,
  desc: '직업을 아직 모르는 증인입니다.',
};

export function role(id: RoleId): RoleDef {
  if (id === ANY_WITNESS) return ANY_DEF;
  const r = ROLES[id];
  if (!r) throw new Error(`unknown role: ${id}`);
  return r;
}

export function isEvil(c: Camp): boolean {
  return c === 'accomplice' || c === 'boss';
}
