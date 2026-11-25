// 타이틀 화면
import { ROLES } from '../../core/roles';
import { h, mount } from '../dom';
import { startEndless, startSeedCase } from '../endless';
import { tape, tocRow } from '../paper';
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
    id: 'seed-input',
    type: 'text',
    inputmode: 'numeric',
    placeholder: '예: 3-12345001',
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
  // 목차: 줄마다 쪽 번호가 01 부터 차례로 (이어 하기가 있을 때만 한 줄 늘어난다)
  const rows = [
    { name: '사건 파일', val: `${cleared.length} / ${STAGES.length}`, attrs: { 'data-action': 'stages', onclick: showStageList } },
    endless && { name: '끝없는 수사 이어 하기', val: `${endless.n}번째 · 평판 ${endless.rep}`, attrs: { 'data-action': 'endless-resume', onclick: () => startEndless(true) } },
    { name: endless ? '끝없는 수사 새로 시작' : '끝없는 수사', val: `최고 ${endlessBest}`, attrs: { 'data-action': 'endless-new', onclick: () => startEndless(false) } },
    { name: '인물 카드철', val: `${metRoles} / ${Object.keys(ROLES).length}`, attrs: { 'data-action': 'codex', onclick: showCodex } },
    { name: '수사 규칙', attrs: { 'data-action': 'rules', onclick: showRules } },
  ].filter((r) => !!r);
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
          h('p', { class: 'folder-no' }, h('span', {}, '사건 서류철'), h('span', {}, '제1권')),
          h('h1', { class: 'game-title' }, '마을 수사록'),
          h('p', { class: 'folder-sub' }, '작은 마을 · 미해결 사건철'),
          h('p', { class: 'tagline' }, '진술을 모으고, 거짓말을 가려내고, 숨은 악을 체포하세요.'),
        ),
      ),
      h(
        'nav',
        { class: 'leaf toc', 'aria-label': '목차' },
        tape(),
        h('h2', { class: 'toc-head' }, '목차'),
        rows.map((r, i) => tocRow({ no: String(i + 1).padStart(2, '0'), ...r })),
        h(
          'form',
          { class: 'seed-form', 'data-seed-form': '', onsubmit: submit },
          h('label', { class: 'seed-field', for: 'seed-input' }, h('span', { class: 'label' }, '사건 코드로 열기'), input),
          h('button', { class: 'btn primary', type: 'submit', 'data-action': 'seed-play' }, '열람'),
        ),
        msg,
      ),
    ),
  );
}
