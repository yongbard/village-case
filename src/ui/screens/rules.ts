// 규칙: 한 판의 규칙 요약(설계 4장)과 개념 카드 4장.
import { CARDS } from '../../content/tutorial';
import { h, mount } from '../dom';
import { showTitle } from './title';

const SUMMARY: { head: string; items: string[] }[] = [
  {
    head: '판',
    items: [
      '칸마다 용의자가 한 명씩 숨어 있습니다. 칸 번호는 왼쪽에서 오른쪽, 위에서 아래로 1부터입니다.',
      '위쪽 줄에 이번 사건의 말썽꾼·공범·주범 수와 직업 목록이 나옵니다.',
      '악(공범·주범)을 모두 체포하면 사건 해결입니다.',
    ],
  },
  {
    head: '진영',
    items: [
      '증인은 선이고 진술이 참입니다. 말썽꾼도 선이지만 믿기 어렵습니다.',
      '공범과 주범은 악입니다. 아무 증인 직업으로 위장하고 거짓을 말합니다. 주범은 사건당 한 명입니다.',
    ],
  },
  {
    head: '행동과 시간',
    items: [
      '조사 2시간: 겉 직업과 진술이 보입니다.',
      '체포 1시간: 진짜 직업과 진영이 드러납니다. 선을 체포하면 평판이 2 떨어집니다.',
      '능력 0시간: 겉 직업에 능력이 있으면 사건당 한 번 쓸 수 있습니다.',
      '칸을 누르면 메뉴가 열립니다. 선·악·? 메모를 남겨 두세요.',
    ],
  },
  {
    head: '평판과 힌트',
    items: [
      '평판은 10에서 시작합니다. 스테이지는 0이 되면 다시 하고, 무한 모드는 0이 되면 끝납니다.',
      '무한 모드는 사건을 풀 때마다 평판이 1 오릅니다(최대 10).',
      '힌트는 추리의 다음 한 단계를 알려 줍니다. 스테이지에서는 무료, 무한 모드에서는 평판 1입니다.',
    ],
  },
];

export function showRules(): void {
  mount(
    h(
      'main',
      { class: 'screen rules-screen' },
      h(
        'header',
        { class: 'list-head' },
        h('button', { class: 'btn ghost back', onclick: showTitle }, '‹ 처음'),
        h('h1', {}, '수사 규칙'),
        h('span', { class: 'list-count' }),
      ),
      SUMMARY.map((s) => h('section', { class: 'rule-block' }, h('h2', {}, s.head), h('ul', {}, s.items.map((t) => h('li', {}, t))))),
      h(
        'section',
        { class: 'rule-block' },
        h('h2', {}, '알아 둘 개념'),
        ['trouble', 'taint', 'ability', 'trigger'].map((k) =>
          h('div', { class: 'concept', 'data-concept': k }, h('b', {}, CARDS[k].title), h('p', {}, CARDS[k].body)),
        ),
      ),
    ),
  );
}
