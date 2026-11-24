// 사건 화면: 위 줄(시간·평판·비율·직업 목록), 격자, 안내·힌트, 진술 목록. 칸을 누르면 행동 메뉴.
import { describeStep, type Hint } from '../../core/explain';
import {
  arrest,
  hintKnowledge,
  investigate,
  newGame,
  setNote,
  useAbility,
  visibleClue,
  type Game,
  type Note,
} from '../../core/game';
import { isEvil, role } from '../../core/roles';
import { ANY_WITNESS, type CaseDef, type Claim, type RoleId, type Side } from '../../core/types';
import { GUIDE } from '../../content/tutorial';
import { abilityText, clueText, pendingText } from '../clueText';
import { h, mount, overlay, toast } from '../dom';
import { CAMP_NAME, SIDE_MARK, SIDE_NAME } from '../labels';
import { guideBubble } from '../tutorialOverlay';
import { photo } from '../portraits';
import { speechList } from '../speech';
import { requestHint } from '../workerClient';
import { showStageList } from './stageList';
import { showTitle } from './title';

export interface CaseOpts {
  mode: 'stage' | 'endless';
  stageId?: number;
  rep?: number;
  /** 무한 모드에서 머리글 제목 (예: 3번째 사건). 없으면 '무한 모드' */
  title?: string;
  /** 무한 모드에서 화면에 보이는 사건 코드 (n-시드) */
  code?: string;
  /** 평판이 바뀔 때마다 (무한 모드 저장용) */
  onRep?: (rep: number) => void;
  /** 사건이 끝난 순간(해결·실패) 한 번. 결과 화면보다 먼저, 타이머 없이 불린다. */
  onStatus?: (g: Game) => void;
  onEnd: (g: Game) => void;
}

/** 핀으로 꽂은 카드의 기울기(도). 칸 번호로 정해 다시 그려도 같다. */
const TILT = [-2, 1.2, -0.8, 1.6, -1.4];

/** 칸 구석의 메모 표시 */
const NOTE_MARK: Record<Note, string> = { good: '선', evil: '악', unsure: '?' };
/** 메뉴의 메모 단추 */
const NOTE_BUTTON: Record<Note, string> = { good: '○ 선', evil: '● 악', unsure: '?' };
const NOTE_NAME: Record<Note, string> = { good: '선', evil: '악', unsure: '모름' };

/** 체포로 드러난 진짜 직업 (직업을 모르는 증인은 겉 직업으로) */
const trueRole = (def: CaseDef, i: number): RoleId =>
  def.truth.roles[i] === ANY_WITNESS ? def.faces[i] : def.truth.roles[i];
const sideOf = (id: RoleId): Side => (isEvil(role(id).camp) ? 'evil' : 'good');

/** 칸 i 의 진술 자리 문장들 (진술, 계기 전, 능력) */
function statements(g: Game, i: number): string[] {
  const face = role(g.def.faces[i]);
  const out: string[] = [];
  const c = visibleClue(g, i);
  if (c) out.push(clueText(c, i, g.def.w, g.def.h));
  else if (face.trigger !== undefined && g.def.clues[i]) out.push(pendingText(face.trigger));
  if (face.ability) {
    const o = g.abilities.find((a) => a.cell === i);
    out.push(o ? `(능력) ${abilityText(o)}` : '진술 없음 · 능력을 쓸 수 있음');
  }
  if (out.length === 0) out.push('진술 없음');
  return out;
}

export function showCase(def: CaseDef, opts: CaseOpts): void {
  let g = newGame(def, opts.rep ?? 10);
  /** 관찰이 바뀔 때마다 올린다. 이전 관찰로 받은 힌트는 버린다. */
  let version = 0;
  let thinking = false;
  /** 돌고 있는 힌트 요청을 취소한다 (관찰이 바뀌면 그 힌트는 쓸모없다) */
  let hintAbort: AbortController | null = null;
  let hint: { text: string; cell?: number } | null = null;
  /** 앞 힌트가 증명한 사실. 다음 힌트 요청에 알던 사실로 넘겨 같은 칸을 다시 가리키지 않게 한다. */
  const proven: (Claim | undefined)[] = Array(def.w * def.h).fill(undefined);
  /** 이미 보여 준 힌트 (종류:칸). 같은 힌트를 다시 보여 줄 때는 무한 모드 평판을 쓰지 않는다. */
  const hinted = new Set<string>();
  let picking: { cell: number; picks: number[] } | null = null;
  let ended = false;
  let endTimer: number | undefined;
  const endless = opts.mode === 'endless';
  const guide = opts.mode === 'stage' && (opts.stageId === 1 || opts.stageId === 2) ? GUIDE[opts.stageId] : null;
  let guideAt = guide ? 0 : -1;
  /** 다음 그리기에서 한 번 보여 줄 연출: 조사하면 카드 뒤집기, 체포하면 도장 */
  let fx: { cell: number; kind: 'reveal' | 'stamp' } | null = null;

  const root = h('main', { class: 'screen case-screen' });
  mount(root);
  render();

  if (import.meta.env.DEV) {
    // 화면 확인 도구용: 지금 사건과 판 상태를 읽는다
    (window as unknown as { __game?: unknown }).__game = {
      get def() {
        return def;
      },
      get g() {
        return g;
      },
    };
  }

  function cancelHint() {
    hintAbort?.abort();
    hintAbort = null;
  }

  function quit() {
    window.clearTimeout(endTimer);
    cancelHint();
    if (opts.mode === 'stage') showStageList();
    else showTitle();
  }

  function apply(next: Game) {
    if (next === g) return false;
    const before = g.rep;
    if (next.hour !== g.hour || next.abilities.length !== g.abilities.length || next.rep !== g.rep) {
      version++;
      thinking = false;
      hint = null;
      cancelHint();
    }
    g = next;
    if (g.rep !== before && g.status === 'playing') opts.onRep?.(g.rep);
    render();
    if (g.status !== 'playing' && !ended) {
      ended = true;
      opts.onStatus?.(g);
      endTimer = window.setTimeout(() => {
        if (root.isConnected) opts.onEnd(g); // 그 사이 나갔으면 결과 화면으로 끌고 가지 않는다
      }, 900);
    }
    return true;
  }

  function doArrest(i: number) {
    const before = g.rep;
    fx = { cell: i, kind: 'stamp' };
    if (!apply(arrest(g, i))) {
      fx = null;
      return;
    }
    const r = role(trueRole(def, i));
    if (g.rep < before) toast(`선(${CAMP_NAME[r.camp]})을 체포했습니다. 평판 -${before - g.rep}`);
    else toast(`악을 체포했습니다: ${r.name}(${CAMP_NAME[r.camp]})`);
  }

  async function askHint() {
    if (thinking || ended || (endless && g.rep <= 1)) return;
    thinking = true;
    hint = null;
    const asked = version;
    const ctrl = new AbortController();
    hintAbort = ctrl;
    render();
    let res: Hint | null = null;
    try {
      res = await requestHint(hintKnowledge(g, proven), ctrl.signal);
    } catch {
      res = null;
    }
    if (ctrl.signal.aborted || asked !== version || ended || !root.isConnected) return; // 그 사이 판이 바뀌었다
    hintAbort = null;
    thinking = false;
    hint = hintMessage(res);
    // 처음 보여 주는 힌트인가. 증명된 단계는 다음 요청에 알던 선악으로 넘긴다.
    let fresh = false;
    if (res && hint.cell !== undefined) {
      const key = res.kind === 'step' ? `step:${res.step.cell}` : `${res.kind}:${res.cell}`;
      fresh = !hinted.has(key);
      hinted.add(key);
      if (res.kind === 'step') proven[res.step.cell] = res.step.claim;
    }
    // 무한 모드: 새 힌트가 나왔을 때(새로 칸을 가리킬 때)만 평판 1 을 쓴다
    if (endless && fresh) {
      g = { ...g, rep: Math.max(1, g.rep - 1) };
      opts.onRep?.(g.rep);
      toast('힌트를 썼습니다. 평판 -1');
    }
    render();
  }

  function hintMessage(res: Hint | null): { text: string; cell?: number } {
    const nothing = { text: '더 알려 줄 것이 없어요.' };
    if (!res) return { text: '힌트를 찾지 못했어요. 다시 눌러 보세요.' };
    if (res.kind === 'step') return { text: describeStep(res.step, def), cell: res.step.cell };
    if (res.kind === 'investigate') {
      if (g.investigated[res.cell] || g.arrested[res.cell]) return nothing;
      return { text: `${res.cell + 1}번 칸을 조사해 보세요.`, cell: res.cell };
    }
    if (g.used[res.cell]) return nothing;
    return { text: `${res.cell + 1}번 ${role(def.faces[res.cell]).name}의 능력을 써 보세요.`, cell: res.cell };
  }

  function onCell(i: number) {
    if (ended) return;
    if (picking) {
      if (i === picking.cell || picking.picks.includes(i)) {
        toast('다른 칸을 고르세요.');
        return;
      }
      picking.picks.push(i);
      if (picking.picks.length < 2) {
        render();
        return;
      }
      const { cell, picks } = picking;
      picking = null;
      if (apply(useAbility(g, cell, picks[0], picks[1]))) toast(abilityText(g.abilities[g.abilities.length - 1]));
      else render();
      return;
    }
    openMenu(i);
  }

  function openMenu(i: number) {
    const face = role(def.faces[i]);
    let close = () => {};
    const run = (f: () => void) => () => {
      close();
      f();
    };
    let body: HTMLElement;
    if (g.arrested[i]) {
      const r = role(trueRole(def, i));
      const side = sideOf(r.id);
      body = h(
        'div',
        { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'sheet-head' }, photo(r.id, 'sheet-photo'), h('b', {}, `${i + 1}번 칸`), h('span', {}, '체포함')),
        h(
          'p',
          { class: `sheet-truth side-${side}` },
          `${SIDE_MARK[side]} ${r.name} · ${CAMP_NAME[r.camp]} (${SIDE_NAME[side]})`,
        ),
        h('p', { class: 'sheet-desc' }, r.desc),
        g.investigated[i] && h('p', { class: 'sheet-clue' }, `겉 직업 ${face.name}: ${statements(g, i).join(' / ')}`),
        canUseAbility(i) && abilityButton(i, run),
        h('button', { class: 'btn wide', onclick: () => close() }, '닫기'),
      );
    } else {
      const note = g.notes[i];
      body = h(
        'div',
        { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        h(
          'div',
          { class: 'sheet-head' },
          g.investigated[i] && photo(face.id, 'sheet-photo'),
          h('b', {}, `${i + 1}번 칸`),
          h('span', {}, g.investigated[i] ? face.name : '조사하지 않음'),
        ),
        g.investigated[i] && h('p', { class: 'sheet-clue' }, statements(g, i).join(' / ')),
        g.investigated[i] &&
          h(
            'button',
            { class: 'btn ghost role-link', 'data-action': 'role', onclick: run(() => showRole(face.id, i)) },
            `${face.name} · 말하는 방식`,
          ),
        h(
          'div',
          { class: 'sheet-actions' },
          h(
            'button',
            {
              class: 'btn action',
              'data-action': 'investigate',
              disabled: g.investigated[i],
              onclick: run(() => {
                fx = { cell: i, kind: 'reveal' };
                if (!apply(investigate(g, i))) fx = null;
              }),
            },
            '조사',
            h('small', {}, g.investigated[i] ? '조사함' : '2시간'),
          ),
          canUseAbility(i) && abilityButton(i, run),
          h(
            'button',
            { class: 'btn action danger', 'data-action': 'arrest', onclick: run(() => doArrest(i)) },
            '체포',
            h('small', {}, '1시간'),
          ),
        ),
        h(
          'div',
          { class: 'sheet-memo' },
          h('span', { class: 'memo-label' }, '메모'),
          (['good', 'evil', 'unsure'] as Note[]).map((n) =>
            h(
              'button',
              {
                class: `btn memo memo-${n}${note === n ? ' on' : ''}`,
                'data-note': n,
                'aria-pressed': note === n ? 'true' : 'false',
                onclick: run(() => apply(setNote(g, i, n))),
              },
              NOTE_BUTTON[n],
            ),
          ),
          h(
            'button',
            { class: 'btn memo', 'data-note': 'clear', disabled: !note, onclick: run(() => apply(setNote(g, i))) },
            '지우기',
          ),
        ),
        h('button', { class: 'btn ghost wide', onclick: () => close() }, '닫기'),
      );
    }
    close = overlay(body);
  }

  function canUseAbility(i: number): boolean {
    return g.investigated[i] && !g.used[i] && role(def.faces[i]).ability === 'pairSame';
  }

  function abilityButton(i: number, run: (f: () => void) => () => void): HTMLElement {
    return h(
      'button',
      {
        class: 'btn action',
        'data-action': 'ability',
        onclick: run(() => {
          picking = { cell: i, picks: [] };
          render();
        }),
      },
      '능력',
      h('small', {}, '0시간'),
    );
  }

  /** 직업 설명과 말하는 방식. cell 이 있으면 그 칸 기준 숫자로 보여 준다. */
  function showRole(id: RoleId, cell?: number) {
    const r = role(id);
    let close = () => {};
    close = overlay(
      h(
        'div',
        { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'sheet-head' }, photo(id, 'sheet-photo'), h('b', {}, r.name), h('span', {}, `${CAMP_NAME[r.camp]} · ${SIDE_NAME[sideOf(id)]}`)),
        h('p', { class: 'sheet-desc' }, r.desc),
        speechList(id, cell === undefined ? undefined : { w: def.w, h: def.h, cell }),
        h('button', { class: 'btn wide', onclick: () => close() }, '닫기'),
      ),
    );
  }

  function header(): HTMLElement {
    const camps = def.inPlay.map((id) => role(id).camp);
    const count = (c: string) => camps.filter((x) => x === c).length;
    const title = opts.mode === 'stage' ? `${opts.stageId}스테이지` : (opts.title ?? '무한 모드');
    return h(
      'header',
      { class: 'case-head' },
      h(
        'div',
        { class: 'head-row' },
        h('button', { class: 'btn ghost back', onclick: quit, 'aria-label': '나가기' }, '‹ 나가기'),
        h('h1', { class: 'case-title' }, title),
        h(
          'button',
          {
            class: 'btn hint-btn',
            'data-action': 'hint',
            disabled: thinking || ended || (endless && g.rep <= 1),
            title: endless ? '평판 1을 씁니다' : undefined,
            onclick: askHint,
          },
          thinking ? '생각 중…' : endless ? '힌트 -1' : '힌트',
        ),
      ),
      endless && h('p', { class: 'seed-line', 'data-seed': opts.code ?? def.seed }, `시드 ${opts.code ?? def.seed}`),
      h(
        'div',
        { class: 'stats' },
        h('span', { class: 'stat' }, h('small', {}, '경과'), h('b', { 'data-stat': 'hour' }, `${g.hour}시간`)),
        h(
          'span',
          { class: `stat${g.rep <= 4 ? ' low' : ''}` },
          h('small', {}, '평판'),
          h('b', { 'data-stat': 'rep' }, String(g.rep)),
        ),
        h(
          'span',
          { class: 'stat ratio' },
          h('small', {}, '이번 사건'),
          h('b', {}, `말썽꾼 ${count('trouble')} · 공범 ${count('accomplice')} · 주범 ${count('boss')}`),
        ),
      ),
      h(
        'div',
        { class: 'roles', 'aria-label': '이번 사건의 말썽꾼·악 직업' },
        def.inPlay.map((id) =>
          h(
            'button',
            { class: `chip camp-${role(id).camp}`, onclick: () => showRole(id) },
            role(id).name,
            h('small', {}, CAMP_NAME[role(id).camp]),
          ),
        ),
      ),
    );
  }

  function cellEl(i: number): HTMLElement {
    const guideCell = guide && guideAt >= 0 ? guide[guideAt].cell : undefined;
    const cls = ['cell'];
    let inner: (Node | string | false)[] = [];
    const note = g.notes[i];
    if (g.arrested[i]) {
      const r = role(trueRole(def, i));
      const side = sideOf(r.id);
      cls.push('arrested', `side-${side}`);
      inner = [
        photo(r.id),
        h('span', { class: 'face' }, r.name),
        h('span', { class: 'sub' }, `${CAMP_NAME[r.camp]} · ${SIDE_NAME[side]}`),
        h('span', { class: 'stamp stamp-ink' }, side === 'evil' ? '체포' : '오인 체포'),
      ];
    } else if (g.investigated[i]) {
      cls.push('seen');
      inner = [photo(def.faces[i]), h('span', { class: 'face' }, role(def.faces[i]).name)];
    } else {
      cls.push('hidden');
      inner = [h('span', { class: 'back manila' }, '?'), h('span', { class: 'face unknown' }, '조사 전')];
    }
    if (fx?.cell === i) cls.push(fx.kind === 'reveal' ? 'fx-reveal' : 'fx-stamp');
    if (hint?.cell === i) cls.push('flash');
    if (guideCell === i) cls.push('guide');
    if (picking && (picking.cell === i || picking.picks.includes(i))) cls.push(picking.cell === i ? 'picker' : 'picked');
    const label = `${i + 1}번 칸${g.investigated[i] ? ` ${role(def.faces[i]).name}` : ''}${note ? `, 메모 ${NOTE_NAME[note]}` : ''}`;
    return h(
      'button',
      { class: cls.join(' '), style: `--tilt:${TILT[i % TILT.length]}deg`, 'data-cell': i, 'aria-label': label, onclick: () => onCell(i) },
      h('span', { class: 'pin' }),
      h('span', { class: 'num' }, String(i + 1)),
      note && !g.arrested[i] && h('span', { class: `note postit note-${note}` }, NOTE_MARK[note]),
      ...inner,
    );
  }

  function panel(): HTMLElement | null {
    const items: HTMLElement[] = [];
    if (picking) {
      const p = picking;
      items.push(
        h(
          'div',
          { class: 'bubble pick-bubble' },
          h(
            'p',
            { class: 'bubble-text' },
            `${p.cell + 1}번 ${role(def.faces[p.cell]).name}의 능력: 같은 편인지 물어볼 두 칸을 고르세요. (${p.picks.length}/2)`,
          ),
          h(
            'div',
            { class: 'bubble-nav' },
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn', onclick: () => ((picking = null), render()) }, '취소'),
          ),
        ),
      );
    }
    if (thinking) items.push(h('div', { class: 'bubble hint-bubble', 'data-hint': 'thinking' }, h('p', { class: 'bubble-text' }, '생각 중…')));
    if (hint) {
      items.push(
        h(
          'div',
          { class: 'bubble hint-bubble', 'data-hint': 'result' },
          h('div', { class: 'bubble-head' }, h('span', { class: 'bubble-tag' }, '힌트')),
          h('p', { class: 'bubble-text' }, hint.text),
        ),
      );
    }
    if (guide && guideAt >= 0) {
      items.push(
        guideBubble(guide, guideAt, (n) => {
          guideAt = n;
          render();
        }),
      );
    }
    return items.length ? h('section', { class: 'panel' }, items) : null;
  }

  function clueList(): HTMLElement {
    const seen = g.investigated.flatMap((v, i) => (v ? [i] : []));
    return h(
      'section',
      { class: 'clues' },
      h('h2', {}, '진술 기록', h('small', {}, `${seen.length} / ${def.w * def.h}명 조사`)),
      seen.length === 0
        ? h('p', { class: 'empty' }, '아직 조사한 사람이 없습니다. 칸을 눌러 조사하세요.')
        : h(
            'ol',
            {},
            seen.map((i) => {
              const side = g.arrested[i] ? sideOf(trueRole(def, i)) : undefined;
              return h(
                'li',
                { class: side ? `arrested side-${side}` : '', 'data-line': i },
                h('span', { class: 'ln-num' }, `${i + 1}번`),
                h(
                  'span',
                  { class: 'ln-body' },
                  h('button', { class: 'ln-role', onclick: () => showRole(def.faces[i], i) }, role(def.faces[i]).name),
                  `: ${statements(g, i).join(' / ')}`,
                ),
                side && h('span', { class: 'ln-tag' }, `${SIDE_MARK[side]} ${SIDE_NAME[side]}`),
              );
            }),
          ),
    );
  }

  function render() {
    const grid = h(
      'div',
      { class: 'grid', style: `--w:${def.w}`, role: 'grid', 'aria-label': `${def.w}×${def.h} 마을` },
      Array.from({ length: def.w * def.h }, (_, i) => cellEl(i)),
    );
    root.replaceChildren(header(), grid, panel() ?? '', clueList());
    fx = null;
  }
}
