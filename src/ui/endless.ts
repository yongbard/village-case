// 무한 모드와 시드 사건. 사건은 worker 가 만들고, 지금 사건을 푸는 동안 다음 사건을 미리 만들어 둔다.
import { type Step } from '../core/explain';
import { type AbilityObs, type CaseDef } from '../core/types';
import { h, mount } from './dom';
import { formatCode } from './seedCode';
import { showCase } from './screens/caseScreen';
import { showResultView } from './screens/result';
import { showTitle } from './screens/title';
import { getSave, updateSave } from './store';
import { requestExplain, requestGenerate } from './workerClient';

interface State {
  n: number;
  rep: number;
  /** 이번 도전의 시드. n 번째 사건의 시드는 caseSeed(seed, n) 이라 이어 하면 같은 사건이 나온다. */
  seed: number;
}

const MAX_REP = 10;
const caseSeed = (run: number, n: number) => run * 1000 + n;

let token = 0;
let prefetch: { key: string; promise: Promise<CaseDef> } | null = null;

/** n 번째 사건을 만들어 두거나(이미 만드는 중이면 그것을) 돌려준다 */
function caseFor(n: number, seed: number): Promise<CaseDef> {
  const key = `${n}:${seed}`;
  if (prefetch?.key !== key) {
    const promise = requestGenerate(n, seed);
    prefetch = { key, promise };
    promise.catch(() => {
      if (prefetch?.promise === promise) prefetch = null; // 실패한 것은 다음에 새로 만든다
    });
  }
  return prefetch.promise;
}

function markSeen(def: CaseDef): void {
  const ids = [...new Set([...def.inPlay, ...def.faces])];
  const have = getSave().seenCards;
  const fresh = ids.filter((id) => !have.includes(id));
  if (fresh.length) updateSave((s) => ({ ...s, seenCards: [...s.seenCards, ...fresh] }));
}

function loading(text: string, extra: HTMLElement[] = []): void {
  mount(
    h(
      'main',
      { class: 'screen loading-screen' },
      h('p', { class: 'loading-text', 'data-loading': '' }, text),
      ...extra,
      h('button', { class: 'btn ghost wide', onclick: leave }, '처음으로'),
    ),
  );
}

function leave(): void {
  token++;
  showTitle();
}

/** 사건을 받아 화면에 올린다. 못 만들면 다시 시도 단추를 보여 준다 (누르면 onRetry 뒤에 다시 받는다). */
function load(get: () => Promise<CaseDef>, then: (def: CaseDef) => void, onRetry?: () => void): void {
  const mine = ++token;
  loading('사건 준비 중…');
  get().then(
    (def) => {
      if (token === mine) then(def);
    },
    () => {
      if (token !== mine) return;
      loading('사건을 만들지 못했어요.', [
        h('button', { class: 'btn primary wide', onclick: () => (onRetry?.(), load(get, then, onRetry)) }, '다시 시도'),
      ]);
    },
  );
}

function explainInto(def: CaseDef, view: { setExplain: (e: { steps: Step[]; abilities: AbilityObs[] } | null) => void }): void {
  requestExplain(def).then(view.setExplain, () => view.setExplain(null));
}

export function startEndless(resume: boolean): void {
  const saved = getSave().endless;
  const st: State = resume && saved ? { ...saved } : { n: 1, rep: MAX_REP, seed: Math.floor(Math.random() * 1_000_000) };
  updateSave((s) => ({ ...s, endless: st }));
  runCase(st);
}

function runCase(st: State): void {
  // 같은 시드는 같은 사건이라 또 못 만든다: 다시 시도는 도전 시드를 바꿔 새 사건으로, 이어 하기도 그 사건이 나오게 저장한다
  const retry = () => {
    st = { ...st, seed: (st.seed + 1) % 1_000_000 };
    updateSave((s) => ({ ...s, endless: { ...st } }));
  };
  load(
    () => caseFor(st.n, caseSeed(st.seed, st.n)),
    (def) => {
      markSeen(def);
      showCase(def, {
        mode: 'endless',
        rep: st.rep,
        title: `무한 · ${st.n}번째 사건`,
        code: formatCode({ n: st.n, seed: def.seed }),
        // 잃은 평판은 나갔다 와도 돌아오지 않는다
        onRep: (rep) => updateSave((s) => ({ ...s, endless: { n: st.n, rep, seed: st.seed } })),
        onStatus: (g) => commit(st, g.status === 'solved', g.rep),
        onEnd: (g) => finish(st, def, g.status === 'solved', g.rep, g.hour),
      });
      void caseFor(st.n + 1, caseSeed(st.seed, st.n + 1)); // 풀고 있는 동안 다음 사건을 만든다
    },
    retry,
  );
}

/** 사건이 끝난 순간에 저장한다: 해결 → 다음 사건 상태, 실패 → 진행 삭제와 최고 기록. 결과 화면 타이머를 기다리지 않는다. */
function commit(st: State, solved: boolean, rep: number): void {
  if (solved) {
    const next: State = { n: st.n + 1, rep: Math.min(MAX_REP, rep + 1), seed: st.seed };
    updateSave((s) => ({ ...s, endless: next, endlessBest: Math.max(s.endlessBest, st.n) }));
  } else {
    updateSave((s) => {
      const { endless: _gone, ...rest } = s;
      return { ...rest, endlessBest: Math.max(s.endlessBest, st.n - 1) };
    });
  }
}

/** 결과 화면 (저장은 commit 이 이미 했다) */
function finish(st: State, def: CaseDef, solved: boolean, rep: number, hour: number): void {
  const best = getSave().endlessBest;
  if (solved) {
    const next: State = { n: st.n + 1, rep: Math.min(MAX_REP, rep + 1), seed: st.seed };
    explainInto(
      def,
      showResultView({
        kicker: `무한 모드 · ${st.n}번째 사건`,
        solved: true,
        sub: `경과 ${hour}시간 · 평판 ${rep} → ${next.rep} · 푼 사건 ${st.n} · 최고 기록 ${best}`,
        def,
        explain: null,
        actions: [
          h('button', { class: 'btn primary wide', 'data-action': 'next', onclick: () => runCase(next) }, '다음 사건'),
          h('button', { class: 'btn ghost wide', onclick: showTitle }, '처음으로'),
        ],
      }),
    );
  } else {
    const done = st.n - 1;
    explainInto(
      def,
      showResultView({
        kicker: '무한 모드',
        solved: false,
        sub: `푼 사건 ${done} · 최고 기록 ${best}`,
        def,
        explain: null,
        actions: [
          h('button', { class: 'btn primary wide', 'data-action': 'retry', onclick: () => startEndless(false) }, '새로 시작'),
          h('button', { class: 'btn ghost wide', onclick: showTitle }, '처음으로'),
        ],
      }),
    );
  }
}

/** 코드(n-시드)로 만든 사건 한 판. 저장 데이터(무한 모드 진행·최고 기록)는 건드리지 않는다. */
export function startSeedCase(n: number, seed: number): void {
  const code = formatCode({ n, seed });
  load(
    () => requestGenerate(n, seed),
    (def) => {
      markSeen(def);
      showCase(def, {
        mode: 'endless',
        rep: MAX_REP,
        title: '시드 사건',
        code,
        onEnd: (g) =>
          explainInto(
            def,
            showResultView({
              kicker: `시드 ${code}`,
              solved: g.status === 'solved',
              sub: g.status === 'solved' ? `경과 ${g.hour}시간 · 남은 평판 ${g.rep}` : '평판이 바닥났습니다.',
              def,
              explain: null,
              actions: [
                h('button', { class: 'btn primary wide', 'data-action': 'retry', onclick: () => startSeedCase(n, seed) }, '같은 사건 다시'),
                h('button', { class: 'btn ghost wide', onclick: showTitle }, '처음으로'),
              ],
            }),
          ),
      });
    },
  );
}
