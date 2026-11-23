// 타이틀 화면
import { h, mount } from '../dom';
import { getSave } from '../store';
import { showStageList, STAGES } from './stageList';

export function showTitle(): void {
  const { cleared } = getSave();
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
      ),
    ),
  );
}
