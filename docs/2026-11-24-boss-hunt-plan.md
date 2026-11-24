# 주범 사냥 (규칙 개편 1단계) 구현 계획

> 실행: superpowers:executing-plans (직접 구현) 또는 subagent-driven-development. 단계는 체크박스로 표시한다.

목표: 게임 목표를 "주범 모두 체포"로 바꾸고, 직업 28개(증인 16, 말썽꾼 3, 공범 5, 주범 4)와 새 증언 모양, 인원표, 칸 번호 증언, 거짓일 수 있는 자백을 넣는다.

구조: 규칙의 뜻은 src/core/rules.ts 의 consistent() 하나가 정한다. 백트래킹 솔버(solve.ts)는 빠르게, 전수 조사 솔버(brute.ts)는 단순하게 같은 뜻을 구현하고 교차 검증이 둘을 맞춘다. 생성기·유일해 검사·해설기는 "주범 자리"를 기준으로 바꾼다. 화면은 순수 함수(문장, 인원표, 표시 칸)를 먼저 만들고 사건 화면이 그것을 쓴다.

기술: TypeScript, Vite 5, Vitest(maxWorkers 10), tsx, puppeteer-core(check-ui, check-offline). Node 24.

설계: docs/2026-11-24-boss-hunt-design.md (아래 "설계 4.4" 처럼 절 번호로 가리킨다)

## 전역 제약

- 원작(Dupery) 직업 이름·능력을 쓰지 않는다.
- 로컬 PC 는 코어 절반(10개)까지. vitest maxWorkers 10 그대로, 스테이지 생성·교차 검증도 한 프로세스.
- push 는 하지 않는다. 끝나면 사용자에게 묻는다. 커밋은 해도 된다.
- 커밋 메시지 끝에 두 줄: "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", "Claude-Session: https://claude.ai/code/session_01NTpbXUKYcDrH2V7WhBzm4W". JIRA 번호 없음.
- md 문서에 인라인 코드·링크 서식을 쓰지 않는다.
- 증언 문장만 보고 거짓인지, 협박·매수·바꿔치기를 당했는지 알 수 없어야 한다 (설계 4.3).
- 칸 번호는 화면에서 1부터. 코드 안 칸 번호는 0부터.
- 문구를 바꾸면 npm run fonts 로 글꼴 부분 집합을 다시 만든다 (glyphs 시험이 잡는다).
- 작업 1 ~ 8 사이에는 npm test 전체가 빨갈 수 있다 (옛 stages.json, 글꼴 glyphs, 새 직업 사진). 작업마다 적은 시험 명령과 npm run typecheck 가 그 작업의 기준이고, 작업 9 끝에서 npm test 전체가 통과해야 한다.

## 검토 초점 (계획의 시험이 따로 겨누는 곳)

1. 같은 직업 여러 명: 솔버·전수 조사가 같은 세계를 한 번씩만 내놓는가, 생성기가 같은 직업 2명 사건을 만드는가 → 작업 2, 3 시험.
2. 효과 겹침: 그림자·누명·대역이 같은 진술에, 협박당한 종지기·개 주인 → 작업 1 시험.
3. 판 가장자리: 개 주인은 칸이 없는 방향을 말하지 않음, 세탁소는 홀수 폭에서 가운데 세로줄 제외 → 작업 1, 3 시험.
4. 자백: 남은 주범이 모든 세로줄에 있을 때 거짓 자백은 "아무것도 모르오", 마지막 주범 체포 뒤에는 자백 없음, 같은 순서면 같은 자백 → 작업 5 시험.
5. 저장 v1 → v2: 해결 기록·최고 기록은 남고 진행 중 무한 사건은 버림 → 작업 5 시험.

---

### 작업 1: 규칙의 뜻 (타입·직업표·판정)

파일
- 고침: src/core/types.ts, src/core/roles.ts, src/core/rules.ts, src/core/board.ts
- 시험: src/core/rules.test.ts, src/core/board.test.ts

인터페이스 (뒤 작업이 이 이름을 쓴다)
- types.ts
  - ClueKind 에 추가: 'diag' | 'atLeastOne' | 'adjPair' | 'halves' | 'bossDir' | 'alibi' | 'accuse' | 'sameSide'. 'bossRow' 는 뜻이 바뀐다(아래).
  - Clue 에 추가: cells?: number[] (atLeastOne 세 칸), r?: number (bossRow 가로줄, 1부터), dir?: 'up' | 'down' | 'left' | 'right' (bossDir).
    - halves 의 n: -1 왼쪽이 많음, 0 같음, 1 오른쪽이 많음. adjPair 의 n: 1 있음, 0 없음. bossRow 의 n: 그 줄의 주범 수.
    - alibi·accuse 는 a 한 칸, sameSide·pairOne 은 a, b.
  - Mode = 'true' | 'false' | 'any' | 'over' | 'shield'.
  - RoleDef 에 추가: effect?: 'lie' | 'shield' | 'frame' (taint 범위 'adj4' | 'any' 와 함께 쓴다), decoy?: boolean.
  - Knowledge 에 추가: roster: Record<RoleId, number> (이번 사건 모든 직업의 인원, 증인 포함). inPlay 는 증인이 아닌 직업의 중복 있는 목록(정렬).
  - CaseDef 에 추가: roster: Record<RoleId, number>.
- roles.ts: 직업 28개. 숨은이(hidden)·능청이(smooth) 삭제. 새 id 와 진술:

```
id          이름          진영        진술/행동                      tier
postman     우체부        witness     evil4                          1
pharmacist  약사          witness     evil8                          1
grandma     옆집 할머니   witness     accuse                         1
mayor       이장          witness     evilRow                        2
guard       경비원        witness     evilCol                        2
restaurant  식당 주인     witness     alibi                          2
baker       빵집 주인     witness     nearest                        3
photographer 사진사       witness     pairOne                        3
taxi        택시 기사     witness     diag                           3
operator    전화 교환원   witness     sameSide                       4
priest      신부          witness     atLeastOne                     4
reporter    기자          witness     ability pairSame               4
barber      이발사        witness     adjPair                        5
laundry     세탁소 주인   witness     halves                         5
dog         개 주인       witness     bossDir                        5
bellringer  종지기        witness     bossRow, trigger 12            5
braggart    허풍쟁이      trouble     evil8, mode over               2
lost        길치          trouble     evil8, mode true, shift right  3
gossip      소문쟁이      trouble     accuse, mode false             4
lookout     망보기        accomplice  place bossIn8                  1
thief       좀도둑        accomplice  taint adj4, effect lie         2
shill       바람잡이      accomplice  mode true                      3
blackmailer 협박꾼        accomplice  taint adj4, effect shield      4
decoy       대역          accomplice  decoy                          5
chief       두목          boss        (위장 거짓말)                  1
briber      매수왕        boss        taint any, effect lie          4
shadow      그림자        boss        hiddenFromCounts               5
framer      모사꾼        boss        taint any, effect frame        5
```

  - desc 는 설계 4.4 의 표 문장을 쓴다. tier 는 장 번호(작업 8 의 장 구성과 같다. 6장 신규 없음).
- rules.ts (모두 export)
  - type View = 'real' | 'shield'
  - framedAt(world, i): boolean: effect 'frame' 인 원천의 대상인가
  - countedAt(world, i, view): boolean: 악을 세는 진술에서 세어지는가 = (악 && 그림자 아님 && (view 가 'shield' 면 주범 아님)) || 누명
  - evilIn(world, i, view): boolean: 관계 진술이 보는 악 = 악 && (view 가 'shield' 면 주범 아님)
  - bossLike(world, i, view): boolean: 주범을 가리키는 진술이 보는 주범 = view 'real' 이면 주범 또는 대역, 'shield' 면 대역만
  - clueFact(w, h, world, c, view = 'real'): boolean
  - countValue(w, h, world, c, view = 'real'): number (수 세기 진술 evil4·evil8·evilRow·evilCol·diag 의 실제 수)
  - modeAt(world, i): Mode. 진짜 증인이 effect 'lie' 원천의 대상이면 'false', 'shield' 원천의 대상이면 'shield'. 아니면 def.mode, 기본은 지금과 같다.
  - statementHolds(w, h, world, cell, c): boolean. true → clueFact(real), false → !clueFact(real), any → true, over → c.n > countValue(real), shield → clueFact(shield)
  - abilityTruth(world, cell, a, b): boolean | 'any'. 말하는 칸이 답할 "같은 편" 여부. true → evilIn(a, real) === evilIn(b, real), false → 그 반대, shield → view shield 로 같은 편, any → 'any'
  - hash4(a, b, c, d): number (지금 private 을 export. 자백이 쓴다)
  - consistent(k, world): 아래 뜻
    - 증인 아닌 칸의 직업 목록(중복 포함)이 k.inPlay 와 같다.
    - 증인 칸 중 직업이 정해진 칸(ANY_WITNESS 아님)의 직업별 수가 roster 이하.
    - 오염: 원천마다 대상은 범위(adj4 → 상하좌우, any → 판 전체) 안, 자기 아님. lie·shield 의 대상은 진짜 증인, frame 의 대상은 선(증인·말썽꾼). 범위에 그런 칸이 하나도 없을 때만 -1. 두 원천이 같은 칸을 대상으로 삼지 않는다.
    - 망보기: 주변 8칸에 진짜 주범(대역 아님)이 있다.
    - 보이는 진술마다 statementHolds, 능력 관찰마다 abilityTruth 가 'any' 이거나 o.same 과 같다.
- clueFact 의 뜻 (view 는 위 함수로 센다)
  - evil4·evil8·evilRow·evilCol·diag: countValue === n. diag 는 base 를 지나는 두 대각선 위 칸(base 제외).
  - nearest: countedAt 칸까지 가장 가까운 상하좌우 거리 === n, 없으면 n === 0.
  - pairOne: evilIn(a) !== evilIn(b). sameSide: evilIn(a) === evilIn(b). alibi: !evilIn(a). accuse: evilIn(a). atLeastOne: cells 중 evilIn 이 하나 이상.
  - adjPair: 상하좌우로 붙은 두 칸이 모두 countedAt 인 쌍이 있으면 1, 없으면 0. n 과 같은가.
  - halves: 왼쪽 floor(w/2) 세로줄과 오른쪽 floor(w/2) 세로줄의 countedAt 수 비교(홀수 폭이면 가운데 세로줄 제외). 부호가 n 과 같은가.
  - bossDir: dir 방향(up = base 보다 위 가로줄 전부, down = 아래 가로줄 전부, left = 왼쪽 세로줄 전부, right = 오른쪽 세로줄 전부)에 bossLike 칸이 하나 이상.
  - bossRow: r 번째 가로줄의 bossLike 수 === n.
- board.ts: diagOf(w, h, i): number[] (두 대각선, i 제외, 칸 번호 순), sideCells(w, h, i, dir): number[], halvesOf(w, h): [number[], number[]]

- [ ] 1단계: 시험 먼저. rules.test.ts 에 아래를 더하고(지금 시험 중 숨은이·능청이를 쓰는 것은 바람잡이·두목 등으로 바꾼다), board.test.ts 에 diagOf·sideCells·halvesOf 시험.

```
// 3×3, 칸 0..8. 표기 W=ANY_WITNESS
test('diag counts both diagonals through the base, excluding it')  // base 4 → diagOf = [0,2,6,8]; 0 과 8 이 두목·좀도둑이면 countValue = 2
test('shadow is not counted, framed good cell is counted')         // 그림자 at 1, 모사꾼 at 7 이 3번을 누명 → evil4 base 4: countValue 2 (3, 7)
test('shield view drops bosses from counts and relations')         // 두목 at 1, 협박꾼 at 3 → 4번이 협박 대상: evil4 base 4 shield = 1, real = 2
test('decoy is a boss for bossRow and bossDir, not for shield')    // 대역 at 0, 두목 at 8: bossRow r=1 real n=1 참, shield 에서 대역만 → n=1 참, 두목 줄 r=3 shield n=0 참
test('bossDir false when nothing that way')                        // base 0, dir up → sideCells 빈 목록 → 늘 거짓
test('halves on odd width skips the middle column')                // 3×3: 왼쪽 [0,3,6] 오른쪽 [2,5,8]
test('adjPair finds a horizontally adjacent counted pair')
test('alibi, accuse, sameSide, atLeastOne use real evil (shadow counts as evil, framed does not)')
test('braggart (over) holds only when said number exceeds the real one') // evil8 실제 1: n=2 참, n=1·0 거짓
test('gossip accuse is always false: target must be good')
test('consistent: duplicate accomplices must match inPlay multiset')       // inPlay ['thief','thief','chief']
test('consistent: witness counts above roster are rejected')               // roster 우체부 1 인데 우체부 증인 2칸 → false
test('consistent: two sources may not taint the same cell')
test('consistent: frame target must be good, lie/shield target a real witness')
test('lookout needs a real boss in 8 neighbours, decoy does not count')
test('abilityTruth: shielded reporter answers as if bosses were good')
```

- [ ] 2단계: npx vitest run src/core/rules.test.ts src/core/board.test.ts → 새 시험이 실패(함수 없음).
- [ ] 3단계: 위 인터페이스대로 types.ts·roles.ts·board.ts·rules.ts 를 고친다. Knowledge·CaseDef 를 만드는 곳(game.knowledgeOf, unique.fullKnowledge, testcases)에 roster 를 넘겨 타입 검사를 통과시킨다(뜻은 뒤 작업에서 채움). 솔버는 이 작업에서 고치지 않는다.
- [ ] 4단계: npx vitest run src/core/rules.test.ts src/core/board.test.ts 통과, npm run typecheck 통과.
- [ ] 5단계: 커밋 "feat(core): boss-hunt roles and rule semantics".

### 작업 2: 솔버와 전수 조사 (교차 검증)

파일
- 고침: src/core/solve.ts, src/core/brute.ts, src/core/testcases.ts, src/core/crossCheck.ts
- 시험: src/core/solve.test.ts

인터페이스
- 소비: 작업 1 의 consistent, statementHolds, abilityTruth, modeAt, countedAt, evilIn, bossLike.
- 생산: forEachWorld, solve, solveBrute 의 시그니처는 그대로. 뜻: consistent(k, w) 를 만족하는 세계를 각각 정확히 한 번.
  - 같은 직업 여럿은 맞바꿔도 같은 세계라 한 번만 낸다.
  - 증인 칸 값은 witnessValue 규칙 그대로.
- testcases.ts: randomInPlay(r, max) 가 새 직업 전부에서, 같은 직업 2명까지, 주범 1 ~ 2명, 최대 max 개를 뽑는다. randomTruth 는 진짜 증인 직업까지 정하고 roster 를 만든다. randomKnowledge 는 roster 를 넣는다.

- [ ] 1단계: 시험 먼저. solve.test.ts 에 더한다.

```
test('duplicate roles: each world once')       // inPlay ['thief','thief','chief'], 3×3, 진술 없음 → worldKey 중복 0, 수 = 9·C(8,2)… 를 solveBrute 와 같게
test('roster count prunes worlds')             // 모두 조사, 우체부 겉 직업 3칸, roster 우체부 2 → 그 셋 중 적어도 1칸은 증인 아님인 세계만
test('frame target chosen inside the search')  // 모사꾼 사건에서 solve 와 solveBrute 같음
test('cross-check', …)                          // 기존 crossCheck(0, CROSS_CASES): 새 randomInPlay 로
```

- [ ] 2단계: npx vitest run src/core/solve.test.ts → 실패 확인.
- [ ] 3단계: brute.ts 를 먼저 고친다. inPlay 다중 집합 배치(같은 직업은 칸 번호 오름차순으로만 놓아 중복 없게), 원천마다 대상 후보 -1 + 범위 전체, 판정은 consistent 에만 맡긴다. 크기 제한: n ≤ 12, inPlay ≤ 4.
- [ ] 4단계: solve.ts 를 고친다. 방법은 구현자 몫이지만 지킬 것:
  - 같은 직업은 채우는 순서상 앞 칸에만 앞 번호 복사본을 놓는다 (대칭 깨기).
  - 누명(frame) 대상은 끝(emit)에서 정하거나 채울 때 가지를 친다. 어느 쪽이든 아직 대상이 안 정해진 동안에는, 누명이 바꿀 수 있는 수 세기 진술을 미리 판정하지 않는다.
  - 진짜 증인 진술은 "참 / 거짓(lie) / 방패(shield)" 세 가능성을 기록하고, emit 에서 원천의 대상 조합으로 정확히 맞춘다.
  - 새 진술 모양은 참조 칸이 다 정해지면 판정한다 (clueRefs 에 추가. adjPair·halves·bossDir·bossRow 는 판 전체 또는 그 영역).
  - 내보내는 세계는 지금처럼 consistent 로 다시 확인한다.
- [ ] 5단계: npx vitest run src/core/solve.test.ts 통과 (CROSS_CASES 600). 이어서 npm run test:cross (3000) 통과.
- [ ] 6단계: 커밋 "feat(core): solver and brute force for duplicates, roster and new effects".

### 작업 3: 생성기와 유일해 검사

파일
- 고침: src/core/generate.ts, src/core/makeCase.ts, src/core/unique.ts
- 시험: src/core/generate.test.ts, src/core/makeCase.test.ts, src/core/unique.test.ts

인터페이스
- GenParams 에 boss: number 추가. trouble·accomplice·boss 는 인원 수이고 같은 직업이 2명까지 나올 수 있다(must 는 반드시 1명 이상).
- generateCase(p, seed): CaseDef | null. roster 는 실제 세계 직업별 인원(증인 포함).
  - 위장하는 칸의 겉 직업은 roster 에 1명 이상 있는 증인 직업 중에서 고른다. 없는 직업으로 위장하면 바로 들통난다.
- assignTaint(r, w, h, roles): number[]. effect 별 대상 규칙(작업 1 consistent). 대상이 겹치지 않게 고르고, 못 고르면 generateCase 가 null.
- makeClue(r, w, h, truth, cell, face): Clue | null. 말하는 방식 modeAt 에 따라 statementHolds(…) 가 참이 되는 값 중 무작위.
  - 대상 칸 고르기: alibi·accuse 는 자기 아닌 한 칸, sameSide·pairOne 은 자기 아닌 두 칸, atLeastOne 은 자기 아닌 세 칸.
  - bossDir 는 칸이 있는 방향만. bossRow 는 가로줄 r 을 무작위로 고르고 n 범위는 [0, min(w, roster 의 주범+대역 수)].
  - halves 의 n 은 {-1, 0, 1}, adjPair 는 {0, 1}. 허풍쟁이(over) 는 실제보다 큰 값 중(없으면 null).
- unique.ts
  - signature(world): 주범 칸 문자열 (칸마다 'b' 주범, '.' 나머지).
  - checkCase(def): 다 조사한 관찰 + G2 로 주범 자리가 하나. G2 의 답은 abilityTruth 로 계산.
  - solvedKnowledge(def): 주범 자리가 하나로 좁혀지는 능력 관찰을 더한 Knowledge.
- endlessParams(n): 아래 처음값. 작업 8 에서 생성 시간을 재고 조정할 수 있다.

```
판:     n ≤ 4 → 3×3, ≤ 10 → 3×4, ≤ 17 → 4×4, 그 뒤 4×5   (지금과 같음)
tier:   n ≤ 3 → 1, ≤ 7 → 2, ≤ 12 → 3, ≤ 18 → 4, 그 뒤 5   (지금과 같음)
주범:   n ≤ 8 → 1, ≤ 20 → 2, 그 뒤 3
공범:   n ≤ 2 → 0, ≤ 6 → 1, 그 뒤 2
말썽꾼: n ≤ 2 → 0, ≤ 8 → 1, ≤ 15 → 2, 그 뒤 3   (쓸 수 있는 말썽꾼 직업 수 상한 없음, 중복 허용)
```

- [ ] 1단계: 시험 먼저.

```
test('roster matches truth and includes witnesses')      // generateValid(endlessParams(10), s): sum(roster) === w*h, 직업별 수 = truth 칸 수
test('disguise faces come from witness roles in the roster')
test('duplicate roles appear')                           // 시드 몇 개 중 같은 직업 2명인 사건이 나온다 (p.accomplice 2, pool 에 공범 1종)
test('boss count follows params')                        // p.boss 2 → 주범 칸 2
test('taint targets never overlap')
test('makeClue bossDir never names an empty direction')  // 모서리 칸 0: up·left 안 나옴
test('makeClue braggart value is above the real count')
test('checkCase accepts when only boss cells are unique')// 공범 자리가 둘 가능해도 주범 자리가 하나면 ok
test('checkCase rejects when boss cell is ambiguous')
test('generated cases pass checkCase and truth is consistent') // 기존 시험 유지
```

- [ ] 2단계: npx vitest run src/core/generate.test.ts src/core/makeCase.test.ts src/core/unique.test.ts → 실패.
- [ ] 3단계: 구현.
- [ ] 4단계: 같은 명령 통과. 생성 시간 재기: tsx 로 endlessParams(30) 시드 10개 generateValid 시간을 logs/gen-time.txt 에 적는다. 중앙값 2초 이하가 목표. 넘으면 작업 8 에서 매개변수를 조정한다(작업 기록에 Ruling 으로 남김).
- [ ] 5단계: 커밋 "feat(core): generator and boss-only uniqueness".

### 작업 4: 힌트와 해설 (주범 기준)

파일
- 고침: src/core/types.ts (Claim), src/core/rules.ts (cellAdmits), src/core/explain.ts, src/core/game.ts (hintKnowledge 만)
- 시험: src/core/explain.test.ts

인터페이스
- types.ts: Claim = 'good' | 'evil' | 'boss' | 'notBoss' | 'accomplice'. Knowledge.knownSides 를 knownClaims?: (Claim | undefined)[] 로 바꾸고 rules.cellAdmits 도 그에 맞춘다.
- Step = { cell: number; claim: Claim; because: Fact[] | 'all'; usesEarlier: boolean }. side 는 없앤다.
- 칸의 꼬리표(label): 0 선, 1 공범, 2 주범. Claim 은 꼬리표 집합: good {0}, accomplice {1}, boss {2}, evil {1,2}, notBoss {0,1}.
- 세계 전부에서 칸의 꼬리표 집합이 위 다섯 중 하나면 그 Claim 이 "정해진" 것. {0,2} 는 단계로 쓰지 않는다.
- stepsFrom: 지금처럼 이유가 작은 것부터. 주범 칸이 모두 'boss' 단계로 증명되면 멈춘다.
- 배경(bg)은 칸마다 허용 꼬리표 비트(3비트)로 바꾼다. 반례 묶음 lists 는 칸 × 3 꼬리표.
- difficulty: 점수 규칙 그대로.
- nextHint(k): 지금과 같지만 knownClaims 를 쓴다. 이미 체포한 칸은 가리키지 않는다.
- game.hintKnowledge(g, proven: (Claim | undefined)[]): Knowledge. 겉 직업이 말썽꾼이면 'good'.

- [ ] 1단계: 시험 먼저 (기존 explain.test 는 claim 으로 고친다).

```
test('explain ends when every boss cell has a boss step')
test('a lone liar next to a decoy is proven accomplice only when needed')  // 시험 사건 하나 손으로 만들어 claim 확인
test('steps are proofs: each claim holds in every world')                 // 무한 사건 20개: 단계마다 solve 의 모든 세계에서 claim 성립
test('nextHint never points at an arrested cell')
test('two bosses: both get boss steps')
```

- [ ] 2단계: npx vitest run src/core/explain.test.ts → 실패.
- [ ] 3단계: 구현.
- [ ] 4단계: 통과. 커밋 "feat(core): hints and explanations aim at the boss".

### 작업 5: 게임 상태와 저장

파일
- 고침: src/core/game.ts, src/core/save.ts
- 시험: src/core/game.test.ts, src/core/save.test.ts

인터페이스
- Game 에 confessions: Confession[] 추가. Confession = { cell: number; decoy: boolean; col: number | null } (col 은 1부터, null 은 "아무것도 모르오").
- arrest(g, cell)
  - 주범: 평판 그대로. 선: 평판 -2. 공범: 평판 -1 + 자백.
  - 해결: 진짜 주범 칸이 모두 체포됨. 실패: 평판 0 이하 (해결이 먼저).
  - 시간 +1 그대로.
- 자백 고르기 (설계 4.5):
  - 남은 주범 = 아직 체포 안 된 진짜 주범(대역 아님). 없으면 자백을 만들지 않는다.
  - 거짓인가 = 공범 칸의 주변 8칸에 남은 주범이 있는가.
  - 후보 세로줄: 참이면 남은 주범이 있는 세로줄, 거짓이면 남은 주범이 없는 세로줄. 후보가 없으면 col null.
  - 고르기: 후보[hash4(seed, cell, 지금까지 체포한 칸 수, 7) % 후보 수].
  - decoy = 그 공범이 대역인가.
- knowledgeOf(g): roster 를 넣는다. 자백은 Knowledge 에 넣지 않는다 (힌트는 자백을 쓰지 않는다. 설계 4.5: 퍼즐은 자백 없이 풀림).
- Save: v 2. { v: 2; cleared: number[]; seenCards: string[]; endlessBest: number; endless?: { n; rep; seed } }. v1 을 읽으면 cleared·seenCards·endlessBest 만 옮기고 endless 는 버린다.

- [ ] 1단계: 시험 먼저.

```
test('solved when all bosses are arrested, accomplices may stay')
test('arresting an accomplice costs 1 and adds a confession')
test('arresting a good person costs 2, no confession')
test('confession lies when a remaining boss is within 8 neighbours')   // 고정 사건: 공범 옆 주범 → col 은 주범 없는 세로줄
test('confession tells the truth otherwise')
test('lying confession with no boss-free column says nothing (col null)')
test('no confession once every boss is caught')
test('same arrest order gives the same confession')
test('decoy confession is marked decoy')
test('v1 save migrates: keeps cleared, seenCards, endlessBest; drops endless')
```

- [ ] 2단계: npx vitest run src/core/game.test.ts src/core/save.test.ts → 실패.
- [ ] 3단계: 구현. 4단계: 통과. 5단계: 커밋 "feat(core): boss-hunt arrests, confessions, save v2".

### 작업 6: 문장 (증언·말하는 방식·해설·자백)

파일
- 고침: src/ui/clueText.ts, src/ui/speech.ts, src/core/explain.ts (describeStep)
- 시험: src/ui/clueText.test.ts, src/ui/speech.test.ts, src/core/explain.test.ts

인터페이스
- clueText(c, cell, w, h, face): string = 말머리 + " " + 사실. face 는 겉 직업 id (위장한 악인은 위장 직업의 말머리).
- abilityText(o, face): string, confessionText(cf: Confession, w, h): string.
- clueMarks(c, w, h): { cells: number[]; link?: [number, number] } (작업 7 이 쓴다. 증언이 가리키는 칸, 두 사람 관계면 link)
- 칸 목록은 1부터, 오름차순, "·" 로 잇고 끝에 "번". 예: "2·4·6·8번".
- 말머리 (직업마다 하나. 사실 정보 없음. {a}·{b} 는 대상 칸 번호):

```
우체부 "배달 돌며 봤어요."            약사 "약 사러 온 이웃 얘기예요."     이장 "반상회 명부 기준이에요."
경비원 "순찰 기록이에요."              택시 기사 "택시로 대각선 길을 달렸어요." 빵집 주인 "새벽 배달 길 기준이에요."
사진사 "사진을 현상해 봤어요."         신부 "고해를 들었어요."              이발사 "손님들 얘기를 들었어요."
세탁소 주인 "맡긴 옷들을 세어 봤어요." 개 주인 "개가 짖은 쪽이에요."        식당 주인 "{a}번은 밤새 우리 가게에 있었어요."
옆집 할머니 "{a}번이 밤마다 수상하게 나가던데."  전화 교환원 "{a}번과 {b}번은 밤마다 통화해요."
종지기 "종탑에서 봤어요."              기자 "취재해 보니"                   허풍쟁이 "내가 다 봤다니까!"
길치 "우리 집 근처 얘기예요."          소문쟁이 "들은 얘기예요~"
```

- 사실 문장 (n = 0 이면 괄호 안 문장):

```
evil4      상하좌우 {칸}번 중 악은 {n}명이에요. (… 중 악은 없어요.)
evil8      둘러싼 {칸}번 중 악은 {n}명이에요.
evilRow    같은 가로줄 {칸}번 중 악은 {n}명이에요.
evilCol    같은 세로줄 {칸}번 중 악은 {n}명이에요.
diag       대각선 {칸}번 중 악은 {n}명이에요.
nearest    가장 가까운 악은 상하좌우로 {n}칸 가야 있어요. (저 말고는 악이 없어요.)
pairOne    {a}번과 {b}번 중 정확히 1명이 악이에요.
atLeastOne {칸}번 중 적어도 1명은 악이에요.
adjPair    악끼리 상하좌우로 붙어 사는 집이 있어요. / 없어요.
halves     악은 왼쪽({L}번)보다 오른쪽({R}번)에 더 많아요. / 오른쪽보다 왼쪽에 … / 왼쪽({L}번)과 오른쪽({R}번)의 악 수가 같아요.
bossDir    위쪽 가로줄({칸}번)에 주범이 있어요. (아래쪽 가로줄 / 왼쪽 세로줄 / 오른쪽 세로줄)
alibi      {a}번은 선이에요.
accuse     {a}번은 악이에요.
sameSide   {a}번과 {b}번은 같은 편이에요.
bossRow    위에서 {r}번째 가로줄({칸}번)에 주범이 {n}명 있어요. (… 주범은 없어요.)
능력       {a}번과 {b}번은 같은 편이에요. / 다른 편이에요.
자백       자백: 주범 중 1명은 왼쪽에서 {c}번째 세로줄({칸}번)에 있소. (자백: 아무것도 모르오.) 대역이면 앞에 "나는 대역이었소. "
```

  - 길치의 칸 목록은 실제로 센 칸(옆집 기준)이다.
- speech.ts: 새 모양마다 참말일 때·거짓말일 때 범위 문장. 직업 창의 라벨은 지금 그대로. 허풍쟁이는 "실제보다 큰 수", 협박은 "주범을 선으로 치고 참말", 설계 4.4 의 "거짓이면" 열 내용을 쓴다.
- describeStep(step, def): "{칸}번은 {선|악|공범|주범|주범이 아님}: …" 뒤는 지금 문장 틀, 끝말은 "다른 경우는 맞지 않는다."

- [ ] 1단계: 시험 먼저. 위 표의 모든 모양마다 한 줄씩 기대 문장을 그대로 적는다. 예:

```
expect(clueText({ kind: 'evil4', base: 4, n: 1 }, 4, 3, 3, 'postman')).toBe('배달 돌며 봤어요. 상하좌우 2·4·6·8번 중 악은 1명이에요.')
expect(clueText({ kind: 'alibi', base: 4, a: 5 }, 4, 3, 3, 'restaurant')).toBe('6번은 밤새 우리 가게에 있었어요. 6번은 선이에요.')
expect(clueText({ kind: 'bossRow', base: 4, r: 2, n: 1 }, 4, 3, 3, 'bellringer')).toBe('종탑에서 봤어요. 위에서 2번째 가로줄(4·5·6번)에 주범이 1명 있어요.')
expect(confessionText({ cell: 0, decoy: true, col: 3 }, 3, 3)).toBe('자백: 나는 대역이었소. 주범 중 1명은 왼쪽에서 3번째 세로줄(3·6·9번)에 있소.')
expect(clueMarks({ kind: 'sameSide', base: 4, a: 2, b: 6 }, 3, 3)).toEqual({ cells: [2, 6], link: [2, 6] })
test('same sentence whatever the speaker’s true role')   // 같은 clue·face 면 문장이 같다 (진짜 직업은 인자로 받지 않는다)
```

  - 자백 문장은 위 예처럼 "자백: " 다음에 대역 문장이 온다 (표의 "앞에"는 사실 문장 앞).
- [ ] 2단계: 실패 확인. 3단계: 구현. 4단계: npx vitest run src/ui src/core/explain.test.ts 통과.
- [ ] 5단계: 커밋 "feat(ui): statements in each job's voice with explicit cells".

### 작업 7: 사건 화면

파일
- 새로: src/ui/roster.ts (+ roster.test.ts)
- 고침: src/ui/screens/caseScreen.ts, src/ui/screens/result.ts, src/ui/style.css, src/ui/endless.ts, src/ui/worker.ts(필요하면), src/tools/check-ui.mjs

인터페이스
- rosterRows(roster): { camp: Camp; label: string; total: number; items: { id: RoleId; name: string; count: number }[] }[]. 순서 주범 → 공범 → 말썽꾼 → 증인, 직업은 roles.ts 순서, 인원 0 은 빼고, 인원 0 진영은 빼지 않는다(주범은 늘 있음, 공범 0 이면 "공범 0").
- 화면
  - 사건을 처음 열면 인원표 오버레이(설계 4.2 모양, 서류철 종이). 버튼 "수사 시작". 사건 화면 위 메모를 누르면 다시 연다. 메모 한 줄: "주범 {잡은 수}/{총수} · 평판 {rep}".
  - 진술 기록 한 줄이나 칸의 진술을 누르면 clueMarks 의 칸에 빨간 동그라미(.mark), link 가 있으면 두 카드를 잇는 빨간 실(판 위 SVG 선). 다른 곳을 누르면 지운다.
  - 체포 도장: 주범 "주범 체포", 공범 "공범 체포", 선 "오인 체포".
  - 자백은 진술 기록에 .ln-confession 줄로, confessionText.
  - 결과 화면: 해결 조건 문구를 "주범을 모두 체포"로.
- check-ui.mjs 에 더할 확인 (기존 80개는 새 규칙에 맞게 고친다):
  - 인원표 오버레이가 뜨고 "수사 시작"으로 닫힌다, 메모를 누르면 다시 뜬다.
  - 진술 한 줄을 누르면 .mark 수 = 그 진술 칸 수, 관계 진술이면 빨간 실 하나.
  - 공범 체포 → "공범 체포" 도장과 .ln-confession 한 줄.
  - 주범만 다 체포하면 해결 화면.
  - 390×844 에서 인원표가 가로로 넘치지 않는다.

- [ ] 1단계: roster.test.ts 먼저 (순서, 0 빼기, 합계). 실패 확인.
- [ ] 2단계: roster.ts 구현, 통과.
- [ ] 3단계: 화면 구현. npm run dev 로 직접 보고, node src/tools/check-ui.mjs 통과 (스테이지가 아직 옛것이면 이 확인은 작업 8 뒤에 다시 돌린다. 이 작업에서는 무한 모드 사건으로 확인).
- [ ] 4단계: 커밋 "feat(ui): roster sheet, statement marks, boss-hunt stamps and confessions".

### 작업 8: 장 구성과 스테이지 다시 만들기

파일
- 고침: src/content/chapters.ts, src/tools/build-stages.ts, src/content/stages.json(생성), src/content/stages.test.ts, src/core/generate.ts(endlessParams 조정 시)

장 구성 (newRoles, 들어오는 순서)

```
1장 1~5   3×3        postman, pharmacist, grandma, chief, lookout
2장 6~10  3×3, 3×4   mayor, guard, restaurant, braggart, thief
3장 11~15 3×4        baker, photographer, taxi, lost, shill
4장 16~20 4×4        operator, priest, reporter, gossip, blackmailer, briber
5장 21~25 4×4        barber, laundry, dog, bellringer, decoy, shadow
6장 26~30 4×4, 4×5   framer
```

- 1장은 처음부터 다섯 직업 다 (주범 두목이 있어야 함). chapterPrefix 의 1장 예외 유지.
- 인원 [말썽꾼, 공범, 주범] (장 j, 장 안 k번째):

```
1장: [0, k ≤ 2 ? 0 : 1, 1]
2장: [k < 4 ? 0 : 1, 1, 1]
3장: [1, k < 4 ? 1 : 2, 1]
4장: [k < 4 ? 1 : 2, 2, k < 4 ? 1 : 2]
5장: [2, 2, 2]
6장: [k < 4 ? 2 : 3, 2, k < 4 ? 2 : 3]   (주범 3 은 4×5 에서만)
```

- must: 그 장의 새 직업 prefix 중 증인 아닌 것 전부 (주범도 여러 명이 되므로 "마지막 주범만" 규칙을 없앤다. must 가 인원보다 많으면 인원을 must 수로 올린다).
- 목표 난이도·하한은 지금 값 그대로 쓰고, 고를 후보가 없으면 TARGET 을 조정한다 (Ruling).

- [ ] 1단계: stages.test.ts 를 새 규칙으로 고친다:
  - 30개
  - 장마다 새 직업이 그 장에서 처음 나옴
  - 모든 사건이 checkCase 통과
  - 각 스테이지의 roster 합 = 칸 수
  - 1스테이지 GUIDE 가 가리키는 체포 칸이 주범 (작업 9 가 GUIDE 를 쓰므로, 이 항목은 작업 9 에서 켠다)
  - 실패 확인.
- [ ] 2단계: chapters.ts, build-stages.ts 고치고 npm run stages (한 프로세스, 시간을 logs/stages-build.txt 에 적는다).
- [ ] 3단계: 무한 모드 생성 시간 다시 재기(작업 3 의 측정). 중앙값 2초를 넘으면 endlessParams 의 공범·주범 수를 줄이고 다시 잰다.
- [ ] 4단계: npx vitest run src/content 통과. 커밋 "feat(content): chapters and stages for boss hunt".

### 작업 9: 튜토리얼·규칙·카드철·인물 사진·글꼴

파일
- 고침: src/content/tutorial.ts, src/ui/screens/rules.ts, src/ui/screens/codex.ts, src/ui/tutorialOverlay.ts, src/ui/portraits.ts, src/public/fonts/*(생성)
- 시험: src/ui/portraits.test.ts, src/content/stages.test.ts(GUIDE 항목 켜기), src/tools/glyphs.test.ts

할 것
- GUIDE 1·2: 새 1스테이지 사건 칸에 맞춰 다시 쓴다. 목표("주범을 모두 체포"), 인원표 읽기, 진술 누르면 칸 표시, 거짓말, 주범 체포 순서.
- ROLE_CARD: 28개 모두, 설계 4.4 문장. CONCEPT_CARD 에 '자백'(공범 체포 → 평판 -1 + 자백, 주변 8칸에 주범이 있으면 거짓 자백), '인원표' 추가, '오염' 문장을 바꿔치기·매수·협박·누명으로 고침.
- 규칙 화면: 목표, 진영 4개와 체포 결과 표(설계 4.1), 자백, 시간.
- 인물 사진 10장 새로: taxi, priest, barber, laundry, dog, restaurant, grandma, operator, decoy, framer. 숨은이·능청이 삭제. 지금 방식 그대로(뚜렷한 모자·머리·소품·바탕색, 악은 어두운 바탕).
  - node src/tools/contact-sheet.mjs 로 logs/portraits.png 를 만들어 직접 보고, 서로 닮은 둘이 있으면 고친다.
  - 다 되면 사용자에게 보낸다(SendUserFile).
- npm run fonts.

- [ ] 1단계: portraits.test 가 새 직업 사진 없음으로 실패하는 것 확인 (직업표가 이미 28개). stages.test 의 GUIDE 항목 켜고 실패 확인.
- [ ] 2단계: 구현. npm run fonts.
- [ ] 3단계: npm test 전체 통과.
- [ ] 4단계: 커밋 "feat(ui): tutorial, rules, codex and portraits for boss hunt".

### 작업 10: 전체 확인과 기록

- [ ] 1단계: npm run typecheck, npm test, npm run test:cross, npm run build, node src/tools/check-ui.mjs, node src/tools/check-offline.mjs 모두 통과. 결과를 logs/2026-11-24-boss-hunt-ledger.md 에 적는다.
- [ ] 2단계: README(현재 상태·실행·폴더 구조·시험 수), HISTORY(2026-11-24 항목), conversations/2026-11-24.md 에 덧붙인다. docs/2026-11-23-remaining-work.md 에서 이번에 없어진 항목(숨은이·능청이 관련)이 있으면 고친다.
- [ ] 3단계: 커밋 "docs: record boss-hunt stage 1".
- [ ] 4단계: 사건 화면·인원표·자백 스크린샷을 사용자에게 보내고, main 합치기·push 를 묻는다.
