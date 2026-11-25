// 안내 문장 (설계 7장): 1·2스테이지 따라 하기, 새 직업·새 규칙이 처음 나올 때 보여 줄 카드.
import { ROLES, role } from '../core/roles';
import { type RoleId } from '../core/types';
import { type Stage } from './chapters';

/**
 * 1·2스테이지 따라 하기 단계. cell 이 있으면 그 칸(0부터)을 가리킨다.
 * GUIDE[1] 의 칸 번호는 stages.json 1스테이지 기준이다 (stages.test.ts 가 체포 칸이 악인지 확인한다).
 */
export const GUIDE: Record<1 | 2, { cell?: number; text: string }[]> = {
  1: [
    { text: '마을에 사건이 났습니다. 이 9명 가운데 주범이 숨어 있습니다. 주범을 모두 체포하면 해결입니다. 처음에 본 인원표는 위쪽 "인원표 보기"를 누르면 다시 볼 수 있습니다.' },
    { cell: 4, text: '가운데 칸을 눌러 조사해 보세요. 조사하면 그 사람의 겉 직업과 진술이 보입니다. 조사는 2시간이 걸립니다.' },
    { cell: 4, text: '진술을 읽어 보세요. 진술 기록에서 진술을 누르면 그 진술이 가리키는 칸에 빨간 동그라미가 그려집니다. 직업 이름을 누르면 어떻게 말하는지 볼 수 있습니다.' },
    { text: '나머지 칸도 모두 조사해 진술을 모으세요.' },
    { text: '조심하세요. 주범은 증인으로 위장하고 거짓말을 합니다. 인원표를 보면 우체부는 1명인데, 우체부라고 하는 사람은 4번과 7번 두 명입니다. 둘 중 한 명은 위장한 주범입니다.' },
    { cell: 0, text: '약사는 인원표의 수와 겉 직업 수가 같으니 모두 진짜입니다. 1번 약사는 둘러싼 2·4·5번에 수상한 사람이 없다고 합니다. 그러니 4번 우체부는 진짜이고, 7번이 가짜입니다.' },
    { cell: 6, text: '알아낸 것은 메모해 두세요. 7번 칸을 누르고 메모에서 악을 고르면 칸 구석에 표시됩니다.' },
    { cell: 6, text: '이제 7번 칸을 체포하세요. 체포하면 진짜 직업이 드러납니다. 선을 체포하면 평판이 2 깎이니 확실할 때만 체포합니다.' },
  ],
  2: [
    { text: '이번에는 혼자 해 보세요. 먼저 모든 칸을 조사해 진술을 모읍니다.' },
    { text: '인원표와 겉 직업 수를 비교하고, 서로 맞지 않는 진술을 찾아 거짓말하는 사람을 가려 냅니다.' },
    { text: '주범이 확실해지면 체포하세요. 막히면 힌트 버튼을 눌러도 됩니다.' },
  ],
};

/** 직업 카드 본문 (직업 설명 desc 와 같은 내용을 짧게) */
const ROLE_CARD: Record<RoleId, string> = {
  postman: '증인. 상하좌우로 붙은 칸에 악이 몇 명인지 칸 번호를 들어 말합니다.',
  pharmacist: '증인. 대각선까지 둘러싼 칸에 악이 몇 명인지 칸 번호를 들어 말합니다.',
  grandma: '증인. 한 사람을 짚어 악이라고 말합니다.',
  mayor: '증인. 같은 가로줄의 나머지 칸에 악이 몇 명인지 말합니다.',
  guard: '증인. 같은 세로줄의 나머지 칸에 악이 몇 명인지 말합니다.',
  restaurant: '증인. 한 사람이 밤새 가게에 있었다며 선이라고 말합니다.',
  baker: '증인. 가장 가까운 악까지 상하좌우로 몇 칸인지 말합니다.',
  photographer: '증인. 두 사람을 짚어 그중 정확히 한 명이 악이라고 말합니다.',
  taxi: '증인. 자기 칸을 지나는 두 대각선 위 칸에 악이 몇 명인지 말합니다.',
  operator: '증인. 두 사람을 짚어 같은 편이라고 말합니다. 진술을 누르면 두 사람이 빨간 실로 이어집니다.',
  priest: '증인. 세 사람을 짚어 그중 적어도 한 명은 악이라고 말합니다.',
  reporter: '증인. 진술 대신 능력이 있습니다. 두 칸을 골라 같은 편인지 취재할 수 있습니다.',
  barber: '증인. 판 전체에 악 두 명이 상하좌우로 붙어 사는 곳이 있는지 말합니다.',
  laundry: '증인. 판의 왼쪽 절반과 오른쪽 절반 중 어디에 악이 더 많은지 말합니다.',
  dog: '증인. 개가 짖은 방향(위·아래·왼쪽·오른쪽)에 주범이 있다고 말합니다. 주범을 직접 가리키는 귀한 진술입니다.',
  bellringer: '증인. 12시간이 되면 한 가로줄에 주범이 몇 명 있는지 종을 울려 알립니다.',
  braggart: '말썽꾼. 약사처럼 말하지만 늘 실제보다 큰 수를 말합니다. 그래도 악은 아닙니다.',
  lost: '말썽꾼. 약사처럼 참을 말하지만, 옆집(오른쪽, 없으면 왼쪽)을 자기 집으로 알고 셉니다.',
  gossip: '말썽꾼. 소문으로 한 사람을 악이라고 짚지만 소문은 늘 틀립니다. 짚은 사람은 선입니다.',
  lookout: '공범. 증인으로 위장해 거짓말을 합니다. 주변 8칸 안에 반드시 주범이 있습니다.',
  thief: '공범. 위장해 거짓말을 하고, 상하좌우로 붙은 진짜 증인 한 명의 쪽지를 바꿔치기해 거짓을 말하게 만듭니다.',
  shill: '공범. 증인으로 위장했지만 진술도 능력 결과도 참입니다. 참말만 한다고 선은 아닙니다.',
  blackmailer: '공범. 위장해 거짓말을 하고, 상하좌우로 붙은 진짜 증인 한 명을 협박합니다. 협박당한 증인은 주범을 선으로 치고 말합니다.',
  decoy: '공범. 위장해 거짓말을 하고 주범 행세를 합니다. 개 주인·종지기의 진술에서 주범으로 세어집니다.',
  chief: '주범. 증인으로 위장하고 거짓말을 합니다.',
  briber: '주범. 위장해 거짓말을 하고, 판 어디서든 진짜 증인 한 명을 매수해 거짓을 말하게 만듭니다.',
  shadow: '주범. 위장해 거짓말을 합니다. 악을 세는 진술에서는 선으로 세어집니다.',
  framer: '주범. 위장해 거짓말을 하고, 선한 사람 한 명에게 누명을 씌웁니다. 누명 쓴 사람은 악을 세는 진술에서 악으로 세어집니다.',
};

const CONCEPT_CARD: Record<'roster' | 'trouble' | 'taint' | 'ability' | 'trigger' | 'confession', { title: string; body: string }> = {
  roster: {
    title: '인원표',
    body: '사건마다 주범·공범·말썽꾼·증인이 직업별로 몇 명인지 처음에 알려 줍니다. 주범을 모두 체포하면 해결입니다. 겉 직업 수가 인원표보다 많으면 그 직업으로 위장한 악이 있습니다.',
  },
  trouble: {
    title: '말썽꾼',
    body: '말썽꾼은 선입니다. 체포하면 평판이 2 깎입니다. 위장하지 않아 직업이 보이지만, 말하는 버릇이 있어 진술을 그대로 믿을 수 없습니다.',
  },
  taint: {
    title: '바꿔치기·매수·협박·누명',
    body: '어떤 악은 다른 사람에게 일을 꾸밉니다. 좀도둑(쪽지 바꿔치기)과 매수왕(매수)은 진짜 증인을 거짓말하게 만들고, 협박꾼은 주범을 선으로 치고 말하게 만들고, 모사꾼은 선한 사람을 악으로 세어지게 합니다. 한 사람에게는 하나만 꾸미고(두 악이 같은 사람을 고르지 않음), 대상이 될 사람이 있으면 반드시 한 명에게 꾸밉니다. 누가 당했는지는 말투에 드러나지 않습니다.',
  },
  ability: {
    title: '능력',
    body: '겉 직업에 능력이 있으면 사건당 한 번, 시간 없이 쓸 수 있습니다. 위장했거나 매수·바꿔치기당한 사람의 능력 결과는 거짓입니다(바람잡이는 참). 모든 칸을 조사한 뒤에 쓰세요.',
  },
  trigger: {
    title: '시각 계기',
    body: '어떤 진술은 경과 시간이 정해진 시각에 이르러야 공개됩니다. 모든 칸을 조사하면 반드시 그 시각을 넘깁니다.',
  },
  confession: {
    title: '자백',
    body: '공범을 체포하면 평판이 1 깎이고 자백을 받습니다. 자백은 주범이 있는 세로줄을 말하지만, 그 공범 주변 8칸에 아직 안 잡힌 주범이 있으면 감싸느라 거짓을 말합니다.',
  },
};

export const CARDS: Record<string, { title: string; body: string }> = {
  ...Object.fromEntries(Object.values(ROLES).map((d) => [d.id, { title: d.name, body: ROLE_CARD[d.id] }])),
  ...CONCEPT_CARD,
};

/** 이 직업이 처음 나올 때 함께 보여 줄 개념 카드 */
function conceptsOf(id: RoleId): string[] {
  const d = role(id);
  const out: string[] = [];
  if (d.camp === 'trouble') out.push('trouble');
  if (d.camp === 'accomplice') out.push('confession');
  if (d.taint) out.push('taint');
  if (d.ability) out.push('ability');
  if (d.trigger !== undefined) out.push('trigger');
  return out;
}

/**
 * 이 스테이지에서 처음 보는 카드 키 (seen 에 없는 것). 직업은 inPlay·겉 직업에 나온 것을 ROLES 순서로,
 * 개념(말썽꾼·오염·능력·시각 계기·자백)은 그 개념을 처음 보이는 직업 카드 바로 앞에 둔다. 인원표 카드는 맨 처음 한 번.
 */
export function cardsFor(stage: Stage, seen: string[]): string[] {
  const inPlay = new Set(stage.def.inPlay);
  const faces = new Set(stage.def.faces);
  const out: string[] = [];
  const add = (key: string) => {
    if (!seen.includes(key) && !out.includes(key)) out.push(key);
  };
  add('roster');
  for (const id of Object.keys(ROLES)) {
    if (!inPlay.has(id) && !faces.has(id)) continue;
    conceptsOf(id).forEach(add);
    add(id);
  }
  return out;
}
