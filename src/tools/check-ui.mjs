// 화면 확인: dev 서버를 띄우고 설치된 Chrome(390×844)으로 1스테이지를 끝까지 푼다 (주범 사냥: 주범을 모두 체포하면 해결).
// node src/tools/check-ui.mjs → 단계마다 OK/FAIL, 하나라도 실패하면 종료 코드 1. 스크린샷은 logs/ui-check/.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS = join(ROOT, 'logs', 'ui-check');
const W = 390;
const H = 844;

process.chdir(ROOT);
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const server = await createServer({
  configFile: join(ROOT, 'vite.config.ts'),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 5199, strictPort: false },
});
let browser;
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  // 판정에 쓰는 게임 규칙은 앱과 같은 모듈에서 가져온다
  const { isEvil, role, ROLES } = await server.ssrLoadModule('/core/roles.ts');
  const { GUIDE } = await server.ssrLoadModule('/content/tutorial.ts');
  const { clueText, clueMarks } = await server.ssrLoadModule('/ui/clueText.ts');
  const stages = JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'stages.json'), 'utf8'));
  const s1 = stages[0];
  const bossOf = (def) => def.truth.roles.flatMap((r, i) => (r !== '*w' && role(r).camp === 'boss' ? [i] : []));
  const bossCells = bossOf(s1.def);
  // 힌트 문장 "N번은 …" 의 사실이 실제와 맞는가
  const CLAIM = { 선: (c) => c === 'witness' || c === 'trouble', 악: (c) => c === 'accomplice' || c === 'boss', 주범: (c) => c === 'boss', 공범: (c) => c === 'accomplice', '주범이 아님': (c) => c !== 'boss' };
  const HINT_STEP = /^(\d+)번은 (선|악|주범이 아님|주범|공범)/;
  const claimOk = (def, m) => !!m && CLAIM[m[2]](def.truth.roles[+m[1] - 1] === '*w' ? 'witness' : role(def.truth.roles[+m[1] - 1]).camp);

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // 실패한 요청은 주소로 적는다 (콘솔 문구에는 주소가 없다). 브라우저가 알아서 찾는 favicon 은 뺀다.
  page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`${r.status()} ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

  // 스크린샷은 연출(도장·뒤집기)이 끝난 뒤에 찍는다. 무한히 도는 애니메이션은 없다.
  const shot = async (name, fullPage = false) => {
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage });
  };
  const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
  const noSideScroll = async (where) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${where}: no horizontal scroll`, sw <= W, `scrollWidth ${sw}`);
  };
  // 템플릿 증상: 보이는 요소 중 모서리가 4px 넘게 둥근 것, 왼쪽 테두리가 3px 이상이고 위 테두리보다 굵은 것 (사진 svg 와 핀은 뺀다)
  const noSlop = async (where) => {
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => !e.closest('svg') && !e.classList.contains('pin') && e.getClientRects().length > 0)
        .filter((e) => {
          const s = getComputedStyle(e);
          const r = Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((k) => parseFloat(s[`border${k}Radius`]) || 0));
          const l = s.borderLeftStyle === 'none' ? 0 : parseFloat(s.borderLeftWidth);
          const t = s.borderTopStyle === 'none' ? 0 : parseFloat(s.borderTopWidth);
          return r > 4 || (l >= 3 && l > t);
        })
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`),
    );
    check(`${where}: no rounded boxes or side stripes`, bad.length === 0, bad.join(', '));
  };
  // 창이 뜨는 움직임이 끝날 때까지 (스크린샷용)
  const settle = () => page.evaluate(() => Promise.all([...document.querySelectorAll('.overlay, .overlay > *')].flatMap((e) => e.getAnimations()).map((a) => a.finished)));
  // 힌트 단추를 누르고 답을 기다린다 (누르는 순간 '생각 중' 이 뜨고, 답이 오면 사라진다)
  const askHint = async () => {
    await page.click('[data-action="hint"]');
    await page.waitForFunction(() => document.querySelector('[data-hint="result"]') && !document.querySelector('[data-hint="thinking"]'), { timeout: 15000 });
    return text('[data-hint="result"] .bubble-text');
  };
  // 사건을 열면 새 직업 카드(있으면)와 인원표가 뜬다: 카드를 넘기고 인원표를 닫는다
  const closeRoster = async () => {
    await page.waitForSelector('[data-sheet="roster"]', { timeout: 5000 });
    while (await page.$('.card-box')) await page.click('[data-action="card-ok"]');
    await page.click('[data-action="roster-close"]');
    await page.waitForSelector('.overlay', { hidden: true, timeout: 3000 });
  };
  const caseOpened = async (timeout = 5000) => {
    await page.waitForSelector('.case-screen .grid', { timeout });
    await closeRoster();
  };
  const tapCell = async (i, action) => {
    // 힌트 등으로 판이 다시 그려지는 중이면 찾은 칸이 바로 떨어져 나갈 수 있어, 찾기와 누르기를 한 번에 한다
    await page.$eval(`.cell[data-cell="${i}"]`, (e) => e.click());
    await page.waitForSelector(`.sheet [data-action="${action}"]`, { timeout: 3000 });
    await page.click(`.sheet [data-action="${action}"]`);
    await page.waitForSelector('.overlay', { hidden: true, timeout: 3000 });
    // 카드 뒤집기·도장 연출이 끝날 때까지 (뒤집히는 중에는 카드가 옆으로 서 있어 누를 수 없다)
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  };

  // 1. 타이틀
  await page.goto(url, { waitUntil: 'networkidle0' });
  check('title screen', (await text('.game-title')) === '마을 수사록');
  check('title menu labels: case files, endless, cards, rules', (await text('[data-action="stages"] .toc-name')) === '사건 파일' && (await text('[data-action="endless-new"] .toc-name'))?.startsWith('끝없는 수사') && (await text('[data-action="codex"] .toc-name')) === '인물 카드철' && (await text('[data-action="rules"] .toc-name')) === '수사 규칙');
  const toc = await page.$$eval('.title-screen .toc .toc-row', (rs) => rs.map((r) => ({ h: r.getBoundingClientRect().height, no: r.querySelector('.toc-no')?.textContent })));
  check('title: menu is one table of contents', toc.length >= 4 && toc.every((r) => r.h >= 56) && toc.every((r, i) => r.no === String(i + 1).padStart(2, '0')), JSON.stringify(toc));
  const folderNo = await page.$$eval('.folder-no span', (ss) => ss.map((s) => s.textContent.trim()).join(' · ')).catch(() => null);
  check('title: folder label reads 사건 서류철 · 제1권', folderNo === '사건 서류철 · 제1권', folderNo ?? 'none');
  check('document title / lang', (await page.title()) === '마을 수사록' && (await page.$eval('html', (e) => e.lang)) === 'ko');
  await shot('01-title');
  await noSlop('title');

  // 2. 스테이지 목록
  await page.click('[data-action="stages"]');
  await page.waitForSelector('.stage[data-stage="1"]');
  const locked = await page.$eval('.stage[data-stage="2"]', (e) => e.disabled);
  check('stage list titled 사건 파일', (await text('.list-head h1')) === '사건 파일');
  check('stage list: 1 open, 2 locked', !(await page.$eval('.stage[data-stage="1"]', (e) => e.disabled)) && locked);
  const current = await page.$$eval('.stage.current', (ss) => ss.map((s) => s.dataset.stage));
  check('stage list: exactly one current stage, the first open unsolved', JSON.stringify(current) === '["1"]', JSON.stringify(current));
  check('stage list: chapter heads read 제N장', ((await text('.list-screen section h2')) ?? '').startsWith('제1장'), await text('.list-screen section h2'));
  await noSideScroll('stage list');
  await shot('02-stages', true);
  await noSlop('stage list');

  // 3. 스테이지 1 + 첫 안내 말풍선
  await page.click('.stage[data-stage="1"]');
  await page.waitForSelector('[data-sheet="roster"]');
  await settle();
  await shot('03a-roster');
  await noSlop('roster sheet');
  const rosterText = (await text('[data-sheet="roster"] table.roster')) ?? '';
  check('stage 1: roster sheet lists camps and roles with counts', /두목 1/.test(rosterText) && /우체부 1/.test(rosterText) && /약사 7/.test(rosterText), rosterText);
  check('stage 1: roster explains 수상한 사람', ((await text('.roster-note')) ?? '').includes('수상한 사람'), await text('.roster-note'));
  check('stage 1: roster says the goal', ((await text('.roster-goal')) ?? '').includes('주범 1명을 모두 체포'), await text('.roster-goal'));
  const rosterBox = await (await page.$('[data-sheet="roster"]')).boundingBox();
  check('roster sheet fits the width', rosterBox.x >= 0 && rosterBox.x + rosterBox.width <= W, `x ${rosterBox.x} w ${rosterBox.width}`);
  await closeRoster();
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-sheet="roster"]');
  check('roster reopens from the header memo', ((await text('[data-action="roster-close"]')) ?? '') === '닫기');
  await page.click('[data-action="roster-close"]');
  await page.waitForSelector('.overlay', { hidden: true });
  check('header memo counts caught bosses', ((await text('[data-stat="bosses"]')) ?? '').replace(/\u00a0/g, ' ').startsWith('체포 0/1 · 두목 1'), await text('[data-stat="bosses"]'));
  const memoBox = await (await page.$('[data-stat="bosses"]')).boundingBox();
  check('header memo fits the width', memoBox.x >= 0 && memoBox.x + memoBox.width <= W, `x ${memoBox.x} w ${memoBox.width}`);
  await page.waitForSelector('.guide-bubble');
  const bubble = await text('.guide-bubble .bubble-text');
  check('stage 1: first GUIDE bubble visible', bubble === GUIDE[1][0].text, bubble ?? 'none');
  check('stage 1: grid has 9 cells', (await page.$$('.cell')).length === 9);
  const gridBox = await (await page.$('.grid')).boundingBox();
  check('grid fills the width', gridBox.width >= W - 40 && gridBox.x + gridBox.width <= W, `x ${gridBox.x} w ${gridBox.width}`);
  await noSideScroll('case screen');
  await shot('03-case-guide');
  await noSlop('case screen with guide');

  // 4. 힌트 (worker) — 아무것도 조사하지 않았으니 조사할 칸을 알려 준다
  await page.click('[data-action="hint"]');
  await page.waitForSelector('[data-hint="result"]', { timeout: 15000 });
  const hintText = await text('[data-hint="result"] .bubble-text');
  check('hint answers from worker', /조사해 보세요|번은 (선|악|주범|공범)/.test(hintText ?? ''), hintText ?? 'none');
  await shot('04-hint');
  await noSlop('hint bubble');

  // 5. 메모: 가운데 칸 조사 후 선 메모
  await page.click('[data-action="guide-next"]');
  await tapCell(4, 'investigate');
  await page.click('.cell[data-cell="4"]');
  await page.waitForSelector('.sheet [data-note="good"]');
  await settle();
  await shot('05-menu');
  await noSlop('cell menu');
  await page.click('.sheet [data-note="good"]');
  await page.waitForSelector('.cell[data-cell="4"] .note-good');
  check('memo mark shows in cell corner', true);
  check('uninvestigated card shows its back, no photo', !!(await page.$('.cell[data-cell="8"] .back')) && !(await page.$('.cell[data-cell="8"] .photo')));
  check('investigated card shows a photo', !!(await page.$('.cell[data-cell="4"] .photo')));
  check('investigate costs 2 hours', (await text('[data-stat="hour"]')) === '2시간');
  const want4 = `5번${role(s1.def.faces[4]).name}: ${clueText(s1.def.clues[4], 4, 3, 3, s1.def.faces[4])}`;
  check('clue line in list names the job voice and cells', (await text('.clues li[data-line="4"]')) === want4, `${await text('.clues li[data-line="4"]')} / want ${want4}`);
  // 진술을 누르면 그 진술이 가리키는 칸에 빨간 동그라미, 다시 누르면 지운다
  await page.$eval('[data-mark="4"]', (e) => e.click());
  const marks4 = await page.$$eval('.cell.mark', (es) => es.map((e) => +e.dataset.cell));
  check('tapping a statement marks its cells', JSON.stringify(marks4) === JSON.stringify(clueMarks(s1.def.clues[4], 3, 3).cells), JSON.stringify(marks4));
  await shot('05a-marks');
  await page.$eval('[data-mark="4"]', (e) => e.click());
  check('tapping it again clears the marks', (await page.$$('.cell.mark')).length === 0);

  // 5b. 진술 목록의 직업 이름 → 말하는 방식 (그 칸 기준 범위), 칸 메뉴에서도 열린다
  await page.click('.clues li[data-line="4"] .ln-role');
  await page.waitForSelector('.sheet .speech');
  await settle();
  await shot('05b-role');
  const speech = (await text('.sheet .speech')) ?? '';
  check('role sheet shows truth and lie range for this cell', speech.includes('주변 8칸') && speech.includes('0 ~ 8명 중 실제와 다른 수'), speech);
  await page.click('.sheet .btn.wide');
  await page.waitForSelector('.overlay', { hidden: true });
  await tapCell(0, 'investigate');
  await page.click('.cell[data-cell="0"]');
  await page.waitForSelector('.sheet [data-action="role"]');
  await page.click('.sheet [data-action="role"]');
  await page.waitForSelector('.sheet .speech');
  await settle();
  const corner = (await text('.sheet .speech')) ?? '';
  check('corner cell counts fewer cells', /[235]칸/.test(corner) && !corner.includes('8칸'), corner);
  await noSideScroll('role sheet');
  await shot('05c-role-corner');
  await page.click('.sheet .btn.wide');
  await page.waitForSelector('.overlay', { hidden: true });

  // 5d. 동작 줄이기 설정이면 조사해도 카드 뒤집기 연출이 없다
  const calm = [1, 2, 3, 5, 6, 7].find((i) => !bossCells.includes(i));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await tapCell(calm, 'investigate');
  const calmAnims = await page.$eval(`.cell[data-cell="${calm}"]`, (e) => e.getAnimations({ subtree: true }).length);
  check('reduced motion: no flip animation on investigate', calmAnims === 0, `${calmAnims} animations`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // 6. 주범 칸들을 조사 후 체포
  for (const [k, i] of bossCells.entries()) {
    await tapCell(i, 'investigate');
    if (k === 0) check('investigate plays the flip', await page.$eval(`.cell[data-cell="${i}"]`, (e) => e.classList.contains('fx-reveal')));
    await tapCell(i, 'arrest');
    if (k === 0) {
      check(`arrested cell ${i + 1} stamped 주범 체포`, (await text(`.cell[data-cell="${i}"] .stamp`)) === '주범 체포', await text(`.cell[data-cell="${i}"] .stamp`));
      check(`arrested cell ${i + 1} names its side`, ((await text(`.cell[data-cell="${i}"] .sub`)) ?? '').includes('악'), await text(`.cell[data-cell="${i}"] .sub`));
      await shot('06-arrested');
    }
  }

  // 7. 결과 화면
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('result: 해결', (await text('[data-result]')) === '해결');
  check('result: verdict is a stamp', await page.$eval('[data-result]', (e) => e.classList.contains('stamp-ink')));
  const steps = await page.$$eval('.steps li', (ls) => ls.map((l) => l.textContent));
  check('result: explanation lines', steps.length >= 1, `${steps.length} lines, first: ${steps[0]}`);
  await noSideScroll('result');
  await shot('07-result', true);
  await noSlop('result');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  check('save: stage 1 cleared', save?.cleared?.includes(1));

  // 8. 목록에서 2가 열렸는지
  await page.click('.result-actions .btn.ghost');
  await page.waitForSelector('.stage[data-stage="2"]');
  check('stage 2 unlocked', !(await page.$eval('.stage[data-stage="2"]', (e) => e.disabled)));

  // 8-1. 푼 순간 기록: 2스테이지 악을 모두 체포하고 결과 화면 타이머(900 ms) 전에 나가도 해결로 남는다
  await page.click('.stage[data-stage="2"]');
  await caseOpened();
  const s2 = stages[1];
  for (const i of bossOf(s2.def)) await tapCell(i, 'arrest');
  await page.click('.back');
  await page.waitForSelector('.stage[data-stage="2"]');
  const save2 = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  check('stage 2: clear recorded when quitting before the result screen', save2?.cleared?.includes(2), JSON.stringify(save2?.cleared));
  await new Promise((r) => setTimeout(r, 1200));
  check('stage 2: no result screen pulled in after quitting', !(await page.$('[data-result]')));

  // 9. 가장 큰 판(30스테이지, 4×5) 배치와 카드
  await page.evaluate(() =>
    localStorage.setItem(
      'village-case-save',
      JSON.stringify({ v: 2, cleared: Array.from({ length: 29 }, (_, i) => i + 1), seenCards: [], endlessBest: 0 }),
    ),
  );
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-action="stages"]');
  await page.waitForSelector('.stage[data-stage="30"]:not([disabled])');
  await page.click('.stage[data-stage="30"]');
  await page.waitForSelector('.card-box');
  await settle();
  await shot('08-card');
  await noSlop('new role card');
  let cardPhoto = false;
  let cards = 0;
  while (await page.$('.card-box')) {
    if (!cardPhoto) cardPhoto = !!(await page.$('.card-box .photo'));
    await page.click('[data-action="card-ok"]');
    cards++;
  }
  check('stage 30: cards shown one by one', cards >= 1, `${cards} cards`);
  check('stage 30: first role card shows its photo', cardPhoto);
  await closeRoster();
  check('stage 30: grid has 20 cells', (await page.$$('.cell')).length === 20);
  const g30 = await (await page.$('.grid')).boundingBox();
  check('stage 30: grid fits width', g30.x >= 0 && g30.x + g30.width <= W, `x ${g30.x} w ${g30.width}`);
  await noSideScroll('stage 30');
  // 직업이 많은 사건: 위 메모가 줄을 넘겨 다 보이고 화면 폭 안에 있다
  const memo30 = await page.$eval('[data-stat="bosses"]', (e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, x: r.x, right: r.right, cut: e.scrollWidth > e.clientWidth + 1, lines: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight || '20')) }; });
  check('stage 30: header memo lists every role, wrapped inside the width', memo30.t.split(' · ').length >= 5 && memo30.t.split(' · ').every((x) => !x.includes(' ')) /* 직업과 수 사이는 줄바꿈 없는 공백 */ && memo30.x >= 0 && memo30.right <= W && !memo30.cut, JSON.stringify(memo30));
  await shot('09-stage30', true);
  await noSlop('stage 30');

  // 10. 종지기(시각 계기)와 기자(능력)가 다 있는 스테이지(가장 뒤 것): 끝까지 풀고 능력이 든 해설
  const sB = [...stages].reverse().find((s) => s.def.faces.includes('bellringer') && s.def.faces.includes('reporter'));
  check('a stage has both a bellringer and a reporter face', !!sB);
  const s30 = sB;
  const n30 = s30.def.w * s30.def.h;
  if (s30.id !== 30) {
    await page.click('.back');
    await page.waitForSelector(`.stage[data-stage="${s30.id}"]`);
    await page.click(`.stage[data-stage="${s30.id}"]`);
    await caseOpened();
  }
  const line = (i) => text(`.clues li[data-line="${i}"]`);
  const bell = s30.def.faces.indexOf('bellringer');
  await tapCell(bell, 'investigate');
  check('stage 30: bellringer before 12h', (await line(bell))?.endsWith('12시간에 말함'), await line(bell));
  for (let i = 0; i < n30; i++) if (i !== bell) await tapCell(i, 'investigate');
  check('stage 30: bellringer after 12h', /위에서 \d번째 가로줄\([\d·]+번\)에 주범(이 \d명 있어요|은 없어요)\.$/.test((await line(bell)) ?? ''), await line(bell));
  // 4×5 판: 가로 스크롤 없음, 이름은 14px 이상이고 잘리지 않음, 칸 가운데를 누르면 그 칸
  await noSideScroll('stage 30 investigated');
  const faces30 = await page.$$eval('.cell .face', (ls) => ls.map((l) => ({ px: parseFloat(getComputedStyle(l).fontSize), cut: l.scrollWidth > l.clientWidth + 1 || l.scrollHeight > l.clientHeight + 1, t: l.textContent })));
  check('stage 30: names 14px or more', faces30.every((f) => f.px >= 14), faces30.map((f) => f.px).join(','));
  check('stage 30: names not clipped', faces30.every((f) => !f.cut), faces30.filter((f) => f.cut).map((f) => f.t).join(','));
  const hitOk = await page.$$eval('.cell', (cs) =>
    cs.every((c) => {
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (y < 0 || y > innerHeight) {
        window.scrollTo(0, scrollY + y - innerHeight / 2);
        const r2 = c.getBoundingClientRect();
        return document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2)?.closest('.cell') === c;
      }
      return document.elementFromPoint(x, y)?.closest('.cell') === c;
    }),
  );
  check('stage 30: tapping each card centre opens that card', hitOk);
  await page.evaluate(() => window.scrollTo(0, 0));
  // 힌트를 두 번: 겉 직업이 말썽꾼인 칸(보이는 대로 선)은 가리키지 않고, 두 번째 힌트는 다른 칸을 가리킨다
  const troubleFaces = s30.def.faces.flatMap((f, i) => (role(f).camp === 'trouble' ? [i] : []));
  const sideOk = (m) => claimOk(s30.def, m);
  const h1 = await askHint();
  const m1 = HINT_STEP.exec(h1 ?? '');
  const h2 = await askHint();
  const m2 = HINT_STEP.exec(h2 ?? '');
  check('stage 30: first hint skips visible troublemaker faces', sideOk(m1) && !troubleFaces.includes(+m1[1] - 1), `troublemakers ${troubleFaces.map((i) => i + 1)}; ${h1}`);
  check('stage 30: second hint names a different cell', sideOk(m2) && m2[1] !== m1?.[1], h2 ?? 'none');
  await shot('10-stage30-hint2');
  const rep = s30.def.faces.indexOf('reporter');
  const [a, b] = [0, 1, 2].filter((i) => i !== rep);
  await tapCell(rep, 'ability');
  await page.click(`.cell[data-cell="${a}"]`);
  await shot('10-ability-pick');
  await page.click(`.cell[data-cell="${b}"]`);
  check('stage 30: ability result in list', new RegExp(`취재해 보니 ${a + 1}번과 ${b + 1}번은 (같은|다른) 편이에요\\.$`).test((await line(rep)) ?? ''), await line(rep));
  await new Promise((r) => setTimeout(r, 2500)); // 알림이 사라진 뒤
  await shot('11-stage30-all', true);
  // 공범이 있으면 먼저 하나 잡아 자백과 도장을 본다
  const acc30 = s30.def.truth.roles.findIndex((r) => r !== '*w' && role(r).camp === 'accomplice');
  if (acc30 >= 0) {
    await tapCell(acc30, 'arrest');
    check('accomplice arrest stamped 공범 체포', (await text(`.cell[data-cell="${acc30}"] .stamp`)) === '공범 체포', await text(`.cell[data-cell="${acc30}"] .stamp`));
    check('accomplice arrest adds a confession line', /^\d+번자백: /.test((await text('.ln-confession')) ?? ''), await text('.ln-confession'));
  }
  for (const i of bossOf(s30.def)) await tapCell(i, 'arrest');
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('stage 30: solved with ability facts listed', (await text('[data-result]')) === '해결' && (await page.$$('.abilities li')).length === s30.abilities.length);
  await shot('12-stage30-result', true);

  // 11. 무한 모드: 시작 → 사건(5초 안) → 진짜 악을 모두 체포 → 다음 사건 n = 2
  const evilOf = bossOf; // 주범만 잡으면 된다
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await shot('13-title');
  const t0 = Date.now();
  await page.click('[data-action="endless-new"]');
  await caseOpened();
  check('endless: case appears within 5 s', true, `${Date.now() - t0} ms`);
  check('endless: title says 1st case', /1번째 사건/.test((await text('.case-title')) ?? ''), await text('.case-title'));
  const seed1 = await text('.seed-line');
  check('endless: seed shown', /^시드 1-\d+$/.test(seed1 ?? ''), seed1 ?? 'none');
  await shot('14-endless-1');
  const def1 = await page.evaluate(() => window.__game?.def);
  check('endless: window.__game exposed in dev', !!def1);
  for (const i of evilOf(def1)) await tapCell(i, 'arrest');
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('endless: case 1 solved', (await text('[data-result]')) === '해결');
  await page.waitForSelector('.steps li', { timeout: 30000 }); // 해설은 worker 에서 늦게 온다
  check('endless: explanation arrives', (await page.$$('.steps li')).length >= 1);
  await shot('15-endless-result', true);
  const save11 = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  check('endless: save has n = 2, rep 10, best 1', save11.endless?.n === 2 && save11.endless?.rep === 10 && save11.endlessBest === 1, JSON.stringify(save11.endless));
  await page.click('[data-action="next"]');
  await caseOpened();
  check('endless: next case is the 2nd', /2번째 사건/.test((await text('.case-title')) ?? ''), await text('.case-title'));
  const seed2 = await text('.seed-line');
  const def2 = await page.evaluate(() => window.__game?.def);
  check('endless: next case has a different seed', seed2 !== seed1, `${seed1} -> ${seed2}`);

  // 12. 무한 모드 힌트는 평판 1 (힌트가 나왔을 때)
  check('endless: rep 10 before hint', (await text('[data-stat="rep"]')) === '10');
  await page.click('[data-action="hint"]');
  await page.waitForSelector('[data-hint="result"]', { timeout: 15000 });
  check('endless: hint costs 1 rep', (await text('[data-stat="rep"]')) === '9', await text('[data-stat="rep"]'));
  await shot('16-endless-hint');
  const hintAgain = await askHint(); // 관찰이 그대로라 같은 힌트: 평판을 다시 쓰지 않는다
  check('endless: repeated hint is free', (await text('[data-stat="rep"]')) === '9', `rep ${await text('[data-stat="rep"]')}; ${hintAgain}`);

  // 13. 이어 하기: 나갔다 돌아오면 같은 사건(같은 시드)
  await page.click('.back');
  await page.waitForSelector('[data-action="endless-resume"]');
  await page.click('[data-action="endless-resume"]');
  await caseOpened();
  check('endless: resume gives the same case', (await text('.seed-line')) === seed2 && /2번째 사건/.test((await text('.case-title')) ?? ''), await text('.seed-line'));
  check('endless: resume keeps the reduced rep', (await text('[data-stat="rep"]')) === '9', await text('[data-stat="rep"]'));
  // 선을 체포하면 '오인 체포' 도장
  const defR = await page.evaluate(() => window.__game?.def);
  const good = defR.truth.roles.findIndex((r) => r === '*w' || !isEvil(role(r).camp));
  await tapCell(good, 'arrest');
  check('endless: wrongly arrested good cell stamped 오인 체포', (await text(`.cell[data-cell="${good}"] .stamp`)) === '오인 체포', await text(`.cell[data-cell="${good}"] .stamp`));

  // 14. 도감 / 규칙
  await page.click('.back');
  await page.waitForSelector('[data-action="codex"]');
  await page.click('[data-action="codex"]');
  await page.waitForSelector('.codex-item');
  const known = (await page.$$('.codex-item:not(.unknown)')).length;
  const unknown = (await page.$$('.codex-item.unknown')).length;
  check('codex: met roles shown, others hidden as ?', known >= 1 && unknown >= 1 && known + unknown === Object.keys(ROLES).length, `${known} met, ${unknown} unknown`);
  check('codex: titled 인물 카드철', (await text('.codex-screen h1')) === '인물 카드철');
  check('codex: met roles have photos, unknown do not', (await page.$$('.codex-item:not(.unknown) .photo')).length === known && (await page.$$('.codex-item.unknown .photo')).length === 0);
  check('codex: unknown shows only ?', (await page.$$eval('.codex-item.unknown', (ls) => ls.every((l) => l.querySelector('b').textContent === '?'))));
  await noSideScroll('codex');
  await shot('17-codex', true);
  await noSlop('codex');
  await page.click('.back');
  await page.click('[data-action="rules"]');
  await page.waitForSelector('.concept');
  check('rules: 6 concept cards', (await page.$$('.concept')).length === 6);
  check('rules: titled 수사 규칙', (await text('.rules-screen h1')) === '수사 규칙');
  await noSideScroll('rules');
  await shot('18-rules', true);
  await noSlop('rules');
  await page.click('.back');

  // 15. 시드로 하기: 잘못된 입력은 막고, 숫자는 그 사건 한 판 (무한 모드 기록은 그대로)
  const before15 = await page.evaluate(() => localStorage.getItem('village-case-save'));
  await page.type('.seed-input', '12x');
  await page.click('[data-action="seed-play"]');
  check('seed play: rejects bad input', ((await text('[data-seed-msg]')) ?? '').length > 0 && !(await page.$('.case-screen')));
  await page.$eval('.seed-input', (e) => (e.value = ''));
  await page.type('.seed-input', '4242');
  await page.click('[data-action="seed-play"]');
  await caseOpened();
  check('seed play: plain integer shows its code', (await text('.seed-line')) === '시드 10-4242', await text('.seed-line'));
  await shot('19-seed-case');
  const def15 = await page.evaluate(() => window.__game?.def);
  check('seed play: 3x4 grid or larger (endlessParams(10))', def15.w * def15.h >= 12, `${def15.w}x${def15.h}`);
  // 쓸모없어진 힌트: 힌트를 누르고 곧바로 조사하면 그 힌트는 버려지고(돌고 있으면 worker 를 새로 띄운다),
  // 다음 힌트와 아래의 사건 만들기가 그대로 된다
  await page.click('[data-action="hint"]');
  await tapCell(0, 'investigate');
  const staleShown = await page.$('[data-hint]');
  const fresh15 = await askHint();
  check('seed play: stale hint dropped, next hint answers', !staleShown && /조사해 보세요|번은 (선|악|주범|공범)|능력을 써 보세요/.test(fresh15 ?? ''), fresh15 ?? 'none');
  // 사건 코드: 무한 2번째 사건의 코드를 넣으면 같은 사건이 나온다
  await page.click('.back');
  await page.waitForSelector('.seed-input');
  await page.type('.seed-input', seed2.replace('시드 ', ''));
  await page.click('[data-action="seed-play"]');
  await caseOpened();
  const defC = await page.evaluate(() => window.__game?.def);
  check('seed play: endless code replays the same case', JSON.stringify(defC.faces) === JSON.stringify(def2.faces) && JSON.stringify(defC.truth) === JSON.stringify(def2.truth) && (await text('.seed-line')) === seed2, `${defC.w}x${defC.h}`);
  const after15 = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  const b15 = JSON.parse(before15);
  check('seed play: endless record untouched', after15.endlessBest === b15.endlessBest && JSON.stringify(after15.endless) === JSON.stringify(b15.endless));

  // 16. 무한 모드 실패: 평판 0 이 되는 순간 저장이 정리돼, 결과 화면 전에 나가도 이어 할 판이 남지 않는다
  await page.click('.back');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-action="endless-new"]');
  await caseOpened();
  const defF = await page.evaluate(() => window.__game?.def);
  const goods = defF.truth.roles.flatMap((r, i) => (r === '*w' || !isEvil(role(r).camp) ? [i] : []));
  for (let k = 0; k < 5; k++) await tapCell(goods[k], 'arrest'); // 선 체포 -2 씩, 5번이면 평판 0
  await page.click('.back'); // 900 ms 타이머 전에 나간다
  await page.waitForSelector('[data-action="endless-new"]');
  const saveF = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  check('endless fail: no resumable run after quitting at once', !(await page.$('[data-action="endless-resume"]')) && saveF.endless === undefined, JSON.stringify(saveF.endless));
  check('endless fail: endlessBest updated (0 solved)', saveF.endlessBest === 0, String(saveF.endlessBest));
  await new Promise((r) => setTimeout(r, 1500));
  check('endless fail: no result screen pulled in after quitting', !(await page.$('[data-result]')));
  // 실패 결과는 '미해결' 도장
  await page.click('[data-action="endless-new"]');
  await caseOpened();
  const defF2 = await page.evaluate(() => window.__game?.def);
  const goods2 = defF2.truth.roles.flatMap((r, i) => (r === '*w' || !isEvil(role(r).camp) ? [i] : []));
  for (let k = 0; k < 5; k++) await tapCell(goods2[k], 'arrest');
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('endless fail: result stamped 미해결', (await text('[data-result]')) === '미해결', await text('[data-result]'));
  await shot('20-endless-failed', true);

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('run', false, e.stack ?? String(e));
} finally {
  await browser?.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks OK');
process.exit(failures ? 1 : 0);
