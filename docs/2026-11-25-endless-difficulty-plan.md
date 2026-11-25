# 무한 모드 난이도 구현 계획

> For agentic workers: superpowers:executing-plans 로 작업 단위로 진행한다. 단계는 체크 상자로 표시한다.

목표: 무한 모드를 스테이지 4장 수준에서 시작하게 하고(3×3 없음), 쉬운 사건(난이도 낮음, 필요한 진술 칸 적음)을 거른다. 같은 사건 코드는 어느 기기에서나 같은 사건이다.

구조: 해설 계산에 시간이 아닌 "일의 양" 한도를 더하고(작업 1), 엔진 시험이 쓰던 예전 틀을 시험 도우미로 고정한 뒤 endlessParams 를 새 틀로 바꾸고(작업 2), 후보 여럿 중 기준을 넘는 첫 사건을 고르는 generateEndless 를 만들어 worker 가 쓰게 한다(작업 3). 마지막에 화면 확인·기록(작업 4).

기술: TypeScript, Vitest, puppeteer-core(check-ui).

설계: docs/2026-11-25-endless-difficulty-design.md

## 전체 제약

- 스테이지 30개(stages.json), 규칙, 진술 문장, 힌트, 저장 형식, 화면은 바꾸지 않는다.
- 같은 (n, 시드)는 늘 같은 사건: 사건 고르기에 performance.now·Date·Math.random 을 쓰지 않는다.
- 사건 코드의 seed 는 화면에 보이는 그 시드(돌려주는 def.seed = 받은 seed).
- 사건은 5초 안에 뜬다(check-ui "endless: case appears within 5 s"). 이 PC 에서 generateEndless 한 번이 n 마다 시드 20개 중 최대 2.5초 이하(폰은 몇 배 느리다).
- 판·말썽꾼·주범·악 수는 n 에 대해 줄지 않는다.
- 로컬 PC 는 코어 절반(10)까지. 커밋 메시지에 JIRA 번호 없음. push 는 따로 묻는다. md 문서에 인라인 코드·링크 서식 없음.
- 시험 명령: 단위 npm test (약 2분, 로그는 logs/ 에), 화면 node src/tools/check-ui.mjs, 타입 npm run typecheck, 빌드 npm run build, 오프라인 node src/tools/check-offline.mjs.

## 검토할 점

- 해설 일의 양 한도를 넘는 무거운 후보(4×5 주범 3, 모사꾼)가 연달아 나와 기준을 넘는 사건을 못 찾음 → 작업 3 의 "대부분의 시드가 기준을 넘음" 시험.
- 고르기가 기기 속도에 따라 달라짐(시간 한도가 남아 있음) → 작업 1 의 Budget 시험, 작업 3 의 같은 입력 같은 결과 시험.
- 이어 하기·사건 코드로 n 이 큰 사건을 열 때 너무 오래 걸림 → 작업 3 의 n = 13, 30 시간 시험.
- 엔진 시험(explain.test, generate.test)이 endlessParams 로 판을 골라 쓰고 있어 새 틀로 느려지거나 뜻이 바뀜 → 작업 2 에서 예전 틀을 시험 도우미로 고정.
- 시드만 넣은 사건 코드(숫자만)는 endlessParams(10) 을 쓴다(src/ui/seedCode.ts). 새 틀에서 4×5 가 된다 → 작업 4 의 check-ui 시드 확인을 4×5 로.

---

### Task 1 (작업 1): 일의 양 한도로 끊는 해설

Files:
- Modify: src/core/solve.ts (Budget, overBudget)
- Modify: src/core/explain.ts (explainWork 추가)
- Test: src/core/explain.test.ts

Interfaces:
- Produces: Budget 에 work?: number (남은 일의 양). overBudget 이 부를 때마다 1 씩 줄이고 0 아래면 expired. deadline 은 Infinity 로 두면 시간 한도 없음.
- Produces: explainWork(k: Knowledge, work: number): Step[] | null — explainWithin 과 같되 시간 대신 일의 양으로 끊는다. 다 못 하면 null.

- [ ] 1. 시험을 쓴다 (explain.test.ts):
  - "explainWork with enough work equals explain": endlessParams 대신 작업 2 의 도우미가 아직 없으므로 generateValid({ w: 3, h: 4, trouble: 1, accomplice: 1, boss: 1, pool: 1·2등급 직업 }, 5) 사건으로, explainWork(solvedKnowledge(def), 1e9) 가 explain(solvedKnowledge(def)) 와 같다(toEqual).
  - "explainWork with tiny work gives up": 같은 사건에서 explainWork(…, 1) 이 null.
  - "explainWork is deterministic": 4×4 주범 2 사건 하나에서, 결과가 null 이 아니면서 explain 과 다른 일의 양 W 를 찾아(작은 값부터 두 배씩) 같은 W 로 두 번 부른 결과가 같다.
- [ ] 2. npx vitest run src/core/explain.test.ts -t explainWork → FAIL (explainWork 없음).
- [ ] 3. Budget 에 work 를 더하고 overBudget 에서 줄인다. explainWork 는 deadline Infinity, work 로 Budget 을 만들어 explainWithin 과 같은 흐름.
- [ ] 4. npx vitest run src/core/explain.test.ts src/core/solve.test.ts → PASS (기존 힌트·해설 시험 그대로).
- [ ] 5. 커밋: "feat: work-limited explanation (device-independent budget)".

### Task 2 (작업 2): 새 틀과 엔진 시험용 예전 틀

Files:
- Modify: src/core/testcases.ts (legacyEndlessParams 추가)
- Modify: src/core/explain.test.ts, src/core/generate.test.ts (엔진 시험이 쓰던 endlessParams → legacyEndlessParams)
- Modify: src/core/generate.ts (endlessParams)
- Modify: src/tools/check-ui.mjs (무한 모드 판 크기 확인)

Interfaces:
- Produces: testcases.ts 의 legacyEndlessParams(n: number): GenParams — 지금 endlessParams 본문 그대로(시험 전용, 엔진 시험의 판 크기·속도를 지킨다).
- Produces: 새 endlessParams(n).

- [ ] 1. legacyEndlessParams 를 testcases.ts 에 옮겨 두고, explain.test.ts 와 generate.test.ts 의 endlessParams 호출 중 "endlessParams:" 로 시작하는 시험 밖의 것을 모두 legacyEndlessParams 로 바꾼다. npx vitest run src/core → PASS (바뀐 것 없음 확인).
- [ ] 2. generate.test.ts 의 "endlessParams: n=1 start, n>=25 cap, monotone" 을 새 틀로 바꾼다:
  - n = 1: [w, h, trouble, accomplice, boss] = [4, 4, 2, 2, 1], pool 은 3등급 이하만.
  - n = 4: boss 2. n = 8: [4, 5]. n = 13, 25, 40: [4, 5, 3, 1, 3], pool 28.
  - n = 2 ~ 30 단조 검사는 그대로.
- [ ] 3. check-ui: "seed play: 3x4 grid or larger (endlessParams(10))" 를 "seed play: 4x5 grid (endlessParams(10))" 로 (def15.w * def15.h === 20), 무한 모드 "1st case" 확인 뒤에 "endless: first case is 4x4 or larger" (def1.w * def1.h >= 16) 를 더한다.
- [ ] 3b. npx vitest run src/core/generate.test.ts -t endlessParams → FAIL. node src/tools/check-ui.mjs → 위 두 확인 FAIL (3×4, 3×3).
- [ ] 4. endlessParams 를 바꾼다: 1 ~ 3 은 4×4 (말썽꾼 2, 공범 2, 주범 1), 4 ~ 7 은 4×4 (2, 2, 2), 8 ~ 12 는 4×5 (2, 2, 2), 13 부터 4×5 (3, 1, 3). 등급은 1 ~ 3 → 3, 4 ~ 5 → 4, 6 부터 5. 함수 위 주석을 새 틀에 맞게 고친다.
- [ ] 5. npx vitest run src/core → PASS. "endless generation is fast enough"(generateValid, 2초) 가 새 틀에서도 통과하는지 본다. node src/tools/check-ui.mjs → 전체 OK.
- [ ] 6. 커밋: "feat: endless starts at chapter-4 level (no 3x3)".

### Task 3 (작업 3): 쉬운 사건 거르기

Files:
- Create: src/core/endless.ts
- Test: src/core/endless.test.ts
- Modify: src/core/generate.ts (trySeed 를 export)
- Modify: src/ui/worker.ts (generate 요청이 generateEndless 를 쓴다)
- Output: logs/endless-probe/after.txt (측정)

Interfaces:
- Consumes: explainWork (작업 1), endlessParams (작업 2), difficulty (explain.ts), solvedKnowledge (unique.ts), generateValid·trySeed (generate.ts).
- Produces: generateEndless(n: number, seed: number): CaseDef — 같은 (n, seed) 는 같은 사건, def.seed = seed.
- Produces: caseScore(steps: Step[], cells: number): { difficulty: number; statementCells: number } — statementCells 는 단계 because 에 나온 칸 수(겹침 빼고), because 가 'all' 인 단계가 있으면 cells(판 칸 수).

고르기 (generateEndless)
- 후보 c = 0, 1, … , CANDIDATES - 1. 후보 c 의 사건은 generateValid(endlessParams(n), c === 0 ? seed : trySeed(seed, 1000 + c)) 에 seed 를 다시 붙인 것.
- 후보마다 explainWork(solvedKnowledge(def), WORK). null 이면 그 후보는 잴 수 없어 건너뛴다.
- 난이도 ≥ MIN_DIFFICULTY 이고 statementCells ≥ MIN_CELLS 인 첫 후보를 낸다.
- 없으면 잰 후보 중 (difficulty, statementCells) 가 가장 큰 것, 잰 후보가 하나도 없으면 후보 0.

- [ ] 1. 측정으로 값 정하기: logs/endless-probe/probe.ts 를 새 틀·explainWork 로 고쳐 n = 1, 4, 8, 13, 30 마다 시드 20개를 재고(후보 하나당 난이도, 진술 칸, 생성·해설 시간, explainWork 가 null 이 되는 비율) logs/endless-probe/after.txt 에 남긴다. 여기서 MIN_DIFFICULTY(설계: 3), MIN_CELLS(설계: 5쯤), WORK, CANDIDATES 를 정한다: 기준 통과 후보가 n 마다 절반 이상이 되게, generateEndless 한 번이 이 PC 에서 2.5초를 넘지 않게. 정한 값과 이유를 endless.ts 상수 주석에 적는다.
- [ ] 2. 시험을 쓴다 (endless.test.ts):
  - "caseScore counts statement cells and treats all as the whole board": 손으로 만든 Step 몇 개(because [0, 2], [2, 5], 'all' 없는 경우 → 3, 'all' 있는 경우 → cells).
  - "same n and seed give the same case": n = 1, 13 에서 generateEndless 두 번 → toEqual.
  - "case keeps the seed it was asked for": generateEndless(5, 4242).seed === 4242.
  - "most seeds clear the floor": n = 1, 4, 8, 13 마다 시드 8개, caseScore 가 기준을 넘는 사건이 n 마다 7개 이상.
  - "endless case generation stays under the time limit": n = 1, 13, 30 마다 시드 3개, 한 번에 2500 × TIME_SCALE ms 미만.
- [ ] 3. npx vitest run src/core/endless.test.ts → FAIL (endless.ts 없음).
- [ ] 4. endless.ts 를 쓰고 generate.ts 의 trySeed 를 export. worker.ts 의 generate 요청을 generateEndless(req.n, req.seed) 로.
- [ ] 5. npx vitest run src/core/endless.test.ts → PASS. npm test (백그라운드, logs/2026-11-25-endless-test.log) → 전체 PASS.
- [ ] 6. 커밋: "feat: endless skips easy cases (difficulty and statement-cell floor)".

### Task 4 (작업 4): 화면 확인과 기록

Files:
- Modify: README.md, HISTORY.md, conversations/2026-11-25.md

- [ ] 1. node src/tools/check-ui.mjs → 전체 OK (generateEndless 를 쓰는 worker 로). "endless: case appears within 5 s" 의 걸린 시간을 기록.
- [ ] 2. npm run typecheck, npm run build, node src/tools/check-offline.mjs → 통과.
- [ ] 3. README 현재 상태, HISTORY 항목(바꾼 틀, 기준값, 측정 before/after 위치, 시험 수, check-ui 수), 대화 요약.
- [ ] 4. 커밋: "docs: record endless difficulty pass".
