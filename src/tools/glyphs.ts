// 화면에 나올 수 있는 글자 모으기. 글꼴 부분 집합(make-fonts.ts)과 그 시험(glyphs.test.ts)이 같이 쓴다.
// src 아래 ts·json·html 의 모든 글자(주석 포함, 단순하게) + 인쇄 가능한 ASCII. 시험 파일과 tools 는 뺀다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** srcRoot(src 폴더) 아래에서 화면에 나올 수 있는 글자들. 중복 없이 코드 포인트 순. */
export function displayGlyphs(srcRoot: string): string {
  const set = new Set<string>();
  for (let c = 0x21; c <= 0x7e; c++) set.add(String.fromCharCode(c));
  for (const p of files(srcRoot)) {
    const rel = relative(srcRoot, p).split(sep).join('/');
    if (!/\.(ts|json|html)$/.test(rel) || rel.endsWith('.test.ts') || rel.startsWith('tools/') || rel.startsWith('public/')) continue;
    for (const ch of readFileSync(p, 'utf8')) if (!/\s/.test(ch)) set.add(ch);
  }
  return [...set].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join('');
}
