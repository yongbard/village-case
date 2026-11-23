// 도감: 만난 직업(seenCards 기준)은 설명을, 못 만난 직업은 진영만 보여 준다.
import { CARDS } from '../../content/tutorial';
import { ROLES } from '../../core/roles';
import { h, mount } from '../dom';
import { CAMP_NAME } from '../labels';
import { speechList } from '../speech';
import { getSave } from '../store';
import { showTitle } from './title';

export function showCodex(): void {
  const seen = new Set(getSave().seenCards);
  const all = Object.values(ROLES);
  const met = all.filter((r) => seen.has(r.id)).length;
  mount(
    h(
      'main',
      { class: 'screen codex-screen' },
      h(
        'header',
        { class: 'list-head' },
        h('button', { class: 'btn ghost back', onclick: showTitle }, '‹ 처음'),
        h('h1', {}, '도감'),
        h('span', { class: 'list-count', 'data-codex-count': met }, `${met} / ${all.length}`),
      ),
      h(
        'ul',
        { class: 'codex-list' },
        all.map((r) =>
          seen.has(r.id)
            ? h(
                'li',
                { class: 'codex-item', 'data-role': r.id },
                h('div', { class: 'codex-head' }, h('b', {}, r.name), h('span', { class: `camp-${r.camp}` }, `${CAMP_NAME[r.camp]} · 등급 ${r.tier}`)),
                h('p', {}, r.desc),
                h('p', { class: 'codex-body' }, CARDS[r.id].body),
                speechList(r.id),
              )
            : h(
                'li',
                { class: 'codex-item unknown', 'data-role': r.id },
                h('div', { class: 'codex-head' }, h('b', {}, '?'), h('span', {}, CAMP_NAME[r.camp])),
              ),
        ),
      ),
    ),
  );
}
