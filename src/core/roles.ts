import { ANY_WITNESS, type Camp, type RoleDef, type RoleId } from './types';

const defs: RoleDef[] = [
  // 증인 (tier = 처음 나오는 장)
  { id: 'postman', name: '우체부', camp: 'witness', tier: 1, clue: 'evil4', weight: 1,
    desc: '상하좌우로 붙은 칸에 악이 몇 명 있는지 칸 번호를 들어 말합니다. 편지를 돌리다 보면 동네 사정을 압니다.' },
  { id: 'pharmacist', name: '약사', camp: 'witness', tier: 1, clue: 'evil8', weight: 1,
    desc: '대각선까지 둘러싼 칸에 악이 몇 명 있는지 칸 번호를 들어 말합니다.' },
  { id: 'grandma', name: '옆집 할머니', camp: 'witness', tier: 1, clue: 'accuse', weight: 1,
    desc: '한 사람을 짚어 악이라고 말합니다.' },
  { id: 'mayor', name: '이장', camp: 'witness', tier: 2, clue: 'evilRow', weight: 1,
    desc: '같은 가로줄의 나머지 칸에 악이 몇 명 있는지 말합니다.' },
  { id: 'guard', name: '경비원', camp: 'witness', tier: 2, clue: 'evilCol', weight: 1,
    desc: '같은 세로줄의 나머지 칸에 악이 몇 명 있는지 말합니다.' },
  { id: 'restaurant', name: '식당 주인', camp: 'witness', tier: 2, clue: 'alibi', weight: 1,
    desc: '한 사람이 밤새 가게에 있었다며 선이라고 말합니다.' },
  { id: 'baker', name: '빵집 주인', camp: 'witness', tier: 3, clue: 'nearest', weight: 1,
    desc: '가장 가까운 악까지 상하좌우로 몇 칸인지 말합니다. 새벽부터 동네를 훤히 봅니다.' },
  { id: 'photographer', name: '사진사', camp: 'witness', tier: 3, clue: 'pairOne', weight: 1,
    desc: '두 사람 중 정확히 한 명이 악이라고 말합니다.' },
  { id: 'taxi', name: '택시 기사', camp: 'witness', tier: 3, clue: 'diag', weight: 1,
    desc: '자기 칸을 지나는 두 대각선 위의 칸에 악이 몇 명 있는지 말합니다.' },
  { id: 'operator', name: '전화 교환원', camp: 'witness', tier: 4, clue: 'sameSide', weight: 1,
    desc: '밤마다 통화하는 두 사람을 짚어 같은 편이라고 말합니다.' },
  { id: 'priest', name: '신부', camp: 'witness', tier: 4, clue: 'atLeastOne', weight: 1,
    desc: '고해를 들은 세 사람 중 적어도 한 명은 악이라고 말합니다.' },
  { id: 'reporter', name: '기자', camp: 'witness', tier: 4, ability: 'pairSame', weight: 1,
    desc: '능력으로 두 칸을 골라 같은 편인지 취재할 수 있습니다.' },
  { id: 'barber', name: '이발사', camp: 'witness', tier: 5, clue: 'adjPair', weight: 1,
    desc: '판 전체에 악 두 명이 상하좌우로 붙어 사는 곳이 있는지 말합니다.' },
  { id: 'laundry', name: '세탁소 주인', camp: 'witness', tier: 5, clue: 'halves', weight: 1,
    desc: '판의 왼쪽 절반과 오른쪽 절반 중 어디에 악이 더 많은지 말합니다. 가로 폭이 홀수면 가운데 세로줄은 빼고 셉니다.' },
  { id: 'dog', name: '개 주인', camp: 'witness', tier: 5, clue: 'bossDir', weight: 1,
    desc: '개가 짖은 방향(위·아래·왼쪽·오른쪽)에 주범이 있다고 말합니다.' },
  { id: 'bellringer', name: '종지기', camp: 'witness', tier: 5, clue: 'bossRow', trigger: 12, weight: 1,
    desc: '12시간이 되면 종탑에서 본 한 가로줄에 주범이 몇 명 있는지 알립니다.' },
  // 말썽꾼 (선, 버릇)
  { id: 'braggart', name: '허풍쟁이', camp: 'trouble', tier: 2, clue: 'evil8', mode: 'over', weight: 1,
    desc: '약사처럼 말하지만 늘 실제보다 큰 수를 말합니다. 악은 아닙니다.' },
  { id: 'lost', name: '길치', camp: 'trouble', tier: 3, clue: 'evil8', mode: 'true', shift: 'right', weight: 1,
    desc: '약사처럼 참을 말하지만, 옆집(오른쪽, 없으면 왼쪽)을 자기 집으로 알고 둘러싼 칸을 셉니다.' },
  { id: 'gossip', name: '소문쟁이', camp: 'trouble', tier: 4, clue: 'accuse', mode: 'false', weight: 1,
    desc: '들은 소문으로 한 사람을 악이라고 짚지만, 소문은 늘 틀립니다. 짚은 사람은 선입니다.' },
  // 공범 (악, 주범을 감쌈)
  { id: 'lookout', name: '망보기', camp: 'accomplice', tier: 1, place: 'bossIn8', weight: 1,
    desc: '증인으로 위장해 거짓말을 합니다. 주변 8칸 안에 반드시 주범이 있습니다.' },
  { id: 'thief', name: '좀도둑', camp: 'accomplice', tier: 2, taint: 'adj4', effect: 'lie', weight: 1,
    desc: '위장해 거짓말을 하고, 상하좌우로 붙은 진짜 증인 한 명의 진술 쪽지를 가짜로 바꿔치기해 거짓을 말하게 만듭니다.' },
  { id: 'shill', name: '바람잡이', camp: 'accomplice', tier: 3, mode: 'true', weight: 1,
    desc: '증인으로 위장했지만 진술과 능력 결과가 참입니다. 믿음을 사서 의심을 피합니다.' },
  { id: 'blackmailer', name: '협박꾼', camp: 'accomplice', tier: 4, taint: 'adj4', effect: 'shield', weight: 1,
    desc: '위장해 거짓말을 하고, 상하좌우로 붙은 진짜 증인 한 명을 협박합니다. 협박당한 증인은 주범을 선으로 치고 말합니다.' },
  { id: 'decoy', name: '대역', camp: 'accomplice', tier: 5, decoy: true, weight: 1,
    desc: '위장해 거짓말을 하고 주범 행세를 합니다. 주범을 가리키는 진술(개 주인, 종지기)에서 주범으로 세어집니다.' },
  // 주범 (악, 목표)
  { id: 'chief', name: '두목', camp: 'boss', tier: 1, weight: 1,
    desc: '증인으로 위장하고 거짓말을 합니다.' },
  { id: 'briber', name: '매수왕', camp: 'boss', tier: 4, taint: 'any', effect: 'lie', weight: 1,
    desc: '위장해 거짓말을 하고, 판 어디서든 진짜 증인 한 명을 매수해 거짓을 말하게 만듭니다.' },
  { id: 'shadow', name: '그림자', camp: 'boss', tier: 5, hiddenFromCounts: true, weight: 1,
    desc: '위장해 거짓말을 합니다. 악을 세는 진술(수 세기, 거리, 붙어 사는 악, 세탁소)에서는 선으로 세어집니다.' },
  { id: 'framer', name: '모사꾼', camp: 'boss', tier: 5, taint: 'any', effect: 'frame', weight: 1,
    desc: '위장해 거짓말을 하고, 선한 사람 한 명에게 누명을 씌웁니다. 누명 쓴 사람은 악을 세는 진술에서 악으로 세어집니다.' },
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

/** 직업별 인원 (ANY_WITNESS 는 세지 않는다) */
export function rosterOf(roles: readonly RoleId[]): Record<RoleId, number> {
  const out: Record<RoleId, number> = {};
  for (const r of roles) if (r !== ANY_WITNESS) out[r] = (out[r] ?? 0) + 1;
  return out;
}
