// 결과 화면: 해결/실패, 해설 단계(스테이지는 미리 계산한 것, 무한 모드는 worker 가 계산해 늦게 도착), 다음 / 다시 하기.
import { describeStep, type Step } from '../../core/explain';
import { type Game } from '../../core/game';
import { role } from '../../core/roles';
import { type AbilityObs, type CaseDef } from '../../core/types';
import { abilityText } from '../clueText';
import { h, mount } from '../dom';
import { showStageList, startStage, STAGES } from './stageList';
import { type Stage } from '../../content/chapters';

export interface ResultView {
  kicker: string;
  solved: boolean;
  sub: string;
  def: CaseDef;
  actions: HTMLElement[];
  /** 해설: 아직 계산 중이면 null (setExplain 으로 나중에 채운다) */
  explain: { steps: Step[]; abilities: AbilityObs[] } | null;
}
type Explain = { steps: Step[]; abilities: AbilityObs[] };

function explainBody(def: CaseDef, e: Explain | null, failed = false): (HTMLElement | false)[] {
  if (failed) return [h('p', { class: 'explain-note', 'data-explain': 'failed' }, '해설을 만들지 못했어요.')];
  if (!e) return [h('p', { class: 'explain-note', 'data-explain': 'loading' }, '해설 정리 중…')];
  return [
    e.abilities.length > 0 &&
      h(
        'ul',
        { class: 'abilities' },
        e.abilities.map((o, j) =>
          h('li', {}, `${j + 1}번째 능력 결과 · ${o.cell + 1}번 ${role(def.faces[o.cell]).name}: ${abilityText(o, def.faces[o.cell])}`),
        ),
      ),
    h(
      'ol',
      { class: 'steps' },
      e.steps.map((s) => h('li', { class: `side-${s.claim === 'good' ? 'good' : s.claim === 'notBoss' ? 'unsure' : 'evil'}`, 'data-step': s.cell }, describeStep(s, def))),
    ),
  ];
}

/** 결과 화면을 띄운다. 돌려주는 setExplain 으로 해설을 나중에 채운다 (화면을 벗어났으면 아무 일도 안 한다). */
export function showResultView(v: ResultView): { setExplain: (e: Explain | null) => void } {
  const body = h('div', { class: 'explain-body' }, explainBody(v.def, v.explain));
  const root = h(
    'main',
    { class: 'screen result-screen' },
    h(
      'header',
      { class: `result-head ${v.solved ? 'solved' : 'failed'}` },
      h('p', { class: 'kicker' }, v.kicker),
      h('h1', { class: 'verdict stamp-ink', 'data-result': v.solved ? 'solved' : 'failed' }, v.solved ? '해결' : '미해결'),
      h('p', { class: 'result-sub' }, v.sub),
    ),
    h('div', { class: 'result-actions' }, v.actions),
    h(
      'section',
      { class: 'explain' },
      h('h2', {}, '수사 보고서'),
      h('p', { class: 'explain-note' }, '처음부터 모든 칸을 조사했을 때 주범을 찾아가는 순서입니다.'),
      body,
    ),
  );
  mount(root);
  return {
    setExplain(e) {
      if (root.isConnected) body.replaceChildren(...(explainBody(v.def, e, e === null) as HTMLElement[]).filter(Boolean));
    },
  };
}

export function showResult(stage: Stage, g: Game): void {
  const solved = g.status === 'solved';
  const hasNext = solved && stage.id < STAGES.length;
  showResultView({
    kicker: `${stage.id}스테이지`,
    solved,
    sub: solved ? `주범을 모두 체포했습니다 · 경과 ${g.hour}시간 · 남은 평판 ${g.rep}` : '평판이 바닥났습니다. 다시 해 보세요.',
    def: stage.def,
    explain: { steps: stage.steps, abilities: stage.abilities },
    actions: [
      hasNext && h('button', { class: 'btn primary wide', 'data-action': 'next', onclick: () => startStage(stage.id + 1) }, '다음 스테이지'),
      h('button', { class: `btn wide${hasNext ? '' : ' primary'}`, 'data-action': 'retry', onclick: () => startStage(stage.id) }, '다시 하기'),
      h('button', { class: 'btn ghost wide', onclick: showStageList }, '스테이지 목록'),
    ].filter((x): x is HTMLButtonElement => !!x),
  });
}
