// 사건 화면 미리 보기: 무한 모드 n 번째 사건을 열어 인원표·진술 표시·빨간 실·자백을 찍는다.
// node src/tools/peek-case.mjs [n] → logs/peek/*.png
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = join(ROOT, 'logs', 'peek');
const N = Number(process.argv[2] ?? 14);
process.chdir(ROOT);
mkdirSync(OUT, { recursive: true });

const server = await createServer({ configFile: join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { host: '127.0.0.1', port: 5198 } });
let browser;
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate((n) => localStorage.setItem('village-case-save', JSON.stringify({ v: 2, cleared: [], seenCards: [], endlessBest: 0, endless: { n, rep: 10, seed: 4242 } })), N);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-action="endless-resume"]');
  await page.waitForSelector('[data-sheet="roster"]', { timeout: 20000 });
  const settle = () => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await settle();
  await page.screenshot({ path: join(OUT, '1-roster.png') });
  await page.click('[data-action="roster-close"]');
  await page.waitForSelector('.overlay', { hidden: true });
  const def = await page.evaluate(() => window.__game.def);
  const n = def.w * def.h;
  for (let i = 0; i < n; i++) {
    await page.$eval(`.cell[data-cell="${i}"]`, (e) => e.click());
    await page.waitForSelector('.sheet [data-action="investigate"]');
    await page.click('.sheet [data-action="investigate"]');
    await page.waitForSelector('.overlay', { hidden: true });
    await settle();
  }
  // 관계 진술이 있으면 그 줄을, 없으면 첫 줄을 누른다
  const rel = def.clues.findIndex((c) => c && (c.kind === 'sameSide' || c.kind === 'pairOne'));
  const line = rel >= 0 ? rel : def.clues.findIndex((c) => c);
  await page.$eval(`[data-mark="${line}"]`, (e) => e.click());
  await settle();
  const marks = await page.$$eval('.cell.mark', (es) => es.length);
  const strings = await page.$$eval('.red-string', (es) => es.length);
  await page.screenshot({ path: join(OUT, '2-marks.png'), fullPage: true });
  // 공범 하나 체포 → 자백
  const acc = def.truth.roles.findIndex((r) => ['lookout', 'thief', 'shill', 'blackmailer', 'decoy'].includes(r));
  let confession = null;
  if (acc >= 0) {
    await page.$eval(`.cell[data-cell="${acc}"]`, (e) => e.click());
    await page.waitForSelector('.sheet [data-action="arrest"]');
    await page.click('.sheet [data-action="arrest"]');
    await page.waitForSelector('.ln-confession');
    await settle();
    confession = await page.$eval('.ln-confession', (e) => e.textContent);
    await page.screenshot({ path: join(OUT, '3-confession.png'), fullPage: true });
  }
  console.log(JSON.stringify({ size: `${def.w}x${def.h}`, line: line + 1, kind: def.clues[line]?.kind, marks, strings, acc, confession, errors }));
} finally {
  await browser?.close();
  await server.close();
}
