// 타이틀 화면
import { ROLES } from '../../core/roles';
import { h, mount } from '../dom';
import { startEndless, startSeedCase } from '../endless';
import { getSave } from '../store';
import { showCodex } from './codex';
import { showRules } from './rules';
import { showStageList, STAGES } from './stageList';

/** 시드: 0 이상 4294967295 이하의 정수 */
function parseSeed(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,10}$/.test(t)) return null;
  const n = Number(t);
  return n <= 4294967295 ? n : null;
}

export function showTitle(): void {
  const { cleared, endless, endlessBest, seenCards } = getSave();
  const msg = h('p', { class: 'seed-msg', role: 'alert', 'data-seed-msg': '' });
  const input = h('input', {
    class: 'seed-input',
    type: 'text',
    inputmode: 'numeric',
    placeholder: '시드 (숫자)',
    'aria-label': '시드',
    autocomplete: 'off',
  });
  const submit = (e: Event) => {
    e.preventDefault();
    const seed = parseSeed(input.value);
    if (seed === null) {
      msg.textContent = '시드는 0 이상의 정수(4294967295 이하)로 넣어 주세요.';
      return;
    }
    startSeedCase(seed);
  };
  const metRoles = seenCards.filter((k) => k in ROLES).length;
  mount(
    h(
      'main',
      { class: 'screen title-screen' },
      h(
        'div',
        { class: 'title-block' },
        h('p', { class: 'kicker' }, '사건 기록철'),
        h('h1', { class: 'game-title' }, '마을 수사록'),
        h('p', { class: 'tagline' }, '진술을 모으고, 거짓말을 가려내고, 숨은 악을 체포하세요.'),
      ),
      h(
        'nav',
        { class: 'title-menu' },
        h(
          'button',
          { class: 'btn primary wide big', 'data-action': 'stages', onclick: showStageList },
          '스테이지',
          h('small', {}, `${cleared.length} / ${STAGES.length} 해결`),
        ),
        endless &&
          h(
            'button',
            { class: 'btn primary wide big', 'data-action': 'endless-resume', onclick: () => startEndless(true) },
            '무한 모드 이어 하기',
            h('small', {}, `${endless.n}번째 사건 · 평판 ${endless.rep}`),
          ),
        h(
          'button',
          { class: `btn wide big${endless ? '' : ' primary'}`, 'data-action': 'endless-new', onclick: () => startEndless(false) },
          endless ? '무한 모드 새로 시작' : '무한 모드',
          h('small', {}, `최고 기록 ${endlessBest}`),
        ),
        h(
          'div',
          { class: 'title-row' },
          h('button', { class: 'btn wide', 'data-action': 'codex', onclick: showCodex }, '도감', h('small', {}, `${metRoles} / ${Object.keys(ROLES).length}`)),
          h('button', { class: 'btn wide', 'data-action': 'rules', onclick: showRules }, '규칙'),
        ),
        h(
          'form',
          { class: 'seed-form', 'data-seed-form': '', onsubmit: submit },
          input,
          h('button', { class: 'btn', type: 'submit', 'data-action': 'seed-play' }, '시드로 하기'),
        ),
        msg,
      ),
    ),
  );
}
