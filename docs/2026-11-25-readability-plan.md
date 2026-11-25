# 읽기 쉽게 다듬기 구현 계획

> For agentic workers: superpowers:executing-plans 로 작업 단위로 진행한다. 단계는 체크 상자로 표시한다.

목표: 진술을 "수상한 사람" 말투로, 사건 화면 위 메모 줄을 직업별 인원으로, 본문 글꼴을 또렷한 고딕으로 바꾼다.

구조: 화면 글(src/ui/clueText.ts, src/ui/roster.ts, caseScreen, rules)과 글꼴(make-fonts → src/public/fonts, fonts.css, style.css)만 바꾼다. 규칙·풀이 엔진·stages.json 은 건드리지 않는다.

기술: TypeScript, Vite 5, Vitest, puppeteer-core(check-ui, check-offline), subset-font.

설계: docs/2026-11-25-readability-design.md

## 전체 제약

- 진술의 뜻은 바꾸지 않는다. 칸 번호는 지금처럼 모두 적는다.
- 증언 속 악 = "수상한 사람". 단정형("봤어요", "있어요"), "~같아요" 금지.
- 규칙·직업 설명·풀이 해설은 선/악 그대로.
- 글꼴은 OFL 만. 예약 이름 있는 글꼴은 부분 집합을 새 이름으로(Village Sans).
- 로컬 PC 는 코어 절반(10)까지. 커밋 메시지에 JIRA 번호 없음. push 는 따로 묻는다.

## 검토할 점

- 길치(기준 칸 ≠ 말하는 칸)가 "우리 집"이라고 말하면 틀린 칸을 말하는 셈 → "6번 집"으로 말한다 (작업 1 시험).
- 말썽꾼·공범 직업이 4~5종일 때 메모 줄이 화면 밖으로 잘림 → 줄바꿈되어 다 보인다 (작업 2, check-ui 폭 확인).
- 새 문구 글자가 글꼴 부분 집합에 없으면 대체 글꼴로 섞여 보임 → 작업 3 에서 문구가 다 바뀐 뒤 글꼴을 다시 만든다 (glyphs 시험).
- 오프라인에서 새 글꼴이 캐시에서 열림 (check-offline).
- 고딕으로 바뀐 뒤 판 위 직업 이름표가 잘림 → check-ui 의 이름표 잘림 확인.

---

### Task 1 (작업 1): 진술 문장

Files:
- Modify: src/ui/clueText.ts (fact, clueText)
- Test: src/ui/clueText.test.ts

Interfaces:
- clueText(c, cell, w, h, face) 서명은 그대로. fact 가 cell 을 받아 기준 칸이 말하는 칸이면 "우리 집"/"제", 아니면 "{base+1}번 집"으로 말한다.

- [ ] 1. 시험 기대값을 설계 표대로 고친다 (3×3, 말하는 칸 4). 정확한 문장:

```
evil4 base4 n1: 배달 돌며 봤어요. 우리 집 위아래 양옆(2·4·6·8번)에서 수상한 사람을 1명 봤어요.
evil4 base0 n0 cell0: 배달 돌며 봤어요. 우리 집 위아래 양옆(2·4번)에서 수상한 사람은 못 봤어요.
evil8 base4 n2: 약 사러 온 이웃 얘기예요. 우리 집 둘레(1·2·3·4·6·7·8·9번)에 수상한 사람이 2명 있어요.
evilRow base4 n1: 반상회 명부 기준이에요. 우리 가로줄(4·6번)에 수상한 사람이 1명 있어요.
evilCol base4 n0: 순찰 기록이에요. 우리 세로줄(2·8번)에는 수상한 사람이 없어요.
diag base4 n1: 택시로 대각선 길을 달렸어요. 우리 집 대각선 길(1·3·7·9번)에서 수상한 사람을 1명 봤어요.
evil8 base5 n4 cell4 braggart: 내가 다 봤다니까! 6번 집 둘레(2·3·5·8·9번)에 수상한 사람이 4명 있어요.
evil8 base5 n0 cell4 lost: 우리 집 근처 얘기예요. 6번 집 둘레(2·3·5·8·9번)에 수상한 사람은 없어요.
nearest n2: 새벽 배달 길 기준이에요. 제일 가까운 수상한 사람은 우리 집에서 위아래·양옆으로 2칸 가야 있어요.
nearest n0: 새벽 배달 길 기준이에요. 저 말고는 수상한 사람이 없어요.
pairOne 2,6: 사진을 현상해 봤어요. 3번과 7번 중 딱 1명만 수상해요.
atLeastOne: 고해를 들었어요. 1·6·8번 중에 수상한 사람이 적어도 1명 있어요.
adjPair 1/0: 손님들 얘기를 들었어요. 수상한 사람끼리 위아래나 양옆으로 붙어 사는 집이 있어요./없어요.
halves 1: 맡긴 옷들을 세어 봤어요. 수상한 사람은 왼쪽(1·4·7번)보다 오른쪽(3·6·9번)에 더 많아요.
halves -1: … 수상한 사람은 오른쪽(3·6·9번)보다 왼쪽(1·4·7번)에 더 많아요.
halves 0: … 왼쪽(1·4·7번)과 오른쪽(3·6·9번)에 수상한 사람 수가 같아요.
bossDir up: 개가 짖은 쪽이에요. 제 위쪽(1·2·3번)에서 주범을 봤어요.
bossDir right: 개가 짖은 쪽이에요. 제 오른쪽(3·6·9번)에서 주범을 봤어요.
alibi 5: 6번은 밤새 우리 가게에 있었어요. 6번은 수상한 사람이 아니에요.
accuse 7 grandma: 8번이 밤마다 수상하게 나가던데. 8번은 수상한 사람이에요.
accuse 6 gossip: 들은 얘기예요~ 7번은 수상한 사람이에요.
sameSide, bossRow, abilityText, confessionText: 그대로
```

추가 시험: bossDir base 5, cell 4, dir 'up' → "제" 대신 "6번 집 위쪽(3번)에서 주범을 봤어요." 로 끝난다.

- [ ] 2. npx vitest run src/ui/clueText.test.ts → 실패 확인.
- [ ] 3. clueText.ts 의 fact(c, cell, w, h) 를 위 문장대로 고친다. own = c.base === cell. 장소 말: own 이면 '우리 집'·'우리 가로줄'·'우리 세로줄'·'제 위쪽', 아니면 '{base+1}번 집'·'{base+1}번 집 가로줄'·'{base+1}번 집 위쪽'. DIR_NAME 은 위쪽·아래쪽·왼쪽·오른쪽. 파일 머리 주석의 "사실" 설명에 "악은 '수상한 사람'으로 말한다"를 덧붙인다. clueText 의 void cell 은 없앤다.
- [ ] 4. npx vitest run → 전부 통과 (check-ui 의 진술 비교는 clueText 를 불러 쓰므로 따로 고칠 것 없음).
- [ ] 5. 커밋: "feat: witnesses speak of 수상한 사람 in everyday words"

### Task 2 (작업 2): 직업별 인원 표시와 "수상한 사람" 안내

Files:
- Modify: src/ui/roster.ts, src/ui/screens/caseScreen.ts (메모 줄, 인원표 머리글·안내), src/ui/screens/rules.ts, src/ui/style.css (.stat.ratio b 줄바꿈, 인원표 머리글 크기, .roster-note)
- Test: src/ui/roster.test.ts, src/tools/check-ui.mjs

Interfaces:
- Produces: rosterSummary(roster: Record<RoleId, number>): string — 증인을 뺀 직업을 주범 → 공범 → 말썽꾼, 진영 안은 직업표 순으로 "이름 수"를 " · "로 잇는다.

- [ ] 1. roster.test.ts 에 시험: rosterSummary({ chief: 2, thief: 1, blackmailer: 1, gossip: 2, postman: 3 }) 가 '두목 2 · 좀도둑 1 · 협박꾼 1 · 소문쟁이 2' (공범 순서는 roles.ts 직업표 순. 기대값은 그 순서로 맞춘다). 증인만 있으면 ''.
- [ ] 2. 실패 확인 → roster.ts 에 rosterSummary 구현 (rosterRows 재사용) → 통과.
- [ ] 3. caseScreen 메모 줄: `체포 ${caught}/${bossTotal} · ${rosterSummary(def.roster)}`. 이 때문에 안 쓰이게 된 count 도우미는 지운다.
- [ ] 4. 인원표 창: 진영 머리글은 row.label 만(숫자 빼고, 13px). 목표 문장 아래 p.roster-note "증언의 '수상한 사람'은 악(공범·주범)입니다." 규칙 화면 목록에 같은 뜻 한 줄: "증언에서 '수상한 사람'이라고 하면 악(공범·주범)을 말합니다."
- [ ] 5. style.css: .stat.ratio b 를 white-space: normal 로(넘치면 줄바꿈, 말줄임 없음).
- [ ] 6. check-ui.mjs: 116행 기대를 /두목 1/ 과 /우체부 1/ 과 /약사 7/ 로, 126행을 '체포 0/1 · 두목 1' 시작으로. 인원표에 '수상한 사람' 안내가 있는지 확인 하나 추가. 메모 줄이 화면 폭 안에 있는지 확인 하나 추가.
- [ ] 7. npx vitest run, npm run typecheck 통과.
- [ ] 8. 커밋: "feat: header memo lists roles by count; explain 수상한 사람"

### Task 3 (작업 3): 또렷한 고딕 본문 글꼴

Files:
- Modify: src/tools/make-fonts.ts, src/ui/fonts.css, src/ui/style.css (:root 글꼴 변수), src/tools/check-offline.mjs
- Create: src/public/fonts/sans-500.woff2, sans-700.woff2 (생성물), OFL.txt·glyphs.txt 다시 생성
- Move: src/public/fonts/gowun-batang-400.woff2, gowun-batang-700.woff2 → archive/fonts/

- [ ] 1. make-fonts.ts FONTS: 고운바탕 두 줄을 { src: 'ibmplexsanskr/IBMPlexSansKR-Medium.ttf', out: 'sans-500.woff2', rename: 'Village Sans' }, { src: 'ibmplexsanskr/IBMPlexSansKR-Bold.ttf', out: 'sans-700.woff2', rename: 'Village Sans' } 로. 라이선스 목록 'gowunbatang' → 'ibmplexsanskr'. 주석의 예시(나눔손글씨 펜 → Village Hand)에 IBM Plex Sans KR → Village Sans 를 더한다.
- [ ] 2. npm run fonts → 두 파일 생성, 합계 KB 기록.
- [ ] 3. fonts.css: Gowun Batang 두 @font-face 를 Village Sans 로 (sans-500 을 font-weight 400 으로 선언해 보통 글자에 Medium 이 쓰이게, sans-700 은 700). 머리 주석에 이름 바꾼 이유 한 줄.
- [ ] 4. style.css :root: --body: 'Village Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; --title 의 대체에서 고운바탕을 Village Sans 로; --hand 대체도 Village Sans.
- [ ] 5. 고운바탕 woff2 두 개를 archive/fonts/ 로 옮긴다. src 에 'Gowun Batang' 이 남지 않았는지 grep.
- [ ] 6. check-offline.mjs 글꼴 목록 'Gowun Batang' → 'Village Sans'.
- [ ] 7. npm test (glyphs 시험 포함), npm run build 통과.
- [ ] 8. 커밋: "feat: clear gothic body font (IBM Plex Sans KR subset as Village Sans)"

### Task 4 (작업 4): 확인과 기록

- [ ] 1. npm run typecheck, npm test, npm run build, node src/tools/check-ui.mjs, node src/tools/check-offline.mjs 모두 통과.
- [ ] 2. node src/tools/peek-case.mjs 14 로 인원표·진술 화면을 찍어 사용자에게 보여 준다. 글자 크기가 커 보이면 본문 1px 줄이고 다시 찍는다.
- [ ] 3. README(현재 상태, 폴더 구조의 글꼴 파일), HISTORY(2026-11-25 항목), conversations/2026-11-25.md 기록. 커밋.
- [ ] 4. push 는 사용자에게 묻는다 (main, 로컬 커밋 2b71ff9 포함, Actions 배포가 시작됨).
