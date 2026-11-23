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
    { text: '마을에 사건이 났습니다. 이 9명 가운데 숨어 있는 악(공범과 주범)을 모두 체포하면 해결입니다.' },
    { cell: 4, text: '가운데 칸을 눌러 조사해 보세요. 조사하면 그 사람의 직업과 진술이 보입니다. 조사는 2시간이 걸립니다.' },
    { cell: 4, text: '진술을 읽어 보세요. 약사는 주변 8칸에, 우체부는 이웃 4칸(상하좌우)에 악이 몇 명인지 말합니다.' },
    { text: '나머지 칸도 모두 조사해 진술을 모으세요.' },
    { text: '조심하세요. 거짓말하는 사람이 있습니다. 공범과 주범은 증인으로 위장하고 거짓 진술을 합니다.' },
    { cell: 5, text: '6번 칸은 주변 8칸에 악이 4명이라고 합니다. 그런데 이 사건의 악은 공범 1명과 주범 1명뿐입니다. 거짓말이니 6번은 악입니다.' },
    { cell: 5, text: '알아낸 것은 메모해 두세요. 6번 칸을 누르고 메모에서 악을 고르면 칸 구석에 표시됩니다.' },
    { cell: 5, text: '이제 6번 칸을 체포하세요. 체포하면 진짜 직업이 드러납니다. 선을 체포하면 평판이 2 깎이니 확실할 때만 체포합니다.' },
    { text: '남은 악은 한 명입니다. 6번이 악이라는 것을 알고 다른 진술들을 다시 읽어 찾아 체포하세요.' },
  ],
  2: [
    { text: '이번에는 혼자 해 보세요. 먼저 모든 칸을 조사해 진술을 모읍니다.' },
    { text: '거짓말하는 사람이 있다는 것을 잊지 마세요. 서로 맞지 않는 진술을 찾아 메모합니다.' },
    { text: '악이 확실해지면 체포하세요. 막히면 힌트 버튼을 눌러도 됩니다.' },
  ],
};

/** 직업 카드 본문 (직업 설명 desc 와 같은 내용을 짧게) */
const ROLE_CARD: Record<RoleId, string> = {
  postman: '증인. 이웃 4칸(상하좌우)에 악이 몇 명인지 말합니다.',
  pharmacist: '증인. 주변 8칸에 악이 몇 명인지 말합니다.',
  mayor: '증인. 자기 가로줄(자기 빼고)에 악이 몇 명인지 말합니다.',
  guard: '증인. 자기 세로줄(자기 빼고)에 악이 몇 명인지 말합니다.',
  baker: '증인. 가장 가까운 악까지 몇 걸음인지 말합니다. 걸음은 상하좌우로만 셉니다.',
  photographer: '증인. 두 사람을 짚어 그중 정확히 한 명이 악이라고 말합니다.',
  reporter: '증인. 진술 대신 능력이 있습니다. 두 칸을 골라 같은 편인지 물어볼 수 있습니다.',
  bellringer: '증인. 12시간이 되면 주범이 몇 번째 가로줄에 있는지 종을 울려 알립니다.',
  braggart: '말썽꾼. 약사처럼 말하지만 항상 거짓말을 합니다. 그래도 악은 아닙니다.',
  lost: '말썽꾼. 약사처럼 참을 말하지만, 자기 오른쪽 칸(없으면 왼쪽)을 기준으로 셉니다.',
  gossip: '말썽꾼. 진술이 없습니다. 이웃 4칸의 진짜 증인 한 명이 거짓을 말하게 만듭니다.',
  hidden: '말썽꾼. 증인 직업으로 보이는 선한 사람입니다. 진술도 능력 결과도 참입니다.',
  thief: '공범. 증인으로 위장하고 거짓말을 합니다.',
  blackmailer: '공범. 위장해 거짓말을 하고, 이웃 4칸의 진짜 증인 한 명도 거짓을 말하게 만듭니다.',
  lookout: '공범. 위장해 거짓말을 합니다. 주변 8칸 안에 반드시 주범이 있습니다.',
  shill: '공범. 증인으로 위장했지만 진술도 능력 결과도 참입니다. 참말만 한다고 선은 아닙니다.',
  smooth: '공범. 위장한 악입니다. 진술이 참일 수도 거짓일 수도 있어 단서가 되지 못합니다.',
  chief: '주범. 증인으로 위장하고 거짓말을 합니다.',
  shadow: '주범. 위장해 거짓말을 합니다. 악의 수와 가장 가까운 악을 세는 진술에서는 선으로 셉니다.',
  briber: '주범. 위장해 거짓말을 하고, 판 어디서든 진짜 증인 한 명을 거짓말쟁이로 만듭니다.',
};

const CONCEPT_CARD: Record<'trouble' | 'taint' | 'ability' | 'trigger', { title: string; body: string }> = {
  trouble: {
    title: '말썽꾼',
    body: '말썽꾼은 선입니다. 체포하면 안 됩니다. 다만 말하는 방식이 증인과 달라 진술을 그대로 믿을 수 없습니다.',
  },
  taint: {
    title: '오염',
    body: '어떤 직업은 진짜 증인 한 명을 거짓말하게 만듭니다. 오염된 증인은 선이지만 진술과 능력 결과가 거짓입니다. 누가 오염됐는지는 보이지 않습니다.',
  },
  ability: {
    title: '능력',
    body: '겉 직업에 능력이 있으면 사건당 한 번, 시간 없이 쓸 수 있습니다. 위장했거나 오염된 사람의 능력 결과는 거짓입니다. 모든 칸을 조사한 뒤에 쓰세요.',
  },
  trigger: {
    title: '시각 계기',
    body: '어떤 진술은 경과 시간이 정해진 시각에 이르러야 공개됩니다. 모든 칸을 조사하면 반드시 그 시각을 넘깁니다.',
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
  if (d.taint) out.push('taint');
  if (d.ability) out.push('ability');
  if (d.trigger !== undefined) out.push('trigger');
  return out;
}

/**
 * 이 스테이지에서 처음 보는 카드 키 (seen 에 없는 것). 직업은 inPlay·겉 직업에 나온 것을 ROLES 순서로,
 * 개념(말썽꾼·오염·능력·시각 계기)은 그 개념을 처음 보이는 직업 카드 바로 앞에 둔다.
 */
export function cardsFor(stage: Stage, seen: string[]): string[] {
  const inPlay = new Set(stage.def.inPlay);
  const faces = new Set(stage.def.faces);
  const out: string[] = [];
  const add = (key: string) => {
    if (!seen.includes(key) && !out.includes(key)) out.push(key);
  };
  for (const id of Object.keys(ROLES)) {
    if (!inPlay.has(id) && !faces.has(id)) continue;
    conceptsOf(id).forEach(add);
    add(id);
  }
  return out;
}
