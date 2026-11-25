// 서류철 물건 조각: 목차 줄, 테이프
import { h } from './dom';

type Attrs = Parameters<typeof h>[1];

/** 목차 한 줄: 쪽 번호 + 이름 + 점선 + 값 + › (타이틀 메뉴, 결과 화면 다음 사건) */
export function tocRow(o: { no?: string; name: string; val?: string; attrs: NonNullable<Attrs> }): HTMLButtonElement {
  return h(
    'button',
    { ...o.attrs, class: `toc-row${o.attrs.class ? ` ${o.attrs.class}` : ''}` },
    o.no !== undefined && h('span', { class: 'toc-no' }, o.no),
    h('span', { class: 'toc-name' }, o.name),
    h('span', { class: 'toc-lead', 'aria-hidden': 'true' }),
    o.val !== undefined && h('span', { class: 'toc-val' }, o.val),
    h('span', { class: 'toc-arrow', 'aria-hidden': 'true' }, '›'),
  );
}

/** 종이를 붙인 테이프 조각 (장식, 누르는 자리를 막지 않는다) */
export const tape = (): HTMLSpanElement => h('span', { class: 'tape', 'aria-hidden': 'true' });
