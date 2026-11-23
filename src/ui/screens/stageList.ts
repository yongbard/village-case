// 스테이지 목록 (1 ~ 30, 장별). 푼 것 표시, 다음 것만 열림.
import { CHAPTERS, type Stage } from '../../content/chapters';
import stagesJson from '../../content/stages.json';
import { cardsFor } from '../../content/tutorial';
import { h, mount } from '../dom';
import { getSave, updateSave } from '../store';
import { showCards } from '../tutorialOverlay';
import { showCase } from './caseScreen';
import { showResult } from './result';
import { showTitle } from './title';

export const STAGES = stagesJson as unknown as Stage[];

const isOpen = (id: number, cleared: number[]) => id === 1 || cleared.includes(id - 1) || cleared.includes(id);

export function showStageList(): void {
  const { cleared } = getSave();
  mount(
    h(
      'main',
      { class: 'screen list-screen' },
      h(
        'header',
        { class: 'list-head' },
        h('button', { class: 'btn ghost back', onclick: showTitle }, '‹ 처음'),
        h('h1', {}, '스테이지'),
        h('span', { class: 'list-count' }, `${cleared.length} / ${STAGES.length}`),
      ),
      CHAPTERS.map((c) =>
        h(
          'section',
          { class: 'chapter' },
          h('h2', {}, `${c.no}장`, h('small', {}, `${c.stages[0]} ~ ${c.stages[1]}`)),
          h(
            'div',
            { class: 'stage-grid' },
            STAGES.filter((s) => s.chapter === c.no).map((s) => {
              const done = cleared.includes(s.id);
              const open = isOpen(s.id, cleared);
              return h(
                'button',
                {
                  class: `stage${done ? ' done' : ''}${open ? '' : ' locked'}`,
                  'data-stage': s.id,
                  disabled: !open,
                  'aria-label': `${s.id}스테이지${done ? ', 해결함' : open ? '' : ', 잠김'}`,
                  onclick: () => startStage(s.id),
                },
                h('span', { class: 'stage-no' }, String(s.id)),
                h('span', { class: 'stage-state' }, done ? '✓ 해결' : open ? `${s.def.w}×${s.def.h}` : '잠김'),
              );
            }),
          ),
        ),
      ),
    ),
  );
}

export function startStage(id: number): void {
  const stage = STAGES.find((s) => s.id === id)!;
  showCase(stage.def, {
    mode: 'stage',
    stageId: id,
    // 푼 순간에 저장한다: 결과 화면 타이머(900 ms) 전에 나가도 기록이 남는다
    onStatus: (g) => {
      if (g.status === 'solved' && !getSave().cleared.includes(id)) {
        updateSave((s) => ({ ...s, cleared: [...s.cleared, id].sort((a, b) => a - b) }));
      }
    },
    onEnd: (g) => showResult(stage, g),
  });
  const keys = cardsFor(stage, getSave().seenCards);
  const markSeen = (key: string) => updateSave((s) => ({ ...s, seenCards: [...s.seenCards, key] }));
  // 1·2스테이지는 따라 하기 말풍선이 직업을 소개하므로 카드는 띄우지 않고 본 것으로 둔다
  if (id <= 2) keys.forEach(markSeen);
  else showCards(keys, markSeen);
}
