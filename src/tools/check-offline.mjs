// 오프라인 확인: 빌드 결과(dist)를 띄워 한 번 열고 서비스 워커가 미리 받게 한 뒤, 서버를 끄고 다시 연다.
// 글꼴 네 가지와 타이틀·1스테이지 화면이 그대로 뜨면 OK. 먼저 npm run build.
// node src/tools/check-offline.mjs → 단계마다 OK/FAIL, 하나라도 실패하면 종료 코드 1.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.chdir(ROOT);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const server = await preview({ configFile: join(ROOT, 'vite.config.ts'), preview: { port: 4199, strictPort: false } });
let browser;
try {
  const url = server.resolvedUrls.local[0];
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // 1. 온라인으로 한 번 연다: 서비스 워커가 설치되고 미리 받기가 끝날 때까지
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload({ waitUntil: 'networkidle0' });
  check('online: service worker controls the page', await page.evaluate(() => !!navigator.serviceWorker.controller));

  // 2. 서버를 끄고 네트워크도 끊은 뒤 다시 연다
  await server.close();
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.game-title', { timeout: 10000 });
  check('offline: title screen opens', (await page.$eval('.game-title', (e) => e.textContent)) === '마을 수사록');
  for (const family of ['Song Myung', 'Village Sans', 'Village Hand', 'Village Mono']) {
    const loaded = await page.evaluate(async (f) => (await document.fonts.load(`16px "${f}"`, '마을 수사록 01')).length > 0, family);
    check(`offline: font ${family} loads from cache`, loaded);
  }
  const titleFont = await page.$eval('.game-title', (e) => getComputedStyle(e).fontFamily);
  check('offline: title uses Song Myung', titleFont.includes('Song Myung'), titleFont);
  await page.click('[data-action="stages"]');
  await page.click('.stage[data-stage="1"]');
  await page.waitForSelector('.case-screen .grid', { timeout: 10000 });
  check('offline: stage 1 opens with 9 cards', (await page.$$('.cell')).length === 9);
} catch (e) {
  check('run', false, e.stack ?? String(e));
} finally {
  await browser?.close();
  await server.close().catch(() => {});
}
console.log(failures === 0 ? '\nall offline checks OK' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
