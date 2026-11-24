// 안내: 1·2스테이지 따라 하기 말풍선(GUIDE)과, 새 직업·규칙 카드(CARDS)를 사건 시작 때 한 장씩.
import { ROLES } from '../core/roles';
import { CARDS } from '../content/tutorial';
import { h, overlay } from './dom';
import { photo } from './portraits';
import { CAMP_NAME } from './labels';

/** 카드를 한 장씩 띄운다. 한 장을 넘길 때마다 onSeen(key). */
export function showCards(keys: string[], onSeen: (key: string) => void): void {
  const next = (i: number) => {
    if (i >= keys.length) return;
    const key = keys[i];
    const card = CARDS[key];
    const r = ROLES[key];
    const close = overlay(
      h(
        'div',
        { class: 'card-box', role: 'dialog', 'aria-modal': 'true' },
        r && photo(key, 'card-photo'),
        h('p', { class: 'kicker' }, r ? `새 직업 · ${CAMP_NAME[r.camp]}` : '새 규칙'),
        h('h2', {}, card.title),
        h('p', { class: 'card-body' }, card.body),
        h(
          'button',
          {
            class: 'btn primary wide',
            'data-action': 'card-ok',
            onclick: () => {
              close();
              onSeen(key);
              next(i + 1);
            },
          },
          keys.length > 1 ? `확인 (${i + 1}/${keys.length})` : '확인',
        ),
      ),
      false,
    );
  };
  next(0);
}

/** 따라 하기 말풍선. index 번째 단계를 보여 주고, 이전·다음·닫기를 onNav 로 알린다(-1 = 닫기). */
export function guideBubble(
  steps: { cell?: number; text: string }[],
  index: number,
  onNav: (index: number) => void,
): HTMLElement {
  const step = steps[index];
  const last = index === steps.length - 1;
  return h(
    'div',
    { class: 'bubble guide-bubble', role: 'note' },
    h(
      'div',
      { class: 'bubble-head' },
      h('span', { class: 'bubble-tag' }, step.cell === undefined ? '안내' : `안내 · ${step.cell + 1}번 칸`),
      h('span', { class: 'bubble-count' }, `${index + 1} / ${steps.length}`),
    ),
    h('p', { class: 'bubble-text' }, step.text),
    h(
      'div',
      { class: 'bubble-nav' },
      h('button', { class: 'btn ghost', onclick: () => onNav(-1) }, '안내 닫기'),
      h('span', { class: 'spacer' }),
      index > 0 && h('button', { class: 'btn', onclick: () => onNav(index - 1) }, '이전'),
      h(
        'button',
        { class: 'btn primary', 'data-action': 'guide-next', onclick: () => onNav(last ? -1 : index + 1) },
        last ? '마치기' : '다음',
      ),
    ),
  );
}
