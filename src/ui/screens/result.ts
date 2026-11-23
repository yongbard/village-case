// 결과 화면: 해결/실패, 미리 계산한 해설 단계(stage.steps), 다음 스테이지 / 다시 하기.
import { describeStep } from '../../core/explain';
import { type Game } from '../../core/game';
import { role } from '../../core/roles';
import { type Stage } from '../../content/chapters';
import { abilityText } from '../clueText';
import { h, mount } from '../dom';
import { showStageList, startStage, STAGES } from './stageList';

export function showResult(stage: Stage, g: Game): void {
  const solved = g.status === 'solved';
  const hasNext = solved && stage.id < STAGES.length;
  mount(
    h(
      'main',
      { class: 'screen result-screen' },
      h(
        'header',
        { class: `result-head ${solved ? 'solved' : 'failed'}` },
        h('p', { class: 'kicker' }, `${stage.id}스테이지`),
        h('h1', { 'data-result': solved ? 'solved' : 'failed' }, solved ? '해결' : '실패'),
        h(
          'p',
          { class: 'result-sub' },
          solved ? `경과 ${g.hour}시간 · 남은 평판 ${g.rep}` : '평판이 바닥났습니다. 다시 해 보세요.',
        ),
      ),
      h(
        'div',
        { class: 'result-actions' },
        hasNext && h('button', { class: 'btn primary wide', 'data-action': 'next', onclick: () => startStage(stage.id + 1) }, '다음 스테이지'),
        h('button', { class: `btn wide${hasNext ? '' : ' primary'}`, 'data-action': 'retry', onclick: () => startStage(stage.id) }, '다시 하기'),
        h('button', { class: 'btn ghost wide', onclick: showStageList }, '스테이지 목록'),
      ),
      h(
        'section',
        { class: 'explain' },
        h('h2', {}, '해설'),
        h('p', { class: 'explain-note' }, '처음부터 모든 칸을 조사했을 때 추리하는 순서입니다.'),
        stage.abilities.length > 0 &&
          h(
            'ul',
            { class: 'abilities' },
            stage.abilities.map((o, j) =>
              h('li', {}, `${j + 1}번째 능력 결과 · ${o.cell + 1}번 ${role(stage.def.faces[o.cell]).name}: ${abilityText(o)}`),
            ),
          ),
        h(
          'ol',
          { class: 'steps' },
          stage.steps.map((s) => h('li', { class: `side-${s.side}`, 'data-step': s.cell }, describeStep(s, stage.def))),
        ),
      ),
    ),
  );
}
