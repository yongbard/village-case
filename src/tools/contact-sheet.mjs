// 인물 사진 대조표: 20장을 진영별로 늘어놓아 한 장의 그림으로 찍는다.
// node src/tools/contact-sheet.mjs → logs/portraits.png (110px 카드) 와 logs/portraits-small.png (60px, 작은 판에서 구별되는지)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.chdir(ROOT);
mkdirSync(join(ROOT, 'logs'), { recursive: true });

const server = await createServer({ configFile: join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { middlewareMode: true } });
let browser;
try {
  const { PORTRAITS } = await server.ssrLoadModule('/ui/portraits.ts');
  const { ROLES } = await server.ssrLoadModule('/core/roles.ts');
  const camps = [['witness', '증인'], ['trouble', '말썽꾼'], ['accomplice', '공범'], ['boss', '주범']];
  const sheet = (size) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#6f5136;padding:16px;font-family:'Malgun Gothic',sans-serif">
${camps.map(([camp, name]) => `<div style="color:#f4efe4;font-weight:700;margin:8px 0 6px">${name}</div><div style="display:flex;gap:12px;flex-wrap:wrap">
${Object.values(ROLES).filter((r) => r.camp === camp).map((r) => `<div style="background:#f4efe4;padding:4px 4px 3px;width:${size}px;text-align:center;font-size:${size > 80 ? 13 : 10}px;box-shadow:0 3px 6px #0007">
<div style="background:${PORTRAITS[r.id].bg};aspect-ratio:1/1"><svg viewBox="0 0 60 60" style="width:100%;height:100%;display:block">${PORTRAITS[r.id].art}</svg></div>${r.name}</div>`).join('')}</div>`).join('')}</body>`;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  for (const [size, file] of [[110, 'portraits.png'], [60, 'portraits-small.png']]) {
    await page.setViewport({ width: size > 80 ? 1080 : 640, height: 400, deviceScaleFactor: 2 });
    await page.setContent(sheet(size));
    await page.screenshot({ path: join(ROOT, 'logs', file), fullPage: true });
    console.log(`logs/${file}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
