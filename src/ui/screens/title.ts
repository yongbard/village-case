// 타이틀 화면
import { ROLES } from '../../core/roles';
import { h, mount } from '../dom';
import { startEndless, startSeedCase } from '../endless';
import { parseCode } from '../seedCode';
import { getSave } from '../store';
import { showCodex } from './codex';
import { showRules } from './rules';
import { showStageList, STAGES } from './stageList';

export function showTitle(): void {
  const { cleared, endless, endlessBest, seenCards } = getSave();
  const msg = h('p', { class: 'seed-msg', role: 'alert', 'data-seed-msg': '' });
  const input = h('input', {
    class: 'seed-input',
    type: 'text',
    inputmode: 'numeric',
    placeholder: '시드 또는 사건 코드',
    'aria-label': '시드',
    autocomplete: 'off',
  });
  const submit = (e: Event) => {
    e.preventDefault();
    const code = parseCode(input.value);
    if (code === null) {
      msg.textContent = '시드는 0 이상의 정수이거나 사건 코드(예: 3-12345001)여야 해요.';
      return;
    }
    startSeedCase(code.n, code.seed);
  };
  const metRoles = seenCards.filter((k) => k in ROLES).length;
  mount(
    h(
      'main',
      { class: 'screen title-screen' },
      h(
        'div',
        { class: 'folder manila' },
        h('span', { class: 'folder-stamp stamp-ink', 'aria-hidden': 'true' }, '기밀'),
        h(
          'div',
          { class: 'title-block' },
          h('p', { class: 'kicker' }, '수 사 기 록'),
          h('h1', { class: 'game-title' }, '마을 수사록'),
          h('p', { class: 'folder-sub' }, '작은 마을 · 미해결 사건철'),
          h('p', { class: 'tagline' }, '진술을 모으고, 거짓말을 가려내고, 숨은 악을 체포하세요.'),
        ),
      ),
      h(
        'nav',
        { class: 'title-menu' },
        h(
          'button',
          { class: 'btn primary wide big', 'data-action': 'stages', onclick: showStageList },
          '사건 파일',
          h('small', {}, `${cleared.length} / ${STAGES.length} 해결`),
        ),
        endless &&
          h(
            'button',
            { class: 'btn primary wide big', 'data-action': 'endless-resume', onclick: () => startEndless(true) },
            '끝없는 수사 이어 하기',
            h('small', {}, `${endless.n}번째 사건 · 평판 ${endless.rep}`),
          ),
        h(
          'button',
          { class: `btn wide big${endless ? '' : ' primary'}`, 'data-action': 'endless-new', onclick: () => startEndless(false) },
          endless ? '끝없는 수사 새로 시작' : '끝없는 수사',
          h('small', {}, `최고 기록 ${endlessBest}`),
        ),
        h(
          'div',
          { class: 'title-row' },
          h('button', { class: 'btn wide', 'data-action': 'codex', onclick: showCodex }, '인물 카드철', h('small', {}, `${metRoles} / ${Object.keys(ROLES).length}`)),
          h('button', { class: 'btn wide', 'data-action': 'rules', onclick: showRules }, '수사 규칙'),
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
