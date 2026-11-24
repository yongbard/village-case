// 글꼴 부분 집합 만들기 (npm run fonts). 원본 TTF 를 google/fonts 에서 data/fonts-src/ 에 내려받고(있으면 건너뜀),
// 화면에 나올 수 있는 글자(glyphs.ts)만 남긴 woff2 를 src/public/fonts/ 에 쓴다. 문구가 바뀌면 다시 돌린다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { renameFamily } from './fontName';
import { displayGlyphs } from './glyphs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const RAW = join(ROOT, 'data', 'fonts-src');
const OUT = join(SRC, 'public', 'fonts');
const BASE = 'https://github.com/google/fonts/raw/main/ofl';

// rename: OFL 예약 글꼴 이름이 있는 글꼴은 부분 집합(수정본)을 이 이름으로 바꿔 낸다 (나눔손글씨 펜 → Village Hand)
const FONTS: { src: string; out: string; rename?: string }[] = [
  { src: 'songmyung/SongMyung-Regular.ttf', out: 'song-myung.woff2' },
  { src: 'gowunbatang/GowunBatang-Regular.ttf', out: 'gowun-batang-400.woff2' },
  { src: 'gowunbatang/GowunBatang-Bold.ttf', out: 'gowun-batang-700.woff2' },
  { src: 'nanumpenscript/NanumPenScript-Regular.ttf', out: 'hand-pen.woff2', rename: 'Village Hand' },
];

async function fetchOnce(path: string): Promise<string> {
  const file = join(RAW, path.replace('/', '_'));
  if (!existsSync(file)) {
    const res = await fetch(`${BASE}/${path}`);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
  }
  return file;
}

mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
const glyphs = displayGlyphs(SRC);
let total = 0;
for (const f of FONTS) {
  const raw = new Uint8Array(readFileSync(await fetchOnce(f.src)));
  const out = await subsetFont(Buffer.from(f.rename ? renameFamily(raw, f.rename) : raw), glyphs, { targetFormat: 'woff2' });
  writeFileSync(join(OUT, f.out), out);
  total += out.length;
  console.log(`${f.out}  ${(out.length / 1024).toFixed(1)} KB`);
}
writeFileSync(join(OUT, 'glyphs.txt'), glyphs);
// 글꼴마다 저작권 줄이 달라 세 라이선스를 이어 붙인다
const licenses: string[] = [];
for (const dir of ['songmyung', 'gowunbatang', 'nanumpenscript']) {
  licenses.push(`==== ${dir} ====\n${readFileSync(await fetchOnce(`${dir}/OFL.txt`), 'utf8')}`);
}
writeFileSync(join(OUT, 'OFL.txt'), licenses.join('\n\n'));
console.log(`합계 ${(total / 1024).toFixed(1)} KB, 글자 ${[...glyphs].length}개`);
