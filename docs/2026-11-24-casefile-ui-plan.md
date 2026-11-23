# 마을 수사록 그래픽·UI(수사 서류철) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 글자뿐인 화면을 "수사 서류철" 분위기(코르크판, 핀 꽂은 증명사진, 빨간 도장, 줄 공책)로 바꾸고, 직업 20개마다 다르게 생긴 SVG 인물 사진과 글꼴 세 가지(송명·고운바탕·나눔손글씨 펜)를 넣는다. 게임 규칙은 그대로.

**Architecture:** 게임 로직(src/core)은 건드리지 않는다. 화면은 지금처럼 프레임워크 없는 DOM(src/ui/dom.ts 의 h)이고, 모습은 src/ui/style.css 를 갈아엎어 바꾼다. 인물 사진은 src/ui/portraits.ts 한 곳에서 직업 id 로 꺼내는 인라인 SVG 이다. 글꼴은 게임에 나오는 글자만 남긴 woff2 부분 집합을 한 번 만들어 src/public/fonts/ 에 넣고, PWA 미리 받기에 포함한다.

**Tech Stack:** TypeScript, Vite 5, vite-plugin-pwa, Vitest, tsx, puppeteer-core(화면 확인), subset-font(새 devDependency, 글꼴 부분 집합 woff2 생성, Node). Node 24.

**Spec:** docs/2026-11-24-casefile-ui-design.md (시안: docs/mockups/)

## Global Constraints

- src/core 와 src/content 의 게임 규칙·사건·해설·저장 형식은 바꾸지 않는다(문구 파일 tutorial.ts 의 글도 바꾸지 않는다). 시험 118개 그대로 통과.
- 화면 기준 390×844 세로, PC 는 가운데 같은 폭(#app 최대 430px). 양옆 여백 16px. 어느 화면도 가로 스크롤 없음.
- 본문 글씨 15px 이상. 칸 안 직업 이름은 3칸 판 16px, 4·5칸 판 14px 이상(지금 크기가 하한). 손글씨 글꼴은 같은 자리 다른 글씨보다 크게.
- 누르는 자리 44px 이상. 칸은 카드 전체가 누르는 자리, 기울인 카드끼리 겹치지 않는다.
- 글꼴: 제목·도장·큰 글자 = Song Myung 400, 본문·단추 = Gowun Batang 400/700, 메모·포스트잇·안내 쪽지 = Nanum Pen Script 400. 모두 SIL OFL. 실행 중에 외부 글꼴 서버를 부르지 않는다. 네 파일 합계 1MB 목표(넘으면 보고).
- 색: 코르크 #6f5136 부근(잔 점무늬), 종이 #f4efe4 ~ #fbf6ea, 마닐라지 #d8be8a 부근(빗금), 잉크 빨강 #b3261e 부근, 진한 잉크 #2a241d. 지금의 남색 강조색(--accent #2c4c7c)은 쓰지 않는다. 선·악은 색만으로 구별하지 않는다(글자를 같이).
- 인물 사진은 직접 코드로 그린 SVG(viewBox 0 0 60 60, 가슴 위 상반신, 갈색조). 외부·AI 그림 금지. 원작(Dupery) 화풍과 닮지 않게.
- 체포 전 칸은 겉 직업(def.faces[i]) 사진, 체포 후 칸은 진짜 직업 사진(직업 모르는 증인 '*w' 이면 겉 직업 사진). 악 진영 사진은 체포 전에 절대 보이지 않는다.
- prefers-reduced-motion: reduce 이면 뒤집기·도장 연출이 없다.
- check-ui 가 쓰는 data-* 속성(data-action, data-cell, data-stage, data-stat, data-result, data-hint, data-line, data-note, data-seed-msg, data-role, data-codex-count, data-explain, data-step, data-seed)과 클래스(.cell, .grid, .sheet, .overlay, .clues, .case-title, .seed-line, .game-title, .stage, .codex-item, .card-box, .guide-bubble, .abilities, .steps, .result-actions, .seed-input, .back, .concept, .stamp)는 유지한다. 바꾸면 같은 작업에서 check-ui 를 고친다.
- 작업마다 끝에: npm run typecheck, npx vitest run --maxWorkers=10, npm run build, node src/tools/check-ui.mjs 모두 통과. 로컬 PC 는 코어 절반(10개)까지만.
- 이 문서와 README·HISTORY 같은 md 에는 인라인 코드 서식과 링크 서식을 쓰지 않는다. 커밋 메시지에 JIRA 번호를 넣지 않는다. git push 는 하지 않는다(사용자 승인 필요).

## Review Focus

1. 4×5 판(스테이지 29·30, 무한 모드 큰 판)에서 칸이 좁아져 직업 이름이 잘리거나 가로 스크롤이 생긴다 → 이름은 두 줄까지 보이고 가로 스크롤 없음. (Task 4 check-ui: 스테이지 30 판)
2. 기울인 카드가 옆 카드를 덮어 누른 칸과 다른 칸이 열린다 → 모든 칸 가운데를 누르면 그 칸이 열린다. (Task 4 check-ui: elementFromPoint)
3. 나중에 문구가 바뀌어 부분 집합에 없는 글자가 생긴다 → 시험이 실패해 글꼴을 다시 만들게 한다. (Task 1 glyphs.test.ts)
4. 동작 줄이기 설정 폰에서 연출이 계속 돈다 → 조사·체포한 칸에 애니메이션이 없다. (Task 4 check-ui: emulateMediaFeatures)
5. 비행기 모드로 다시 열면 글꼴이 시스템 글꼴로 바뀐다 → 서비스 워커가 글꼴 파일을 미리 받아 두어 오프라인에서도 Gowun Batang 이 쓰인다. (Task 7 check-offline)

---

## 파일 구조

```
src/
├── public/fonts/            새로: 부분 집합 글꼴 4개(woff2), glyphs.txt(넣은 글자), OFL.txt
├── tools/
│   ├── glyphs.ts            새로: 화면에 나올 수 있는 글자 모으기 (make-fonts 와 시험이 같이 씀)
│   ├── glyphs.test.ts       새로: 지금 글자가 모두 glyphs.txt 에 있는지
│   ├── make-fonts.ts        새로: 원본 TTF 내려받기(data/fonts-src, git 제외) → woff2 부분 집합
│   ├── contact-sheet.mjs    새로: 사진 20장 대조표 → logs/portraits.png
│   ├── check-offline.mjs    새로: 빌드 결과를 띄워 오프라인에서 글꼴·화면 확인
│   └── check-ui.mjs         고침: 새 모습에 맞춘 확인 + Review Focus 확인
├── ui/
│   ├── fonts.css            새로: @font-face 4개
│   ├── portraits.ts         새로: PORTRAITS 데이터 + photo() 요소
│   ├── portraits.test.ts    새로
│   ├── style.css            고침: 서류철 테마 전체
│   ├── main.ts              고침: fonts.css 가져오기
│   ├── tutorialOverlay.ts   고침: 새 직업 카드에 사진
│   └── screens/             고침: caseScreen, title, stageList, result, codex, rules
├── index.html               고침: theme-color
vite.config.ts               고침: globPatterns 에 woff2, manifest 색
.gitignore                   고침: data/fonts-src/
```

---

### Task 1: 글꼴 부분 집합과 오프라인 포함

**Files:**
- Create: src/tools/glyphs.ts, src/tools/glyphs.test.ts, src/tools/make-fonts.ts, src/ui/fonts.css, src/public/fonts/(생성물), src/public/fonts/OFL.txt
- Modify: package.json(devDependency subset-font, 스크립트 "fonts": "tsx src/tools/make-fonts.ts"), vite.config.ts(globPatterns), src/ui/main.ts, .gitignore

**Interfaces:**
- Produces: CSS 글꼴 이름 'Song Myung', 'Gowun Batang', 'Nanum Pen Script' (fonts.css 의 font-family). 이후 작업은 이 이름만 쓴다.
- Produces: displayGlyphs(srcRoot: string): string — 정렬된 중복 없는 글자열.

- [ ] **Step 1: 실패하는 시험 작성 (src/tools/glyphs.test.ts)**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { displayGlyphs } from './glyphs';

const SRC = fileURLToPath(new URL('..', import.meta.url));

test('every displayable glyph is in the font subset (run npm run fonts if this fails)', () => {
  const have = new Set(readFileSync(join(SRC, 'public', 'fonts', 'glyphs.txt'), 'utf8'));
  const missing = [...displayGlyphs(SRC)].filter((c) => !have.has(c));
  expect(missing.join('')).toBe('');
});

test('glyph set has printable ASCII and the game title', () => {
  const g = displayGlyphs(SRC);
  for (const c of '0123456789-~·?!()마을수사록체포오인') expect(g).toContain(c);
});
```

- [ ] **Step 2: 실행해 실패 확인** — npx vitest run src/tools/glyphs.test.ts → FAIL(모듈 없음).

- [ ] **Step 3: displayGlyphs 구현 (src/tools/glyphs.ts)**

모으는 파일: src 아래 *.ts·*.json·*.html 중 *.test.ts 와 src/tools/ 아래 파일은 뺀다. 그 파일들의 모든 글자(주석도 포함, 단순하게)에 인쇄 가능한 ASCII(0x21 ~ 0x7E)를 더한다. 공백·줄바꿈 제외, 코드 포인트 순 정렬. (화면 기호 ·, ‹, ○, ●, ×, ✓ 등은 소스에 이미 있으므로 저절로 들어간다.)

- [ ] **Step 4: make-fonts 구현 (src/tools/make-fonts.ts, npm run fonts)**

원본은 google/fonts 저장소의 raw 파일을 data/fonts-src/ 에 내려받는다(있으면 다시 받지 않음):

```
https://github.com/google/fonts/raw/main/ofl/songmyung/SongMyung-Regular.ttf
https://github.com/google/fonts/raw/main/ofl/gowunbatang/GowunBatang-Regular.ttf
https://github.com/google/fonts/raw/main/ofl/gowunbatang/GowunBatang-Bold.ttf
https://github.com/google/fonts/raw/main/ofl/nanumpenscript/NanumPenScript-Regular.ttf
https://github.com/google/fonts/raw/main/ofl/gowunbatang/OFL.txt
```

subset-font 로 displayGlyphs 글자만 남겨 woff2 로 src/public/fonts/ 에 song-myung.woff2, gowun-batang-400.woff2, gowun-batang-700.woff2, nanum-pen.woff2 를 쓰고, 같은 글자열을 glyphs.txt 에, OFL.txt 를 복사한다. 끝에 파일별 크기와 합계를 출력한다. 내려받은 파일은 데이터로만 읽는다(실행하지 않음). .gitignore 에 data/fonts-src/ 추가.

- [ ] **Step 5: fonts.css 와 연결**

src/ui/fonts.css 에 @font-face 4개(font-display: swap). url 은 public 폴더 기준 절대 경로 url('/fonts/gowun-batang-400.woff2') 형태로 쓰고, main.ts 에서 import './fonts.css'. Vite 가 빌드 때 base(/village-case/)를 붙이는지 Step 7 에서 확인하고, 안 붙으면 상대 경로로 바꾼다. vite.config.ts globPatterns 를 '**/*.{html,js,css,json,png,svg,webmanifest,woff2}' 로.

- [ ] **Step 6: 실행** — npm run fonts → 파일 4개와 크기 출력. npx vitest run src/tools/glyphs.test.ts → PASS.

- [ ] **Step 7: 빌드 확인** — npm run build. 확인: dist/fonts/ 에 woff2 4개, dist/assets/*.css 안 글꼴 url 이 /village-case/fonts/ 로 시작, dist/sw.js 미리 받기 목록에 woff2 4개. 합계 크기를 보고에 적는다(1MB 넘으면 DONE_WITH_CONCERNS).

- [ ] **Step 8: 전체 확인과 커밋** — typecheck, vitest, check-ui 통과.

```bash
git add package.json package-lock.json vite.config.ts .gitignore src/tools/glyphs.ts src/tools/glyphs.test.ts src/tools/make-fonts.ts src/ui/fonts.css src/ui/main.ts src/public/fonts
git commit -m "feat: subset Song Myung, Gowun Batang, Nanum Pen Script fonts for offline use"
```

---

### Task 2: 인물 사진 20장

**Files:**
- Create: src/ui/portraits.ts, src/ui/portraits.test.ts, src/tools/contact-sheet.mjs

**Interfaces:**
- Consumes: ROLES, role() (src/core/roles.ts), ANY_WITNESS (src/core/types.ts)
- Produces:

```ts
export interface Portrait { bg: string; art: string } // bg: 사진 바탕색 #rrggbb, art: viewBox 0 0 60 60 안에 들어갈 SVG 도형 마크업
export const PORTRAITS: Record<RoleId, Portrait>;
export const FALLBACK: Portrait;                       // 이름 없는 실루엣
export function portraitOf(id: RoleId): Portrait;      // 없으면 FALLBACK
export function photo(id: RoleId, cls?: string): HTMLElement;
// <span class="photo {cls}" style="background:{bg}"><svg viewBox="0 0 60 60" aria-hidden="true">{art}</svg></span>
```

- [ ] **Step 1: 실패하는 시험 (src/ui/portraits.test.ts)**

```ts
import { expect, test } from 'vitest';
import { ROLES, isEvil } from '../core/roles';
import { ANY_WITNESS } from '../core/types';
import { FALLBACK, PORTRAITS, portraitOf } from './portraits';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

test('every role has its own portrait', () => {
  for (const id of Object.keys(ROLES)) expect(PORTRAITS[id], id).toBeDefined();
  const arts = Object.keys(ROLES).map((id) => PORTRAITS[id].art);
  expect(new Set(arts).size).toBe(arts.length);
  const bgs = Object.keys(ROLES).map((id) => PORTRAITS[id].bg);
  expect(new Set(bgs).size).toBeGreaterThanOrEqual(12);
});

test('portrait markup is plain shapes on a 60x60 box', () => {
  for (const p of [...Object.values(PORTRAITS), FALLBACK]) {
    expect(p.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.art).toMatch(/<(path|circle|ellipse|rect)\b/);
    expect(p.art).not.toMatch(/<svg|<script|<image|href=|on\w+=/i);
  }
});

test('evil portraits sit on darker backgrounds on average', () => {
  const ids = Object.keys(ROLES);
  const avg = (xs: string[]) => xs.reduce((a, id) => a + lum(PORTRAITS[id].bg), 0) / xs.length;
  const evil = ids.filter((id) => isEvil(ROLES[id].camp));
  const witness = ids.filter((id) => ROLES[id].camp === 'witness');
  expect(avg(evil)).toBeLessThan(avg(witness) * 0.85);
});

test('unknown ids and the any-witness fall back to the silhouette', () => {
  expect(portraitOf(ANY_WITNESS)).toBe(FALLBACK);
  expect(portraitOf('nope')).toBe(FALLBACK);
});
```

- [ ] **Step 2: 실행해 실패 확인** — npx vitest run src/ui/portraits.test.ts → FAIL.

- [ ] **Step 3: PORTRAITS 작성**

증인 8명은 docs/mockups/2026-11-24-portraits-fonts.html 의 SVG 도형과 바탕색을 그대로 옮긴다(사용자가 확인함). 나머지 12명은 설계 7장의 방향대로 새로 그린다. 공통 틀: 피부 #c9b291 계열, 갈색조, 가슴 위 상반신, 소품은 실루엣 밖으로 튀어나오게 해 작은 크기에서도 구별되게. 직업마다 머리 윤곽(모자·머리 모양)이 서로 다른 것이 가장 중요하다. 악 진영 8명의 바탕은 증인보다 어둡게(시험 3).

- [ ] **Step 4: photo() 구현** — h 로 span 을 만들고 svg 는 innerHTML 로 넣는다(데이터는 이 파일의 상수뿐이라 안전).

- [ ] **Step 5: 시험 통과** — npx vitest run src/ui/portraits.test.ts → PASS.

- [ ] **Step 6: 대조표 도구 (src/tools/contact-sheet.mjs)**

vite createServer(check-ui 와 같은 방식)로 /ui/portraits.ts 를 ssrLoadModule 해 PORTRAITS 를 읽고, 진영별 4줄(증인 8, 말썽꾼 4, 공범 5, 주범 3)로 사진 카드(110px, 아래 직업 이름)를 늘어놓은 HTML 을 puppeteer 로 찍어 logs/portraits.png 에 쓴다. 실행: node src/tools/contact-sheet.mjs.

- [ ] **Step 7: 대조표를 보고 스스로 점검** — logs/portraits.png 를 열어, 크기를 60px 로 줄여도 20장이 머리 윤곽만으로 구별되는지 본다. 비슷한 쌍이 있으면 고친다. 보고에 대조표 경로를 적는다(컨트롤러가 사용자에게 보낸다).

- [ ] **Step 8: 전체 확인과 커밋**

```bash
git add src/ui/portraits.ts src/ui/portraits.test.ts src/tools/contact-sheet.mjs
git commit -m "feat: 20 hand-drawn SVG suspect portraits"
```

---

### Task 3: 서류철 테마 바탕 (공통 모습)

**Files:**
- Modify: src/ui/style.css (변수, body, 단추, 머리줄, 창(.overlay, .sheet), 말풍선(.bubble), 알림(#toast), 새 카드 창(.card-box)), src/index.html(theme-color), vite.config.ts(manifest theme_color, background_color)

**Interfaces:**
- Produces: CSS 변수(이후 작업이 씀): --cork, --cork-dot, --paper, --paper-line, --manila, --ink, --ink-soft, --red, --red-soft, --good, --pin. 재질 클래스: .paper(종이 한 장 + 그림자), .manila(마닐라지 빗금), .postit(노란 포스트잇, Nanum Pen Script), .stamp-ink(빨간 이중 테두리 도장 글자, Song Myung). 글꼴 변수: --title('Song Myung', 대체 serif), --body('Gowun Batang', 대체 serif), --hand('Nanum Pen Script', 대체 cursive).

- [ ] **Step 1: 변수와 바탕 교체** — :root 를 위 변수로 바꾸고 지금 변수 이름(--accent 등)을 쓰는 규칙을 새 변수로 옮긴다. body 바탕은 코르크(점무늬), 글꼴은 --body 15px. 남색이 남지 않게 한다(grep -n "2c4c7c\|--accent" src/ui/style.css 결과 없음).
- [ ] **Step 2: 공통 부품** — 단추: 종이 바탕 + 아래 그림자, 주요 단추(.primary)는 왼쪽 빨간 띠, 높이 44px 이상. .sheet(아래에서 올라오는 창)는 종이 한 장. .bubble 은 쪽지(안내는 .postit 모양). #toast 는 타자 쪽지. .card-box(새 직업·규칙 카드)는 종이 + 핀. 제목(h1, .case-title, .game-title)은 --title.
- [ ] **Step 3: 색 메타** — index.html theme-color 와 manifest theme_color·background_color 를 #3b2c1f 로.
- [ ] **Step 4: 확인** — typecheck, vitest, build, check-ui 전체 OK. logs/ui-check/ 스크린샷(01-title, 03-case-guide, 05-menu)을 열어 가로 스크롤·글씨 겹침이 없는지 본다.
- [ ] **Step 5: 커밋**

```bash
git add src/ui/style.css src/index.html vite.config.ts
git commit -m "feat: case-file theme base (cork, paper, manila, red ink, fonts)"
```

---

### Task 4: 사건 화면

**Files:**
- Modify: src/ui/screens/caseScreen.ts, src/ui/style.css(사건 화면 부분), src/tools/check-ui.mjs

**Interfaces:**
- Consumes: photo(id, cls?) (Task 2), 재질 클래스와 변수 (Task 3)
- Produces: 칸 DOM — button.cell 안에 span.pin, span.num, (조사 전) span.back, (조사 후·체포 후) photo(...), span.face(직업 이름), (체포 후) span.sub(진영 · 선/악) 과 span.stamp, (메모) span.note.postit. 연출 클래스 .fx-reveal, .fx-stamp.

- [ ] **Step 1: check-ui 에 새 확인을 먼저 넣는다 (실패 확인용)**

1스테이지 흐름 안에:
- 조사 전 칸: .cell[data-cell="8"] 안에 .back 이 있고 .photo 가 없다.
- 조사한 칸: .cell[data-cell="4"] 안에 .photo 가 있다.
- 악 체포 칸: .stamp 글자가 '체포', .sub 에 '악' 포함 (지금의 "'● 악'" 확인을 이것으로 바꾼다).
- 동작 줄이기: page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]) 로 바꾼 뒤 한 칸을 조사하고, 그 칸과 자식의 getAnimations() 가 0개. 확인 뒤 설정을 되돌린다.

스테이지 30(4×5) 흐름 안에:
- 가로 스크롤 없음(noSideScroll).
- 모든 .cell .face 의 계산된 font-size 가 14px 이상이고, scrollWidth <= clientWidth(이름이 잘리지 않음).
- 모든 칸에 대해 칸 가운데 좌표의 document.elementFromPoint(...).closest('.cell') 가 그 칸.

선 체포(오인 체포)는 기존 흐름에 없으므로 무한 모드 흐름에서 선으로 알려진 칸 하나(def.truth 로 고른 선)를 체포해 .stamp 가 '오인 체포' 인지 본다(평판이 2 줄어도 흐름이 이어지는 위치에 넣는다).

실행: node src/tools/check-ui.mjs → 새 확인들 FAIL.

- [ ] **Step 2: 칸 모습 (cellEl)**

- 조사 전: 마닐라 뒷면(span.back, 가운데 "?"), 아래 "조사 전".
- 조사 후: photo(def.faces[i]) + 직업 이름.
- 체포 후: photo(trueRole(def, i)) + 이름 + span.sub "{진영} · {선/악}" + span.stamp: 악이면 '체포', 선이면 '오인 체포'.
- 메모는 span.note 에 postit 모양(손글씨, 귀퉁이에 살짝 기울임). 누르는 자리 아님(pointer-events: none).
- 칸마다 기울기는 칸 번호로 정한 -2 ~ 2도(예: [-2, 1.2, -0.8, 1.6, -1.4][i % 5]). 겹치지 않게 gap 을 잡는다.
- 힌트·안내 칸(.flash, .guide)과 능력 고르기(.picker, .picked)는 빨간 동그라미 테두리(손으로 그린 듯한 타원)로.
- 4·5칸 판: 사진을 칸 폭에 맞춰 줄이고 이름은 두 줄까지(line-clamp 2), font-size 14px.

- [ ] **Step 3: 위쪽과 아래쪽**

- 경과·평판·이번 사건 구성: 한 장의 메모지(.paper, 살짝 기울임). data-stat 그대로.
- 말썽꾼·악 직업 단추(.chip): 꼬리표 모양(왼쪽 뾰족), 진영 글자 유지.
- 진술 목록(.clues): 줄 공책 종이, 제목 "진술 기록". 체포 칸 줄은 지금처럼 선·악 꼬리표(줄 긋기 없음). .ln-role 점선 밑줄 유지.
- 칸 메뉴와 직업 창(.sheet): 머리에 photo 를 크게(80px). 체포 칸 창은 진짜 직업 사진.

- [ ] **Step 4: 연출**

caseScreen 에 let fx: { cell: number; kind: 'reveal' | 'stamp' } | null = null 을 두고, 조사 성공 때 reveal, 체포 성공 때 stamp 로 정한다. cellEl 이 그 칸에 .fx-reveal / .fx-stamp 를 붙이고, render() 끝에서 fx = null. CSS: .fx-reveal 은 rotateY 90도 → 0(0.4초), .fx-stamp .stamp 는 scale 1.6 → 1, 투명 → 진하게(0.25초). @media (prefers-reduced-motion: reduce) 에서 두 애니메이션 none.

- [ ] **Step 5: 확인** — check-ui 전체 OK(Step 1 의 새 확인 포함), typecheck, vitest, build. 스크린샷 03, 05, 06, 스테이지 30 화면을 열어 시안(docs/mockups/2026-11-24-casefile-screens.png)과 비교.

- [ ] **Step 6: 커밋**

```bash
git add src/ui/screens/caseScreen.ts src/ui/style.css src/tools/check-ui.mjs
git commit -m "feat: case screen as a cork board with photo cards, stamps and notebook"
```

---

### Task 5: 타이틀과 스테이지 목록

**Files:**
- Modify: src/ui/screens/title.ts, src/ui/screens/stageList.ts, src/ui/style.css, src/tools/check-ui.mjs(문구가 바뀐 곳만)

**Interfaces:**
- Consumes: 재질 클래스 (Task 3)

- [ ] **Step 1: 타이틀** — 서류철 표지: 마닐라 폴더(.manila, 탭 모양) 위 흰 라벨에 kicker "수 사 기 록", h1.game-title "마을 수사록"(--title), 부제 "작은 마을 · 미해결 사건철", 귀퉁이 "기밀" 도장(.stamp-ink). 메뉴 단추 문구(data-action 그대로): stages "사건 파일"(small "{n} / 30 해결"), endless-resume "끝없는 수사 이어 하기", endless-new "끝없는 수사" 또는 이어 할 것이 있으면 "끝없는 수사 새로 시작", codex "인물 카드철", rules "수사 규칙". 시드 입력은 종이 쪽지 모양. 문서 제목(<title>)은 그대로 "마을 수사록".
- [ ] **Step 2: 스테이지 목록** — h1 "사건 파일". 장마다 서류 묶음(.paper 위 장 제목), 스테이지 단추는 파일 탭 모양. 푼 것은 작은 빨간 "해결" 도장, 잠긴 것은 흐리게 + "잠김". 단추 44px 이상, 5열 그대로.
- [ ] **Step 3: check-ui** — 문구 확인이 바뀐 곳만 고친다(제목 '마을 수사록' 확인은 그대로 통과해야 한다). 전체 OK.
- [ ] **Step 4: 확인과 커밋** — typecheck, vitest, build, check-ui. 스크린샷 01-title, 02-stages 확인.

```bash
git add src/ui/screens/title.ts src/ui/screens/stageList.ts src/ui/style.css src/tools/check-ui.mjs
git commit -m "feat: title as a case folder, stage list as case files"
```

---

### Task 6: 결과·도감·규칙·새 직업 카드

**Files:**
- Modify: src/ui/screens/result.ts, src/ui/screens/codex.ts, src/ui/screens/rules.ts, src/ui/tutorialOverlay.ts, src/ui/style.css, src/tools/check-ui.mjs

**Interfaces:**
- Consumes: photo(id, cls?) (Task 2), 재질 클래스 (Task 3)

- [ ] **Step 1: 결과** — 수사 보고서 종이. h1[data-result] 를 큰 도장으로: 해결이면 "해결", 실패면 "미해결"(data-result 값 solved/failed 그대로). 도장 찍힘 연출(Task 4 와 같은 키프레임 재사용, 동작 줄이기면 없음). 해설 단계는 보고서 본문, 선·악 표시 유지.
- [ ] **Step 2: 도감** — h1 "인물 카드철". 만난 직업: photo(r.id) + 이름·진영 + 설명 + 말하는 방식(speechList). 못 만난 직업: 뒤집힌 마닐라 카드(사진 없이 "?" 와 진영). data-role, data-codex-count 그대로.
- [ ] **Step 3: 규칙** — h1 "수사 규칙", 종이 문서. 개념 카드(.concept)는 포스트잇이 아니라 종이 쪽지.
- [ ] **Step 4: 새 직업 카드(showCards)** — 직업 카드면 머리에 photo(key) 를 크게. 규칙 카드는 사진 없음.
- [ ] **Step 5: check-ui** — 실패 결과 문구를 확인하는 곳이 있으면 "미해결"로. 전체 OK.
- [ ] **Step 6: 확인과 커밋** — typecheck, vitest, build, check-ui. 결과·도감·규칙 스크린샷 확인.

```bash
git add src/ui/screens/result.ts src/ui/screens/codex.ts src/ui/screens/rules.ts src/ui/tutorialOverlay.ts src/ui/style.css src/tools/check-ui.mjs
git commit -m "feat: report-style result, photo codex, rules sheet, role cards with photos"
```

---

### Task 7: 오프라인 확인, 용량 보고, 기록

**Files:**
- Create: src/tools/check-offline.mjs
- Modify: README.md, HISTORY.md, docs/2026-11-23-remaining-work.md(이번에 해결된 항목이 있으면 지움)

- [ ] **Step 1: check-offline 작성과 실행**

npm run build 뒤, vite preview(빌드 결과, base /village-case/)를 띄우고 puppeteer 로 연다. navigator.serviceWorker.ready 와 controller 가 생길 때까지 기다린 뒤(필요하면 한 번 새로 고침), page.setOfflineMode(true) 로 바꾸고 새로 고침한다. 확인: 타이틀이 뜬다, document.fonts.check('16px "Gowun Batang"') 와 '"Song Myung"', '"Nanum Pen Script"' 가 true, 1스테이지를 열면 .grid 가 보인다. 실패하면 종료 코드 1. 실행: node src/tools/check-offline.mjs.

- [ ] **Step 2: 용량 보고** — dist 의 글꼴 4개 합계, JS·CSS 증가분(이번 브랜치 전 빌드와 비교)을 보고에 적는다.

- [ ] **Step 3: 기록** — README: 현재 상태 한 줄, 폴더 구조(public/fonts, ui/fonts.css, ui/portraits.ts, tools 새 파일 4개), 실행(npm run fonts, node src/tools/contact-sheet.mjs, node src/tools/check-offline.mjs). HISTORY: 날짜·시각 / 한 일 / 글꼴 출처와 용량 / 결과 파일(logs/portraits.png, logs/ui-check/). 인라인 코드·링크 서식 금지.

- [ ] **Step 4: 전체 확인과 커밋** — typecheck, vitest, build, check-ui, check-offline, node src/tools/contact-sheet.mjs 모두 OK.

```bash
git add src/tools/check-offline.mjs README.md HISTORY.md docs/2026-11-23-remaining-work.md
git commit -m "test: offline check for fonts and screens; docs: record case-file UI"
```

---

## 컨트롤러 메모

- Task 2 가 끝나면 logs/portraits.png 를 사용자에게 보낸다(설계 10장: 비슷하다는 지적이 없어야 끝). 지적이 오면 Task 2 를 고친 뒤 계속한다.
- 마지막에 사건·타이틀·결과·도감 스크린샷과 용량을 사용자에게 보여 준다. push 는 묻는다.
