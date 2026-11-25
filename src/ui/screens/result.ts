// 결과 화면: 해결/실패, 해설 단계(스테이지는 미리 계산한 것, 무한 모드는 worker 가 계산해 늦게 도착), 다음 / 다시 하기.
import { describeStep, type Step } from '../../core/explain';
import { type Game } from '../../core/game';
import { role } from '../../core/roles';
import { ANY_WITNESS, type AbilityObs, type CaseDef } from '../../core/types';
import { abilityText } from '../clueText';
import { h, mount } from '../dom';
import { tape, tocRow } from '../paper';
import { showStageList, startStage, STAGES } from './stageList';
import { type Stage } from '../../content/chapters';

export interface ResultView {
  /** 보고서 머리 오른쪽 번호 자리 (예: 사건 No. 01) */
  kicker: string;
  /** 보고서 양식 칸: [라벨, 값] */
  facts: [string, string][];
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
  if (e.steps.length === 0) return [h('p', { class: 'explain-note', 'data-explain': 'too-long' }, '이 사건은 따질 경우가 너무 많아 해설을 정리하지 못했어요.')];
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

/** 체포한 주범 "{잡은 수} / {전체}" */
export function bossesCaught(def: CaseDef, arrested: boolean[]): string {
  const bosses = def.truth.roles.flatMap((r, i) => (r !== ANY_WITNESS && role(r).camp === 'boss' ? [i] : []));
  return `${bosses.filter((i) => arrested[i]).length} / ${bosses.length}`;
}

/** 결과 화면을 띄운다. 돌려주는 setExplain 으로 해설을 나중에 채운다 (화면을 벗어났으면 아무 일도 안 한다). */
export function showResultView(v: ResultView): { setExplain: (e: Explain | null) => void } {
  const body = h('div', { class: 'explain-body' }, explainBody(v.def, v.explain));
  // 테이프로 붙인 수사 보고서 한 장: 머리 양식 줄, 양식 칸, 큰 도장, 이동, 해설
  const root = h(
    'main',
    { class: 'screen result-screen' },
    h(
      'section',
      { class: 'leaf report' },
      tape(),
      h(
        'header',
        { class: `result-head ${v.solved ? 'solved' : 'failed'}` },
        h('p', { class: 'report-no' }, h('span', {}, '수사 보고서'), h('span', { class: 'report-kicker' }, v.kicker)),
        h('h2', { class: 'report-title' }, '보고서'),
        h('table', { class: 'form-grid' }, h('tr', {}, v.facts.map(([k, val]) => h('td', {}, h('span', { class: 'label' }, k), h('b', { class: 'val' }, val))))),
        h('h1', { class: 'verdict stamp-ink', 'data-result': v.solved ? 'solved' : 'failed' }, v.solved ? '해결' : '미해결'),
        h('p', { class: 'result-sub' }, v.sub),
      ),
      h('div', { class: 'result-actions' }, v.actions),
      h(
        'section',
        { class: 'explain' },
        h('p', { class: 'label explain-head' }, '처음부터 모든 칸을 조사했을 때 주범을 찾아가는 순서'),
        body,
      ),
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
  const pad2 = (n: number) => String(n).padStart(2, '0');
  showResultView({
    kicker: `사건 No. ${pad2(stage.id)}`,
    facts: [
      ['경과', `${g.hour}시간`],
      ['남은 평판', String(g.rep)],
      ['체포한 주범', bossesCaught(stage.def, g.arrested)],
    ],
    solved,
    sub: solved ? '주범을 모두 체포했습니다.' : '평판이 바닥났습니다. 다시 해 보세요.',
    def: stage.def,
    explain: { steps: stage.steps, abilities: stage.abilities },
    actions: [
      hasNext && tocRow({ name: '다음 스테이지', val: `No. ${pad2(stage.id + 1)}`, attrs: { class: 'go', 'data-action': 'next', onclick: () => startStage(stage.id + 1) } }),
      h('button', { class: hasNext ? 'link' : 'btn primary wide', 'data-action': 'retry', onclick: () => startStage(stage.id) }, '다시 하기'),
      h('button', { class: 'link', 'data-action': 'list', onclick: showStageList }, '스테이지 목록'),
    ].filter((x): x is HTMLButtonElement => !!x),
  });
}
