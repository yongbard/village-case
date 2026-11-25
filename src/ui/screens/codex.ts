// 도감: 만난 직업(seenCards 기준)은 설명을, 못 만난 직업은 진영만 보여 준다.
import { CARDS } from '../../content/tutorial';
import { ROLES } from '../../core/roles';
import { type Camp } from '../../core/types';
import { h, mount } from '../dom';
import { CAMP_NAME } from '../labels';
import { photo } from '../portraits';
import { speechList } from '../speech';
import { getSave } from '../store';
import { showTitle } from './title';

export function showCodex(): void {
  const seen = new Set(getSave().seenCards);
  const all = Object.values(ROLES);
  const met = all.filter((r) => seen.has(r.id)).length;
  const camps: Camp[] = ['boss', 'accomplice', 'trouble', 'witness'];
  mount(
    h(
      'main',
      { class: 'screen codex-screen' },
      h(
        'header',
        { class: 'list-head' },
        h('button', { class: 'btn ghost back', onclick: showTitle }, '‹ 처음'),
        h('h1', {}, '인물 카드철'),
        h('span', { class: 'list-count', 'data-codex-count': met }, `${met} / ${all.length}`),
      ),
      // 만난 직업은 색인 카드 한 장씩, 못 만난 직업은 진영별로 뒤집힌 작은 카드
      h(
        'ul',
        { class: 'codex-list' },
        all
          .filter((r) => seen.has(r.id))
          .map((r) =>
            h(
              'li',
              { class: 'codex-item index-card', 'data-role': r.id },
              h(
                'div',
                { class: 'codex-top' },
                photo(r.id, 'codex-photo'),
                h(
                  'div',
                  { class: 'codex-title' },
                  h(
                    'div',
                    { class: 'codex-head' },
                    h('b', {}, r.name),
                    h('span', { class: `stamp-mark camp-${r.camp}` }, CAMP_NAME[r.camp]),
                    h('small', { class: 'codex-tier' }, `등급 ${r.tier}`),
                  ),
                  h('p', {}, r.desc),
                ),
              ),
              h('p', { class: 'codex-body' }, CARDS[r.id].body),
              speechList(r.id),
            ),
          ),
      ),
      camps.map((camp) => {
        const unknown = all.filter((r) => r.camp === camp && !seen.has(r.id));
        return (
          unknown.length > 0 &&
          h(
            'section',
            { class: 'codex-camp' },
            h('h2', {}, `${CAMP_NAME[camp]}`, h('small', {}, `${unknown.length}장`)),
            h(
              'ul',
              {},
              unknown.map((r) => h('li', { class: 'codex-item unknown manila', 'data-role': r.id, 'aria-label': `못 만난 ${CAMP_NAME[camp]}` }, h('b', {}, '?'))),
            ),
          )
        );
      }),
    ),
  );
}
