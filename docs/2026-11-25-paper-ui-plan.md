# 서류철 물건 UI 구현 계획

> For agentic workers: superpowers:executing-plans 로 작업 단위로 진행한다. 단계는 체크 상자로 표시한다.

목표: 사진 밖의 화면 요소를 서류철 물건(목차, 양식, 줄 공책, 색인 카드, 고무도장, 쪽지)으로 다시 그리고, 템플릿 증상(둥근 상자, 왼쪽 색 띠, 알약 꼬리표, 색 동그라미 숫자)을 없앤다.

구조: 먼저 증상을 잡는 검사(정적 CSS 검사 + 화면 검사)를 세우고 전체를 한 번 걷어낸 뒤(작업 1), 숫자 글꼴을 넣고(작업 2), 화면마다 물건 구조로 바꾼다(작업 3 ~ 9). 규칙·엔진·진술 문장·인물 사진·판 카드는 건드리지 않는다.

기술: TypeScript, Vite 5, Vitest, puppeteer-core(check-ui, check-offline), subset-font.

설계: docs/2026-11-25-paper-ui-design.md (시안 docs/mockups/2026-11-25-paper-screens.png)

## 전체 제약

- 진술·본문 15px 이상, 양식 라벨 12px 이상, 누르는 자리 44px 이상, 390px 폭에서 가로 스크롤 없음.
- 둥근 모서리는 핀(.pin)에만. 그림자는 코르크판·어두운 창 위의 물건에만 한 겹.
- 잉크: 먹, 빨간 도장, 파란 볼펜(플레이어 메모), 연필(보조). 선·악은 글자로도 구별.
- data-* 속성 유지, check-ui 확인 항목 수는 줄지 않는다(지금 93).
- 화면 제목 문구는 그대로(1스테이지, 무한 · 14번째 사건, 사건 파일, 인물 카드철, 수사 규칙). 타이틀 문구 "마을 수사록"도 그대로.
- 글꼴은 OFL, 예약 이름은 바꿔 낸다(Village Mono). 글꼴 합계 1MB 이하.
- 로컬 PC 는 코어 절반(10)까지. 커밋 메시지에 JIRA 번호 없음. push 는 따로 묻는다. md 문서에 인라인 코드·링크 서식 없음.
- 시험 명령: 단위 npm test (약 125초라 백그라운드로), 화면 node src/tools/check-ui.mjs, 오프라인 node src/tools/check-offline.mjs, npm run typecheck, npm run build.

## 검토할 점

- 30스테이지처럼 숨은 직업이 7가지인 사건에서 사건 양식 명단이 폭을 넘거나 줄 높이가 44px 아래로 줄어듦 → 작업 5 의 30스테이지 확인.
- 진술이 여러 줄로 감길 때 글줄이 공책 괘선에서 어긋남 → 작업 6 의 "줄 높이가 괘선 간격의 배수" 확인.
- 무한 모드 결과에서 해설이 늦게 도착(setExplain)하거나 실패할 때 보고서 지면이 깨짐 → 작업 8 의 무한 결과 확인(기존 endless explanation 확인 유지).
- 테이프·쪽지 장식이 단추 위를 덮어 누르기를 막음 → 장식은 pointer-events: none, 작업 1 의 화면 검사가 아닌 기존 칸 누르기 확인(hitOk)으로 잡힘. 작업 3·5 에서 장식 추가 후 hitOk 와 title 메뉴 누르기 확인이 그대로 통과해야 한다.
- 시드 입력 오류 글이 새 양식 칸 아래에서 안 보임 → 기존 seed play 확인 유지.

---

### Task 1 (작업 1): 템플릿 증상 검사와 걷어내기

Files:
- Create: src/ui/style.test.ts
- Modify: src/ui/style.css (토큰, .btn, .bubble, .chip, .ln-tag, .steps, .codex-head span, .stamp-ink 등 증상이 있는 규칙)
- Modify: src/tools/check-ui.mjs (noSlop 추가, 화면마다 호출)

Interfaces:
- Produces: style.css 의 새 토큰 --rule (괘선 파랑 #c5d0d3), --margin (여백선 #d98a7e), --hair (#b9a98b), --blue (#2c4a8a), --pencil (#8a7a63), --radius: 0. 이후 작업이 이 이름을 쓴다.
- Produces: check-ui 의 noSlop(where) 도우미. 이후 작업이 새 화면 확인에 쓴다.

- [ ] 1. 정적 검사 src/ui/style.test.ts 를 쓴다.

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test('no pills or rounded boxes', () => {
  expect(css).not.toMatch(/border-radius:\s*(999px|[5-9]px|\d{2,}px)/);
});
test('no one-sided thick stripes', () => {
  expect(css).not.toMatch(/border-left(-width)?:\s*[3-9]px/);
});
test('only pins are round', () => {
  const round = rules.filter((r) => /border-radius:\s*50%/.test(r.body)).map((r) => r.sel);
  expect(round.filter((s) => !/pin/.test(s))).toEqual([]);
});
```

- [ ] 2. npx vitest run src/ui/style.test.ts → 세 시험 모두 FAIL (999px, border-left 6px·5px, .steps li::before 50%).
- [ ] 3. check-ui 에 noSlop 을 넣는다. 보이는 요소 중 (svg 안과 .pin 제외) 모서리 반경이 4px 넘는 것, 왼쪽 테두리가 3px 이상이면서 위 테두리보다 굵은 것을 최대 5개 이름으로 모아 check(`${where}: no rounded boxes or side stripes`, 없음). 호출 자리: 타이틀(01), 스테이지 목록(02), 1스테이지 인원표 창(03a), 1스테이지 판과 안내 말풍선, 칸 메뉴(05), 힌트 말풍선(04), 결과(07), 새 직업 카드(08), 30스테이지(09), 도감(17), 규칙(18). 11개 확인이 늘어난다.
- [ ] 4. node src/tools/check-ui.mjs → 새 noSlop 확인 중 타이틀·사건·결과·도감 등이 FAIL.
- [ ] 5. style.css 에서 증상을 걷어낸다: --radius 0, 모든 border-radius 를 0 으로(.pin 의 50% 만 남김), .btn.primary 의 border-left 띠 → 2px 먹 테두리(고무도장 단추, 송명 글자, 그림자 없음), .btn 기본 → 1.5px 먹 테두리 각진 단추(그림자 없음), .btn.ghost → 밑줄 글자 단추, .bubble 의 border-left → 테두리 없는 쪽지(guide = 포스트잇 노랑, hint·pick = 종이 + 위쪽 테이프 조각 ::before, pointer-events none), .chip·.ln-tag·.codex-head span 의 999px → 각진 도장 표시(1.5px 테두리, 송명, 배경 칠 없음), .steps li::before 동그라미 → 고정폭 두 자리 번호(counter(step, decimal-leading-zero), 배경 없음, 연필색). 선 진영 초록은 글자·테두리 색으로만.
- [ ] 6. npx vitest run src/ui/style.test.ts → PASS. node src/tools/check-ui.mjs → 전체 OK (93 + 11).
- [ ] 7. 커밋: "style: strip template tells (rounded boxes, side stripes, pills, number circles)".

### Task 2 (작업 2): 숫자 글꼴 Village Mono

Files:
- Modify: src/tools/make-fonts.ts (FONTS 에 Plex Mono 두 개, 라틴 글자만 남기는 선택, 라이선스 dir 에 ibmplexmono)
- Modify: src/tools/fontName.test.ts
- Modify: src/ui/fonts.css, src/ui/style.css (--mono 토큰, 숫자 자리에 적용)
- Modify: src/tools/check-offline.mjs (글꼴 목록에 'Village Mono')
- Output: src/public/fonts/mono-500.woff2, mono-600.woff2, OFL.txt, glyphs.txt

Interfaces:
- Produces: CSS 토큰 --mono: 'Village Mono', var(--body). 이후 작업의 숫자 자리(칸 번호, 쪽 번호, 사건 번호, 경과·평판·체포 값, 시드, 진술 여백 번호, 단계 번호)가 쓴다.

- [ ] 1. fontName.test.ts 에 시험을 더한다: mono-500.woff2·mono-600.woff2 의 이름 ID 1, 4, 6, 16 에 "plex" 가 없고 이름 ID 1 = 'Village Mono' (sans 시험과 같은 방식).
- [ ] 2. npx vitest run src/tools/fontName.test.ts → FAIL (파일 없음).
- [ ] 3. make-fonts.ts: FONTS 항목에 latin?: boolean 을 더하고, latin 이면 부분 집합 글자를 displayGlyphs 중 U+0020 ~ U+024F 와 · × – → › 로 줄인다. 항목: ibmplexmono/IBMPlexMono-Medium.ttf → mono-500.woff2, ibmplexmono/IBMPlexMono-SemiBold.ttf → mono-600.woff2, 둘 다 rename 'Village Mono', latin true. 라이선스 dir 목록에 ibmplexmono. npm run fonts 실행, 합계 KB 를 기록.
- [ ] 4. fonts.css: Village Mono 두 개(@font-face, mono-500 은 weight 400, mono-600 은 700, font-display swap). 주석에 예약 이름 Plex 때문에 이름을 바꾼다고 적는다. style.css :root 에 --mono. 지금 숫자 자리(.cell .num, .stage-no, .stat b, .seed-line, .list-count, .ln-num, .bubble-count, .steps 번호)에 font-family: var(--mono). check-offline 글꼴 목록에 'Village Mono'.
- [ ] 5. npx vitest run src/tools/fontName.test.ts src/tools/glyphs.test.ts → PASS. node src/tools/check-offline.mjs → 모두 OK.
- [ ] 6. 커밋: "feat: Village Mono numerals (IBM Plex Mono latin subset)".

### Task 3 (작업 3): 타이틀 — 표지와 목차

Files:
- Modify: src/ui/screens/title.ts, src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Produces: 목차 줄 마크업 (다른 작업이 결과 화면 "다음 사건" 줄에 같은 클래스를 쓴다):
  button.toc-row > span.toc-no (고정폭 "01") + span.toc-name (송명) + span.toc-lead (점선) + span.toc-val (고정폭) + span.toc-arrow "›" (aria-hidden).
- Produces: src/ui/paper.ts 의 tocRow(o: { no?: string; name: string; val?: string; attrs: Record<string, unknown> }): HTMLButtonElement — 위 목차 줄을 만든다. 작업 8 이 쓴다.
- Produces: 종이 한 장 클래스 .leaf (코르크 위 종이, 그림자 한 겹, 기울기 변수 --tilt 기본 0) 와 테이프 .tape (::before 아님, aria-hidden span, pointer-events none).

- [ ] 1. check-ui 타이틀 확인을 새 구조로 바꾸고 더한다: 메뉴 이름 확인은 [data-action] .toc-name 글로(사건 파일, 끝없는 수사 또는 끝없는 수사 이어 하기, 인물 카드철, 수사 규칙). 새 확인: "title: menu is one table of contents" (.title-screen .toc .toc-row 가 4개 이상, 모든 줄 높이 56px 이상, 쪽 번호가 01부터 차례), "title: folder label reads 사건 서류철 · 제1권".
- [ ] 2. check-ui → 새 확인 FAIL.
- [ ] 3. title.ts: 표지 라벨에 양식 줄 p.folder-no("사건 서류철" | "제1권", 아래 먹선), 기존 kicker "수 사 기 록" 은 뺀다(같은 뜻 중복). 메뉴 nav 를 section.leaf.toc 로: 머리 "목차"(송명, 자간 넓게), 줄 순서 01 사건 파일(cleared / 30), 02 끝없는 수사 이어 하기(있을 때만, "{n}번째 · 평판 {rep}"), 다음 번호 끝없는 수사 또는 끝없는 수사 새로 시작(최고 기록 n → 값 "최고 n"), 인물 카드철(met / 28), 수사 규칙(값 없음). data-action 은 지금 그대로. 시드 form 은 같은 목차 지면 아래 양식 칸: 라벨 "사건 코드로 열기", 밑줄 입력칸(고정폭, placeholder "예: 3-12345001"), 먹 고무도장 단추 "열람"(data-action seed-play), 오류 글 data-seed-msg 는 칸 아래 빨간 잉크.
- [ ] 4. check-ui → 전체 OK. 01-title 스크린샷을 눈으로 보고 시안 ①과 같은 물건인지 확인.
- [ ] 5. 커밋: "feat: title as folder cover and table of contents".

### Task 4 (작업 4): 스테이지 목록 — 장마다 원고지 칸

Files:
- Modify: src/ui/screens/stageList.ts, src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Consumes: .leaf, .tape (작업 3).
- Produces: 스테이지 칸 상태 클래스 .done / .current / .locked (current = 열렸고 안 푼 것 중 가장 앞 하나).

- [ ] 1. check-ui 스테이지 목록 확인을 더한다: "stage list: exactly one current stage, the first open unsolved" (처음엔 .stage.current 하나, data-stage 1), "stage list: chapter heads read 제N장" (첫 h2 글이 "제1장" 으로 시작).
- [ ] 2. check-ui → FAIL.
- [ ] 3. stageList.ts: 장 section 을 .leaf 로, 머리 h2 "제{n}장" + small 고정폭 "01 – 05"(두 자리). 칸 button.stage 에 current 클래스. 칸 안: span.stage-no 고정폭 두 자리, span.stage-state 는 푼 것이면 빨간 각진 이중 테두리 도장 "해결", 현재면 판 크기(3×3), 잠긴 것은 "잠김". CSS: .stage-grid 는 칸 사이 1px 먹선만(원고지), 마닐라 파일 탭 모양(.stage::before) 삭제, .current 는 칸 안쪽 2px 연필 테두리, .locked 는 흐린 번호 + 칸 대각선 사선(linear-gradient 1px).
- [ ] 4. check-ui → 전체 OK, 02-stages 스크린샷 확인.
- [ ] 5. 커밋: "feat: stage list as ruled chapter sheets".

### Task 5 (작업 5): 사건 머리 — 사건 양식 하나로 합치기

Files:
- Modify: src/ui/roster.ts, src/ui/roster.test.ts (rosterSummary 를 rosterList 로 바꿈)
- Modify: src/ui/screens/caseScreen.ts (stats·roles 자리), src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Produces: rosterList(roster: Record<RoleId, number>): { id: RoleId; name: string; count: number; camp: Camp }[] — 증인 제외, 주범 → 공범 → 말썽꾼, 직업표 순서. rosterSummary 는 쓰는 곳이 없어지므로 지운다(이 작업이 만든 고아).
- Produces: 양식 표 마크업 table.form-grid > td > span.label + b.val (작업 8 결과 보고서가 같은 클래스를 쓴다).

- [ ] 1. roster.test.ts 의 summary 시험을 rosterList 시험으로 바꾼다:

```ts
test('list: non-witness roles with counts and camps, boss → accomplice → trouble', () => {
  expect(rosterList({ chief: 2, thief: 1, blackmailer: 1, gossip: 2, postman: 3 })).toEqual([
    { id: 'chief', name: '두목', count: 2, camp: 'boss' },
    { id: 'thief', name: '좀도둑', count: 1, camp: 'accomplice' },
    { id: 'blackmailer', name: '협박꾼', count: 1, camp: 'accomplice' },
    { id: 'gossip', name: '소문쟁이', count: 2, camp: 'trouble' },
  ]);
  expect(rosterList({ postman: 9 })).toEqual([]);
});
```

- [ ] 2. npx vitest run src/ui/roster.test.ts → FAIL (rosterList 없음).
- [ ] 3. roster.ts 에 rosterList, rosterSummary 삭제. npx vitest run src/ui/roster.test.ts → PASS.
- [ ] 4. check-ui 머리 확인을 바꾼다: "header memo counts caught bosses" → [data-stat="bosses"] 글이 "0 / 1"(공백 정규화). "header memo fits the width" → section.case-form 이 폭 안. 30스테이지 "header memo lists every role…" → .case-form .roster-row 가 inPlay 의 증인 아닌 직업 수와 같고, 줄마다 높이 44px 이상, 오른쪽 끝이 W 안, 이름이 잘리지 않음. 새 확인: "case form: tapping a role row opens its role sheet" (1스테이지 두목 줄을 눌러 .sheet 머리에 "두목"이 보이고 닫힘). "roster reopens from the header memo" 는 [data-action="roster"] 가 이제 "인원표 전체" 글자 단추.
- [ ] 5. check-ui → FAIL.
- [ ] 6. caseScreen.ts: div.stats 와 div.roles 를 section.leaf.case-form 하나로: table.form-grid 한 줄 세 칸 — 경과(b.val data-stat hour, 고정폭 숫자 + small "시간"), 평판(data-stat rep, 4 이하면 빨강), 체포한 주범(data-stat bosses, "{caught} / {total}", 빨강). 그 아래 머리 줄 span.label "이 마을에 숨은 직업" + button.link data-action roster "인원표 전체". 그 아래 div.roster-rows (2열 grid) 에 rosterList 마다 button.roster-row(data-role id, onclick showRole(id)): b 이름 + span.stamp-mark.camp-{camp} 진영 이름 + span.count 고정폭 "×{n}". 명단이 비면(1·2스테이지 이전 같은 경우) 머리 줄만. 끝없는 모드 시드 줄은 제목 아래 그대로(고정폭). 지운 .chip·.stat 관련 CSS 는 지운다.
- [ ] 7. check-ui → 전체 OK. 03-case-guide, 09-stage30 스크린샷 확인.
- [ ] 8. 커밋: "feat: case header as one form with the hidden-role list".

### Task 6 (작업 6): 진술 기록 줄 공책, 쪽지

Files:
- Modify: src/ui/screens/caseScreen.ts (clues, panel), src/ui/tutorialOverlay.ts (guide bubble 머리), src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Consumes: --rule, --margin, --mono, .leaf, .tape.
- Produces: 줄 공책 클래스 .ruled (--lh: 28px, 파란 괘선 + 46px 위치 빨간 여백선 배경). 작업 7 의 칸 메뉴 인용이 같은 클래스를 쓴다.

- [ ] 1. check-ui 에 확인을 더한다: "statements sit on the ruled lines" — 30스테이지 다 조사한 뒤 .clues li 마다 높이가 28px 의 배수(±1px)이고 .ln-body 의 line-height 가 28px. "arrested line shows a verdict stamp, not a pill" — 체포한 칸의 .clues li .ln-tag 가 border-radius 0, 글이 "선" 또는 "악".
- [ ] 2. check-ui → FAIL.
- [ ] 3. caseScreen.ts: section.clues 를 section.leaf.clues 로(테이프 하나), 머리 h2 "진술 기록" + small 고정폭 "{n} / {total}명". ol 에 .ruled. ln-num 은 여백 칸(46px, 오른쪽 정렬, 고정폭 숫자만 — "번" 은 빼고 aria-label 로 "{n}번"). ln-tag 는 줄 끝 작은 판정 도장(글자 "선"/"악", 송명, 각진 테두리, 기울기 -4도). 체포로 판정된 줄의 본문은 연필색. .marked 표시는 형광펜(글줄 아래 절반 노랑). 자백 줄(.ln-confession)도 같은 공책 줄, 머리 small "자백". 빈 상태 글(.empty)은 첫 괘선 위.
- [ ] 4. 말풍선(panel): .bubble 공통은 쪽지. guide-bubble = 포스트잇(손글씨 머리말 "안내 · 5번 칸"), hint-bubble·pick-bubble = 종이 + 테이프. bubble-count 고정폭. 이전·다음·취소·안내 닫기 단추는 글자 단추, 다음만 먹 고무도장 단추(지금 primary). 격자를 가리키던 꼬리(::before)는 지운다.
- [ ] 5. check-ui → 전체 OK. 04-hint, 09-stage30, 11-stage30-all 스크린샷 확인.
- [ ] 6. 커밋: "feat: statements on a ruled notepad, bubbles as slips".

### Task 7 (작업 7): 아래 창 — 색인 카드

Files:
- Modify: src/ui/screens/caseScreen.ts (칸 메뉴, 체포 칸 창, 직업 창, 인원표 창), src/ui/tutorialOverlay.ts (card-box), src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Consumes: .ruled (작업 6), .form-grid (작업 5).
- Produces: .index-card (위쪽 3px 빨간 선, 종이, 각짐). .sheet 와 .card-box 가 이 모습을 쓴다.

- [ ] 1. check-ui 에 확인을 더한다: "cell menu: head reads N번 칸 and the face name" (.sheet .sheet-head .label 글이 "5번 칸 · 조사함" 형태로 시작, b 가 직업 이름), "cell menu: arrest is a red double-bordered stamp" ([data-action="arrest"] 의 border-style 이 double, 색이 빨강 rgb(179, 38, 30)), "cell menu: memo row is one form line" (.sheet-memo 의 버튼들이 같은 top 값, 높이 48px 이상).
- [ ] 2. check-ui → FAIL.
- [ ] 3. caseScreen.ts 칸 메뉴: sheet-head = 기운 사진 + div(span.label "{n}번 칸 · {조사함|조사하지 않음}", b 직업 이름 송명). 진술 인용 p.sheet-clue 를 따옴표로 감싸 .ruled 위에. role-link 는 "{직업}은 어떻게 말하나" 글자 단추. sheet-actions: 조사 = 먹 고무도장, 체포 = 빨간 이중 테두리 고무도장(btn action danger), small 은 시간. sheet-memo: 한 줄 양식(라벨 칸 "내 메모" + 선·악·?·지우기 칸, 칸 사이 먹선, 고른 칸은 포스트잇 노랑 + 파란 손글씨). 닫기는 글자 단추. 체포 칸 창·직업 창도 같은 머리 모양(label "{n}번 칸 · 체포함" / 진영·선악). 인원표 창의 table.roster 는 .form-grid 모양(먹선 표, 진영 칸은 도장 표시). card-box 는 .index-card(머리 kicker 는 label 로).
- [ ] 4. check-ui → 전체 OK. 03a-roster, 05-menu, 05b-role, 08-card 스크린샷 확인.
- [ ] 5. 커밋: "feat: sheets and new-role cards as index cards".

### Task 8 (작업 8): 결과 — 수사 보고서

Files:
- Modify: src/ui/screens/result.ts, src/ui/endless.ts (무한·시드 결과 호출), src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Consumes: .form-grid (작업 5), tocRow (작업 3), .leaf, .tape.
- Produces: ResultView 에 facts: [string, string][] (라벨, 값) 를 더한다. actions 는 지금처럼 HTMLElement[] (호출부가 tocRow 와 글자 단추로 만든다). kicker 는 보고서 머리 오른쪽 번호 자리로 쓴다.

- [ ] 1. check-ui 에 확인을 더한다: "result: report has 3 facts" (.result-screen .form-grid td 가 3개), "result: steps numbered 01… without circles" (.steps li::before 의 content 가 "01" 로 시작하는 counter 이고 border-radius 0 — getComputedStyle(li, '::before')), "result: next case is a table-of-contents row" ([data-action="next"] 가 .toc-row). 기존 data-action next·retry 확인은 유지.
- [ ] 2. check-ui → FAIL.
- [ ] 3. result.ts: header 를 section.leaf.report 로: 머리 양식 줄(span "수사 보고서" | span 고정폭 kicker), h1 "보고서"(송명, 자간 넓게), table.form-grid(facts), 큰 도장 h1.verdict(data-result, 지금 연출 그대로), p.result-sub. 해설(abilities, steps)은 같은 지면 안, 단계 번호는 고정폭 counter 두 자리, side-evil 단계 글은 빨강. 아래 이동: next 가 있으면 button.toc-row(data-action next, 이름 "다음 사건" 또는 "다음 스테이지", 값 no + " →"), 그 밑 글자 단추 줄(다시 하기 data-action retry, 스테이지 목록 / 처음으로). 실패면 next 없이 다시 하기를 먹 고무도장 단추로.
- [ ] 4. 호출부: showResult(스테이지) kicker "사건 No. {두 자리 id}", facts [["경과", "{hour}시간"], ["남은 평판", rep], ["체포한 주범", "{caught} / {total}"]], next no "No. {두 자리 id+1}". endless.ts 무한 해결: kicker "무한 · {n}번째 사건", facts 경과 / 평판 "{rep} → {next.rep}" / 최고 기록, next "다음 사건". 무한 실패·시드 사건 결과도 같은 모양(지금 문구 유지).
- [ ] 5. check-ui → 전체 OK (endless explanation arrives, endless fail 확인 포함). 07-result, 12-stage30-result, 15-endless-result, 20-endless-failed 스크린샷 확인.
- [ ] 6. 커밋: "feat: result as an investigation report form".

### Task 9 (작업 9): 인물 카드철, 수사 규칙, 불러오는 중

Files:
- Modify: src/ui/screens/codex.ts, src/ui/screens/rules.ts, src/ui/endless.ts (loading), src/ui/speech.ts 는 마크업 그대로(dl.speech 를 CSS 로 양식 두 칸), src/ui/style.css, src/tools/check-ui.mjs

Interfaces:
- Consumes: .index-card (작업 7), .leaf, .form-grid 모양.

- [ ] 1. check-ui 에 확인을 더한다: "codex: unknown cards grouped by camp in rows" (못 만난 카드가 진영별 section.codex-camp 안에 있고 각 section 의 .codex-item.unknown 들이 한 줄에 2개 이상 놓임 — 첫 두 카드의 top 이 같음), "rules: articles read 제N조" (.rule-block h2 가 "제1조 판" 부터 차례).
- [ ] 2. check-ui → FAIL.
- [ ] 3. codex.ts: 만난 직업은 li.codex-item.index-card(사진, 이름 송명, 진영 도장 표시 + 고정폭 "등급 {n}", 설명, body, speechList). 못 만난 직업은 진영별 section.codex-camp(h2 진영 이름 + 고정폭 개수) 안 ul 에 작은 뒤집힌 카드 li.codex-item.unknown.manila(b "?", 폭 약 64px, flex-wrap). 만난 직업 목록이 먼저, 그 뒤 진영별 묶음. data-role, data-codex-count 유지.
- [ ] 4. rules.ts: 각 section h2 를 "제{n}조 {head}", ul 을 고정폭 여백 번호 목록(ol, counter), 개념은 div.concept 를 양식 두 칸(b 용어 | p 설명, 사이 먹선). 지면 하나(.leaf).
- [ ] 5. endless.ts loading: p.loading-text 를 div.slip(쪽지, 손글씨 아님 — 송명) 안에, "처음으로"는 글자 단추.
- [ ] 6. check-ui → 전체 OK. 17-codex, 18-rules 스크린샷 확인. 불러오는 중 화면은 잠깐만 보여 자동 확인이 흔들리므로 무한 시작 때 눈으로 한 번 본다.
- [ ] 7. 커밋: "feat: codex index cards grouped by camp, rules as articles".

### Task 10 (작업 10): 전체 확인과 기록

Files:
- Modify: README.md, HISTORY.md, conversations/2026-11-25.md

- [ ] 1. npm test(백그라운드, 로그를 logs/ 에), npm run typecheck, npm run build, node src/tools/check-ui.mjs, node src/tools/check-offline.mjs 모두 통과. check-ui 확인 수를 적는다(93 + 늘어난 수).
- [ ] 2. 스크린샷(01, 02, 03-case-guide, 05-menu, 07-result, 09-stage30, 17-codex, 18-rules)을 시안과 나란히 보고 1장의 증상이 남지 않았는지 눈으로 확인. 남은 것이 있으면 고치고 noSlop 이 왜 못 잡았는지 적는다.
- [ ] 3. README 현재 상태·폴더 구조(docs 설계·계획·시안, fonts 의 mono), HISTORY 항목(한 일, 글꼴 합계, 확인 수, 스크린샷 위치), 대화 요약.
- [ ] 4. 커밋: "docs: record paper UI pass".
