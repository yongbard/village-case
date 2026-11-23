// 작은 DOM 도우미: 요소 만들기, 화면 바꾸기, 알림.
type Child = Node | string | null | undefined | false;
type Attr = string | number | boolean | undefined | ((e: Event) => void);

/** h('button', { class: 'x', onclick: f, disabled: true }, '글자', child) */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, Attr> = {},
  ...kids: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid);
  }
  return el;
}

/** 지금 화면을 el 로 바꾼다 (떠 있는 창과 알림도 닫는다) */
export function mount(el: HTMLElement): void {
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  document.getElementById('toast')?.remove();
  document.getElementById('app')!.replaceChildren(el);
  window.scrollTo(0, 0);
}

/** 화면 위에 뜨는 창. 바탕을 누르면 닫힌다(closable). 닫는 함수를 돌려준다. */
export function overlay(body: HTMLElement, closable = true): () => void {
  const back = h('div', { class: 'overlay' }, body);
  const close = () => back.remove();
  if (closable) back.addEventListener('click', (e) => e.target === back && close());
  document.body.append(back);
  return close;
}

let toastTimer: number | undefined;
/** 잠깐 떴다 사라지는 알림 */
export function toast(text: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}
