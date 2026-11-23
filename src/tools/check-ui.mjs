// 화면 확인: dev 서버를 띄우고 설치된 Chrome(390×844)으로 1스테이지를 끝까지 푼다.
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
  const { isEvil, role } = await server.ssrLoadModule('/core/roles.ts');
  const { GUIDE } = await server.ssrLoadModule('/content/tutorial.ts');
  const stages = JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'stages.json'), 'utf8'));
  const s1 = stages[0];
  const evilCells = s1.def.truth.roles.flatMap((r, i) => (r !== '*w' && isEvil(role(r).camp) ? [i] : []));

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // 실패한 요청은 주소로 적는다 (콘솔 문구에는 주소가 없다). 브라우저가 알아서 찾는 favicon 은 뺀다.
  page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`${r.status()} ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

  const shot = (name, fullPage = false) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage });
  const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
  const noSideScroll = async (where) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${where}: no horizontal scroll`, sw <= W, `scrollWidth ${sw}`);
  };
  // 창이 뜨는 움직임이 끝날 때까지 (스크린샷용)
  const settle = () => page.evaluate(() => Promise.all([...document.querySelectorAll('.overlay, .overlay > *')].flatMap((e) => e.getAnimations()).map((a) => a.finished)));
  const tapCell = async (i, action) => {
    await page.click(`.cell[data-cell="${i}"]`);
    await page.waitForSelector(`.sheet [data-action="${action}"]`, { timeout: 3000 });
    await page.click(`.sheet [data-action="${action}"]`);
    await page.waitForSelector('.overlay', { hidden: true, timeout: 3000 });
  };

  // 1. 타이틀
  await page.goto(url, { waitUntil: 'networkidle0' });
  check('title screen', (await text('.game-title')) === '마을 수사록');
  check('document title / lang', (await page.title()) === '마을 수사록' && (await page.$eval('html', (e) => e.lang)) === 'ko');
  await shot('01-title');

  // 2. 스테이지 목록
  await page.click('[data-action="stages"]');
  await page.waitForSelector('.stage[data-stage="1"]');
  const locked = await page.$eval('.stage[data-stage="2"]', (e) => e.disabled);
  check('stage list: 1 open, 2 locked', !(await page.$eval('.stage[data-stage="1"]', (e) => e.disabled)) && locked);
  await noSideScroll('stage list');
  await shot('02-stages', true);

  // 3. 스테이지 1 + 첫 안내 말풍선
  await page.click('.stage[data-stage="1"]');
  await page.waitForSelector('.guide-bubble');
  const bubble = await text('.guide-bubble .bubble-text');
  check('stage 1: first GUIDE bubble visible', bubble === GUIDE[1][0].text, bubble ?? 'none');
  check('stage 1: grid has 9 cells', (await page.$$('.cell')).length === 9);
  const gridBox = await (await page.$('.grid')).boundingBox();
  check('grid fills the width', gridBox.width >= W - 40 && gridBox.x + gridBox.width <= W, `x ${gridBox.x} w ${gridBox.width}`);
  await noSideScroll('case screen');
  await shot('03-case-guide');

  // 4. 힌트 (worker) — 아무것도 조사하지 않았으니 조사할 칸을 알려 준다
  await page.click('[data-action="hint"]');
  await page.waitForSelector('[data-hint="result"]', { timeout: 15000 });
  const hintText = await text('[data-hint="result"] .bubble-text');
  check('hint answers from worker', /조사해 보세요|번은 (선|악)/.test(hintText ?? ''), hintText ?? 'none');
  await shot('04-hint');

  // 5. 메모: 가운데 칸 조사 후 선 메모
  await page.click('[data-action="guide-next"]');
  await tapCell(4, 'investigate');
  await page.click('.cell[data-cell="4"]');
  await page.waitForSelector('.sheet [data-note="good"]');
  await settle();
  await shot('05-menu');
  await page.click('.sheet [data-note="good"]');
  await page.waitForSelector('.cell[data-cell="4"] .note-good');
  check('memo mark shows in cell corner', true);
  check('investigate costs 2 hours', (await text('[data-stat="hour"]')) === '2시간');
  check('clue line in list', /^5번\s*약사: 둘레 8칸에 악이 2명$/.test((await text('.clues li[data-line="4"]')) ?? ''), await text('.clues li[data-line="4"]'));

  // 6. 악 칸들을 조사 후 체포
  for (const [k, i] of evilCells.entries()) {
    await tapCell(i, 'investigate');
    await tapCell(i, 'arrest');
    if (k === 0) {
      check(`arrested cell ${i + 1} shows camp label`, (await text(`.cell[data-cell="${i}"] .stamp`)) === '● 악');
      await shot('06-arrested');
    }
  }

  // 7. 결과 화면
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('result: 해결', (await text('[data-result]')) === '해결');
  const steps = await page.$$eval('.steps li', (ls) => ls.map((l) => l.textContent));
  check('result: explanation lines', steps.length >= 1, `${steps.length} lines, first: ${steps[0]}`);
  await noSideScroll('result');
  await shot('07-result', true);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  check('save: stage 1 cleared', save?.cleared?.includes(1));

  // 8. 목록에서 2가 열렸는지
  await page.click('.result-actions .btn.ghost');
  await page.waitForSelector('.stage[data-stage="2"]');
  check('stage 2 unlocked', !(await page.$eval('.stage[data-stage="2"]', (e) => e.disabled)));

  // 9. 가장 큰 판(30스테이지, 4×5) 배치와 카드
  await page.evaluate(() =>
    localStorage.setItem(
      'village-case-save',
      JSON.stringify({ v: 1, cleared: Array.from({ length: 29 }, (_, i) => i + 1), seenCards: [], endlessBest: 0 }),
    ),
  );
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-action="stages"]');
  await page.waitForSelector('.stage[data-stage="30"]:not([disabled])');
  await page.click('.stage[data-stage="30"]');
  await page.waitForSelector('.card-box');
  await settle();
  await shot('08-card');
  let cards = 0;
  while (await page.$('.card-box')) {
    await page.click('[data-action="card-ok"]');
    cards++;
  }
  check('stage 30: cards shown one by one', cards >= 1, `${cards} cards`);
  check('stage 30: grid has 20 cells', (await page.$$('.cell')).length === 20);
  const g30 = await (await page.$('.grid')).boundingBox();
  check('stage 30: grid fits width', g30.x >= 0 && g30.x + g30.width <= W, `x ${g30.x} w ${g30.width}`);
  await noSideScroll('stage 30');
  await shot('09-stage30', true);

  // 10. 30스테이지: 시각 계기(종지기), 능력(기자), 끝까지 풀고 능력이 든 해설
  const s30 = stages[29];
  const line = (i) => text(`.clues li[data-line="${i}"]`);
  const bell = s30.def.faces.indexOf('bellringer');
  await tapCell(bell, 'investigate');
  check('stage 30: bellringer before 12h', (await line(bell))?.endsWith('12시간에 말함'), await line(bell));
  for (let i = 0; i < 20; i++) if (i !== bell) await tapCell(i, 'investigate');
  check('stage 30: bellringer after 12h', /주범은 \d번째 가로줄에 있다$/.test((await line(bell)) ?? ''), await line(bell));
  const rep = s30.def.faces.indexOf('reporter');
  const [a, b] = [0, 1, 2].filter((i) => i !== rep);
  await tapCell(rep, 'ability');
  await page.click(`.cell[data-cell="${a}"]`);
  await shot('10-ability-pick');
  await page.click(`.cell[data-cell="${b}"]`);
  check('stage 30: ability result in list', new RegExp(`${a + 1}번과 ${b + 1}번은 (같은|다른) 편$`).test((await line(rep)) ?? ''), await line(rep));
  await new Promise((r) => setTimeout(r, 2500)); // 알림이 사라진 뒤
  await shot('11-stage30-all', true);
  const evil30 = s30.def.truth.roles.flatMap((r, i) => (r !== '*w' && isEvil(role(r).camp) ? [i] : []));
  for (const i of evil30) await tapCell(i, 'arrest');
  await page.waitForSelector('[data-result]', { timeout: 5000 });
  check('stage 30: solved with ability facts listed', (await text('[data-result]')) === '해결' && (await page.$$('.abilities li')).length === s30.abilities.length);
  await shot('12-stage30-result', true);

  // 11. 무한 모드: 시작 → 사건(5초 안) → 진짜 악을 모두 체포 → 다음 사건 n = 2
  const evilOf = (def) => def.truth.roles.flatMap((r, i) => (r !== '*w' && isEvil(role(r).camp) ? [i] : []));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await shot('13-title');
  const t0 = Date.now();
  await page.click('[data-action="endless-new"]');
  await page.waitForSelector('.case-screen .grid', { timeout: 5000 });
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
  await page.waitForSelector('.case-screen .grid', { timeout: 5000 });
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

  // 13. 이어 하기: 나갔다 돌아오면 같은 사건(같은 시드)
  await page.click('.back');
  await page.waitForSelector('[data-action="endless-resume"]');
  await page.click('[data-action="endless-resume"]');
  await page.waitForSelector('.case-screen .grid', { timeout: 5000 });
  check('endless: resume gives the same case', (await text('.seed-line')) === seed2 && /2번째 사건/.test((await text('.case-title')) ?? ''), await text('.seed-line'));
  check('endless: resume keeps the reduced rep', (await text('[data-stat="rep"]')) === '9', await text('[data-stat="rep"]'));

  // 14. 도감 / 규칙
  await page.click('.back');
  await page.waitForSelector('[data-action="codex"]');
  await page.click('[data-action="codex"]');
  await page.waitForSelector('.codex-item');
  const known = (await page.$$('.codex-item:not(.unknown)')).length;
  const unknown = (await page.$$('.codex-item.unknown')).length;
  check('codex: met roles shown, others hidden as ?', known >= 1 && unknown >= 1 && known + unknown === 20, `${known} met, ${unknown} unknown`);
  check('codex: unknown shows only ?', (await page.$$eval('.codex-item.unknown', (ls) => ls.every((l) => l.querySelector('b').textContent === '?'))));
  await noSideScroll('codex');
  await shot('17-codex', true);
  await page.click('.back');
  await page.click('[data-action="rules"]');
  await page.waitForSelector('.concept');
  check('rules: 4 concept cards', (await page.$$('.concept')).length === 4);
  await noSideScroll('rules');
  await shot('18-rules', true);
  await page.click('.back');

  // 15. 시드로 하기: 잘못된 입력은 막고, 숫자는 그 사건 한 판 (무한 모드 기록은 그대로)
  const before15 = await page.evaluate(() => localStorage.getItem('village-case-save'));
  await page.type('.seed-input', '12x');
  await page.click('[data-action="seed-play"]');
  check('seed play: rejects bad input', ((await text('[data-seed-msg]')) ?? '').length > 0 && !(await page.$('.case-screen')));
  await page.$eval('.seed-input', (e) => (e.value = ''));
  await page.type('.seed-input', '4242');
  await page.click('[data-action="seed-play"]');
  await page.waitForSelector('.case-screen .grid', { timeout: 5000 });
  check('seed play: plain integer shows its code', (await text('.seed-line')) === '시드 10-4242', await text('.seed-line'));
  await shot('19-seed-case');
  const def15 = await page.evaluate(() => window.__game?.def);
  check('seed play: 3x4 grid or larger (endlessParams(10))', def15.w * def15.h >= 12, `${def15.w}x${def15.h}`);
  // 사건 코드: 무한 2번째 사건의 코드를 넣으면 같은 사건이 나온다
  await page.click('.back');
  await page.waitForSelector('.seed-input');
  await page.type('.seed-input', seed2.replace('시드 ', ''));
  await page.click('[data-action="seed-play"]');
  await page.waitForSelector('.case-screen .grid', { timeout: 5000 });
  const defC = await page.evaluate(() => window.__game?.def);
  check('seed play: endless code replays the same case', JSON.stringify(defC.faces) === JSON.stringify(def2.faces) && JSON.stringify(defC.truth) === JSON.stringify(def2.truth) && (await text('.seed-line')) === seed2, `${defC.w}x${defC.h}`);
  const after15 = await page.evaluate(() => JSON.parse(localStorage.getItem('village-case-save')));
  const b15 = JSON.parse(before15);
  check('seed play: endless record untouched', after15.endlessBest === b15.endlessBest && JSON.stringify(after15.endless) === JSON.stringify(b15.endless));

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('run', false, e.stack ?? String(e));
} finally {
  await browser?.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks OK');
process.exit(failures ? 1 : 0);
