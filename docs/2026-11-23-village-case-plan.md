# 마을 수사록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 격자 용의자를 조사해 공범·주범을 체포하는 1인 추리 퍼즐 웹게임(스테이지 30 + 무한 모드)을, 사건마다 답이 정확히 하나임을 솔버로 보장하며 만든다.

**Architecture:** src/core 는 DOM 없는 순수 로직(격자, 직업 규칙, 솔버 2개, 유일해 검사, 생성기, 해설, 게임 상태)이고 Vitest 로 시험한다. src/ui 는 프레임워크 없는 DOM 화면이며 무한 모드 사건 생성은 Web Worker 에서 돈다. 스테이지 30개는 빌드 전에 스크립트로 만들어 JSON 으로 고정한다.

**Tech Stack:** TypeScript, Vite, Vitest, tsx(스크립트 실행), vite-plugin-pwa, puppeteer-core(화면 확인), GitHub Actions + GitHub Pages. Node 24(시스템 Node, conda 아님).

**Spec:** docs/2026-11-23-village-case-design.md

## Global Constraints

- 원작(Dupery) 직업의 이름·능력을 쓰지 않는다. 직업은 설계 6장의 20개만.
- 모든 사건(스테이지·무한)은 G1·G2·G3(설계 5.2)를 통과해야 한다. 통과 못 한 사건은 화면에 나오지 않는다.
- 진영 이름 화면 표기: 증인 · 말썽꾼 · 공범 · 주범. 칸 번호 표기는 1부터.
- 화면 기준 390×844 세로. PC 는 가운데 같은 폭. 오프라인 동작(PWA).
- 평판 시작 10, 선 체포 -2, 무한 모드 사건 해결 +1(최대 10). 조사 2시간, 체포 1시간, 능력 0시간.
- 한 사건에 대상 고르는 능력(기자 겉 직업)은 2개까지.
- .gitignore 에 처음부터 conversations/raw/ 를 넣는다(대화 원문이 공개 레포 이력에 들어가면 안 된다).
- 커밋 메시지·브랜치에 JIRA 번호를 넣지 않는다. git push 와 레포 생성은 사용자에게 묻고 "push 하라"는 답을 받은 뒤에만.
- 이 문서와 README·HISTORY 같은 md 에는 인라인 코드 서식을 쓰지 않는다.

## Review Focus

1. 무한 모드 사건 생성이 폰에서 오래 걸려 화면이 멈춘다 → Worker 에서 돌고, node 기준 사건 하나 1초 이하여야 한다. (Task 4 시험)
2. 조사가 덜 된 상태나 경우의 수가 너무 많은 상태에서 힌트를 누른다 → 멈추거나 비지 않고 "조사할 칸"을 알려 준다. (Task 5 시험)
3. 이미 체포한 칸 조사, 능력 두 번 쓰기, 끝난 사건에서 행동 같은 잘못된 행동 → 상태가 그대로이고 오류가 나지 않는다. (Task 6 시험)
4. 깨졌거나 옛 형식인 저장 데이터 → 기본 저장으로 시작하고 멈추지 않는다. (Task 6 시험)
5. 지하철에서 신호 없이 연다 → 한 번 열었던 폰에서는 오프라인으로 뜬다. (Task 10 빌드 확인 + 폰 비행기 모드 확인)

## 파일 구조

```
village_case_261123/
├── package.json, tsconfig.json, vite.config.ts, .gitignore
├── .github/workflows/pages.yml
├── src/
│   ├── index.html
│   ├── core/
│   │   ├── types.ts        공용 타입
│   │   ├── board.ts        격자 기하 (이웃·둘레·줄·걸음)
│   │   ├── rng.ts          시드 난수
│   │   ├── roles.ts        직업 20개 정의 + 조정값
│   │   ├── rules.ts        진술 사실 계산, 말하는 방식(참·거짓), consistent()
│   │   ├── solve.ts        주 솔버 (백트래킹)
│   │   ├── brute.ts        검증 솔버 (전수 조사)
│   │   ├── unique.ts       G1·G2·G3 검사
│   │   ├── generate.ts     사건 생성 + 무한 모드 진행 곡선
│   │   ├── explain.ts      단계 솔버: 해설·난이도·힌트
│   │   ├── game.ts         한 판 상태와 행동
│   │   └── save.ts         저장
│   ├── content/
│   │   ├── chapters.ts     6장 정의
│   │   ├── stages.json     생성된 스테이지 30개 (Task 7 이 만듦)
│   │   └── tutorial.ts     안내 단계·설명 카드 문장
│   ├── ui/                 화면 (Task 8·9)
│   └── tools/
│       ├── build-stages.ts 스테이지 생성 스크립트
│       └── check-ui.mjs    헤드리스 화면 확인
├── logs/                   화면 확인 스크린샷
└── (README.md, HISTORY.md, docs/, conversations/ 는 이미 있음)
```

시험 파일은 모듈 옆에 둔다(예: src/core/board.test.ts).

---

### Task 1: 프로젝트 뼈대 + 격자 + 난수

**Files:**
- Create: package.json, tsconfig.json, vite.config.ts, .gitignore, src/index.html, src/core/board.ts, src/core/rng.ts
- Test: src/core/board.test.ts, src/core/rng.test.ts

**Interfaces:**
- Produces:

```ts
// board.ts — 칸 번호는 내부 0부터, 왼→오, 위→아래
export function idx(w: number, x: number, y: number): number
export function xy(w: number, i: number): [number, number]
export function nbr4(w: number, h: number, i: number): number[]   // 상하좌우
export function nbr8(w: number, h: number, i: number): number[]   // 둘레
export function rowOf(w: number, h: number, i: number): number[]  // 같은 가로줄, i 제외
export function colOf(w: number, h: number, i: number): number[]  // 같은 세로줄, i 제외
export function steps(w: number, a: number, b: number): number    // 맨해튼 거리
// rng.ts
export type Rng = () => number                   // [0,1)
export function makeRng(seed: number): Rng       // mulberry32
export function randInt(r: Rng, lo: number, hi: number): number  // 양끝 포함
export function pick<T>(r: Rng, xs: readonly T[]): T
export function shuffle<T>(r: Rng, xs: readonly T[]): T[]       // 새 배열
```

- [ ] **Step 1: 뼈대.** git init, npm init. devDependencies: typescript, vite, vitest, tsx. vite.config.ts 는 root 'src', build.outDir '../dist', base '/village-case/'. scripts: dev, build, test(vitest run), stages(tsx src/tools/build-stages.ts). .gitignore: node_modules/, dist/, conversations/raw/, logs/.
- [ ] **Step 2: 실패하는 시험 작성**

```ts
test('nbr8 center of 3x3 has 8, corner has 3', () => {
  expect(nbr8(3, 3, 4).sort()).toEqual([0,1,2,3,5,6,7,8]);
  expect(nbr8(3, 3, 0).sort()).toEqual([1,3,4]);
});
test('nbr4 corner of 4x5 has 2', () => expect(nbr4(4, 5, 0).sort()).toEqual([1,4]));
test('rowOf/colOf exclude self', () => {
  expect(rowOf(4, 3, 5)).toEqual([4,6,7]);
  expect(colOf(4, 3, 5)).toEqual([1,9]);
});
test('steps is manhattan', () => expect(steps(4, 0, 11)).toBe(5));   // (0,0)→(3,2)
test('same seed same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test('shuffle keeps elements', () =>
  expect(shuffle(makeRng(1), [1,2,3,4]).sort()).toEqual([1,2,3,4]));
```

- [ ] **Step 3: npx vitest run 으로 실패 확인** (모듈 없음)
- [ ] **Step 4: board.ts, rng.ts 구현**
- [ ] **Step 5: npx vitest run → PASS, npm run build → dist 생성 확인**
- [ ] **Step 6: 커밋** "chore: scaffold project with grid geometry and seeded rng"

---

### Task 2: 타입, 직업 20개, 규칙

**Files:**
- Create: src/core/types.ts, src/core/roles.ts, src/core/rules.ts
- Test: src/core/rules.test.ts

**Interfaces:**
- Consumes: board.ts 전부.
- Produces:

```ts
// types.ts
export type Camp = 'witness' | 'trouble' | 'accomplice' | 'boss';
export type RoleId = string;
export const ANY_WITNESS = '*w';          // 직업을 모르는 진짜 증인
export type Mode = 'true' | 'false' | 'any';
export type ClueKind = 'evil4' | 'evil8' | 'evilRow' | 'evilCol' | 'nearest' | 'pairOne' | 'bossRow';
export interface Clue { kind: ClueKind; base: number; n?: number; a?: number; b?: number }
export interface RoleDef {
  id: RoleId; name: string; camp: Camp; tier: 1|2|3|4|5; desc: string;
  clue?: ClueKind;              // 이 직업이 겉 직업일 때 진술 형식
  ability?: 'pairSame';         // 이 직업이 겉 직업일 때 능력
  trigger?: number;             // 진술이 공개되는 경과 시간
  mode?: Mode;                  // 진짜 직업일 때 말하는 방식. 기본: 증인 'true', 공범·주범 'false'
  face?: 'self' | 'witness';    // 기본: 증인·말썽꾼 'self', 공범·주범 'witness'
  taint?: 'adj4' | 'any';
  place?: 'bossIn8';
  hiddenFromCounts?: boolean;   // 그림자
  shift?: 'right';              // 길치
  weight: number;               // 생성 가중치 (조정값)
}
export interface World { roles: RoleId[]; taint: number[] }   // taint[i] = i 칸 오염원의 대상 칸, 아니면 -1
export interface AbilityObs { cell: number; a: number; b: number; same: boolean }
export interface Knowledge {
  w: number; h: number;
  inPlay: RoleId[];                      // 이번 사건의 말썽꾼·공범·주범 직업 전부, 각 정확히 1번
  faces: (RoleId | undefined)[];         // undefined = 조사 안 함
  clues: (Clue | null)[];                // 보이는 진술 (없으면 null)
  abilities: AbilityObs[];
  arrested: (RoleId | undefined)[];      // 체포로 드러난 진짜 직업
  knownCamps?: (Camp | undefined)[];     // 해설용: 이미 추리한 진영
}
export interface CaseDef {
  seed: number; w: number; h: number;
  truth: World; faces: RoleId[]; clues: (Clue | null)[]; inPlay: RoleId[];
}
// roles.ts
export const ROLES: Record<RoleId, RoleDef>
export function role(id: RoleId): RoleDef      // ANY_WITNESS 는 camp 'witness' 인 가짜 정의
export function isEvil(c: Camp): boolean
// rules.ts
export function campAt(world: World, i: number): Camp
export function modeAt(world: World, i: number): Mode          // 오염 반영
export function clueFact(w: number, h: number, world: World, c: Clue): boolean
export function pairSameFact(world: World, a: number, b: number): boolean
export function abilityAnswer(def: CaseDef, cell: number, a: number, b: number): boolean
export function consistent(k: Knowledge, world: World): boolean
```

직업 id 와 설계 6장 대응(이름·능력은 설계 그대로):

```
증인   postman 우체부 evil4 · pharmacist 약사 evil8 · mayor 이장 evilRow · guard 경비원 evilCol
       baker 빵집 주인 nearest · photographer 사진사 pairOne · reporter 기자 ability pairSame
       bellringer 종지기 bossRow trigger 12
말썽꾼 braggart 허풍쟁이 (clue evil8, mode false) · lost 길치 (clue evil8, shift right)
       gossip 소문쟁이 (진술 없음, taint adj4) · hidden 숨은이 (face witness, mode true)
공범   thief 좀도둑 · blackmailer 협박꾼 taint adj4 · lookout 망보기 place bossIn8
       shill 바람잡이 mode true · smooth 능청이 mode any
주범   chief 두목 · shadow 그림자 hiddenFromCounts · briber 매수왕 taint any
```

규칙에서 정할 값(설계 4장):
- Clue.base 는 세는 기준 칸. 보통 말하는 칸, 길치는 오른쪽 칸(없으면 왼쪽). 기준 칸 자신은 세지 않는다.
- evil4·evil8·evilRow·evilCol: 기준 칸의 범위 안에서 공범·주범 수 = n. nearest: 기준 칸에서 가장 가까운 공범·주범까지 걸음 = n, 없으면 n = 0. 이 다섯 가지에서 그림자는 세지 않는다.
- pairOne: a·b 중 정확히 한 명이 공범·주범(그림자도 악). bossRow: 주범의 가로줄 번호(1부터) = n.
- modeAt: 진짜 직업이 증인이고 어떤 오염원의 taint 대상이면 'false'. 아니면 직업의 mode(기본값 규칙).
- consistent 가 확인할 것: inPlay 직업이 각 정확히 한 칸, 나머지 칸은 증인. 겉 직업 규칙(face). arrested 와 진짜 직업 일치. knownCamps 일치. 배치 규칙(망보기 둘레 8칸에 주범). 오염: 오염원마다 대상이 자격 있는 진짜 증인(adj4 는 이웃 4칸 안)이고, 자격자가 있으면 반드시 하나, 없으면 -1. 보이는 진술마다 mode 가 'any' 이거나 clueFact === (mode === 'true'). 능력 관찰마다 같은 방식으로 pairSameFact 대조(말하는 칸은 cell).
- abilityAnswer: 실제 세계 truth 에서 cell 의 mode 로 답. 'any' 면 hash(seed, cell, a, b) 의 짝홀로 정한다(같은 질문엔 같은 답).

- [ ] **Step 1: 실패하는 시험 작성** — 손으로 그린 3×3 세계로 직업마다 하나 이상:

```ts
// 3x3, 0 = 좀도둑(thief), 8 = 두목(chief), 나머지 증인
const W: World = { roles: ['thief','*w','*w','*w','*w','*w','*w','*w','chief'], taint: Array(9).fill(-1) };
test('evil8 from center counts 2', () => expect(clueFact(3,3,W,{kind:'evil8',base:4,n:2})).toBe(true));
test('evil4 from 1 counts thief only', () => expect(clueFact(3,3,W,{kind:'evil4',base:1,n:1})).toBe(true));
test('nearest from 4 is 2 steps', () => expect(clueFact(3,3,W,{kind:'nearest',base:4,n:2})).toBe(true));
test('bossRow is 3', () => expect(clueFact(3,3,W,{kind:'bossRow',base:4,n:3})).toBe(true));
test('pairOne 0 and 1', () => expect(clueFact(3,3,W,{kind:'pairOne',base:4,a:0,b:1})).toBe(true));
test('shadow not counted by evil8 but evil for pairOne', () => {
  const S = { ...W, roles: W.roles.map((r,i)=> i===8 ? 'shadow' : r) };
  expect(clueFact(3,3,S,{kind:'evil8',base:4,n:1})).toBe(true);
  expect(clueFact(3,3,S,{kind:'pairOne',base:4,a:8,b:1})).toBe(true);
});
test('tainted witness lies, evil lies, shill tells truth, smooth any', () => {
  const T: World = { roles: ['thief','*w','*w','gossip','*w','*w','*w','*w','chief'], taint: [-1,-1,-1,4,-1,-1,-1,-1,-1] };
  expect(modeAt(T,4)).toBe('false');
  expect(modeAt(T,0)).toBe('false');
  expect(modeAt({ ...W, roles: W.roles.map((r,i)=> i===0 ? 'shill' : r) },0)).toBe('true');
  expect(modeAt({ ...W, roles: W.roles.map((r,i)=> i===0 ? 'smooth' : r) },0)).toBe('any');
});
test('consistent rejects lookout far from boss', () => { /* lookout 0, chief 8 → false */ });
test('consistent rejects gossip with eligible neighbour but taint -1', () => { /* … → false */ });
test('consistent rejects inPlay role placed twice or missing', () => { /* … */ });
test('consistent accepts disguised thief whose false clue is false', () => { /* … → true */ });
```

(주석으로 둔 네 시험도 같은 방식으로 세계와 Knowledge 를 손으로 만들어 기대값을 단다.)

- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: types.ts, roles.ts(20개 + 한국어 desc 1 ~ 2줄 + weight 기본 1), rules.ts 구현**
- [ ] **Step 4: 실행해 PASS**
- [ ] **Step 5: 커밋** "feat: add role definitions and clue rules"

---

### Task 3: 주 솔버(백트래킹) + 검증 솔버(전수 조사)

**Files:**
- Create: src/core/solve.ts, src/core/brute.ts, src/core/testcases.ts (시험용 무작위 사건·관찰 만들기)
- Test: src/core/solve.test.ts

**Interfaces:**
- Consumes: Knowledge, World, consistent, clueFact, modeAt, role.
- Produces:

```ts
// solve.ts
export const WORLD_CAP = 20000;
export function forEachWorld(k: Knowledge, visit: (w: World) => boolean | void): void  // visit 이 true 면 중단
export function solve(k: Knowledge, cap = WORLD_CAP): { worlds: World[]; capped: boolean }
export function worldKey(w: World): string     // 비교용 정규 문자열
// brute.ts
export function solveBrute(k: Knowledge): World[]
// testcases.ts
export function randomTruth(r: Rng, w: number, h: number, inPlay: RoleId[]): World
export function randomKnowledge(r: Rng, truth: World, w: number, h: number): Knowledge  // 일부 조사, 일부 체포, 진술은 truth 기준
export function randomInPlay(r: Rng, max: number): RoleId[]       // 말썽꾼 0~1, 공범 1~2, 주범 1, 합 max 이하
export function normalize(truth: World, k: Knowledge): World      // 조사 안 한 진짜 증인 → ANY_WITNESS
export function emptyKnowledge(w: number, h: number, inPlay: RoleId[]): Knowledge
export function emptyKnowledgeOf(def: CaseDef): Knowledge         // 아무것도 조사 안 한 상태
```

세계 표현 규칙(두 솔버가 같아야 비교가 됨): 진짜 증인 칸의 roles 값은 조사했으면 겉 직업 id, 안 했으면 ANY_WITNESS. 숨은이·공범·주범은 직업 id. taint 는 오염원 칸에만 대상 칸.

solveBrute 는 단순해야 한다: inPlay 직업을 칸에 넣는 모든 단사 배치 × 모든 오염 대상 조합을 만들고 consistent() 로 거른다. 3×4 이하, inPlay 4개 이하에서만 쓴다.

solve 의 알고리즘(시험이 정하지 않는 부분):
- 칸 순서대로 진짜 직업을 정한다. 칸의 후보: 겉 직업이 말썽꾼(self)이면 그 직업만, 겉 직업이 증인 직업이면 {그 증인, 남은 숨은이·공범·주범}, 조사 안 했으면 {ANY_WITNESS, 남은 inPlay 전부}. 체포된 칸은 드러난 직업만. 남은 칸 수보다 남은 inPlay 가 많으면 버린다.
- 진술은 참조 칸이 다 정해지는 순간 사실값을 계산한다. 말하는 칸이 오염될 수 없는 직업(증인이 아님)이면 바로 mode 와 대조해 버린다.
- 말하는 칸이 진짜 증인이면 바로 판정하지 않고 "틀린 진술 수"를 센다(능력 관찰도 같음). 틀린 진술을 한 증인은 반드시 오염된 것이므로, 서로 다른 오염 대상 수가 inPlay 의 오염원 수보다 많아지면 버린다. adj4 오염원만 있으면 틀린 증인이 그 오염원 이웃 4칸에 들 수 있는지도 본다.
- 끝까지 채운 뒤 오염 대상 조합을 정확히 맞춰(틀린 증인 집합 = 오염된 증인 중 진술이 보이는 쪽) 세계를 내보낸다. 내보내기 전 consistent() 로 한 번 더 확인한다.

- [ ] **Step 1: 실패하는 시험 작성**

```ts
test('backtracking equals brute force on 3000 random small cases', () => {
  const r = makeRng(7);
  for (let t = 0; t < 3000; t++) {
    const [w, h] = pick(r, [[3,3],[3,4],[4,3]] as const);
    const inPlay = randomInPlay(r, 4);           // 말썽꾼 0~1, 공범 1~2, 주범 1, 최대 4
    const truth = randomTruth(r, w, h, inPlay);
    const k = randomKnowledge(r, truth, w, h);
    const a = solve(k).worlds.map(worldKey).sort();
    const b = solveBrute(k).map(worldKey).sort();
    expect(a, `seed-iter ${t}`).toEqual(b);
    expect(a).toContain(worldKey(normalize(truth, k)));   // 실제 세계는 항상 들어 있다
  }
});
test('cap stops enumeration', () => {
  const k = emptyKnowledge(4, 5, ['gossip','thief','blackmailer','lookout','chief']);
  const res = solve(k, 50);
  expect(res.capped).toBe(true);
  expect(res.worlds.length).toBe(50);
});
```

- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: brute.ts, testcases.ts 구현 → 그다음 solve.ts 구현**
- [ ] **Step 4: 실행해 PASS.** 다르게 나온 반복이 있으면 그 Knowledge 를 고정 시험으로 추가하고 고친다.
- [ ] **Step 5: 커밋** "feat: add backtracking solver cross-checked against brute force"

---

### Task 4: 유일해 검사(G1·G2·G3) + 사건 생성기

**Files:**
- Create: src/core/unique.ts, src/core/generate.ts
- Test: src/core/unique.test.ts, src/core/generate.test.ts

**Interfaces:**
- Consumes: solve, WORLD_CAP, campAt, modeAt, pairSameFact, clueFact, makeRng/pick/shuffle/randInt, ROLES.
- Produces:

```ts
// unique.ts
export function signature(w: World): string                     // 칸마다 진영 문자
export function fullKnowledge(def: CaseDef): Knowledge          // 전부 조사, 시각 계기 공개, 능력·체포 없음
export type CheckResult = { ok: true; signature: string } | { ok: false; reason: 'ambiguous' | 'tooMany' | 'truthMismatch' }
export function checkCase(def: CaseDef): CheckResult
export function abilityCells(def: CaseDef): number[]            // 겉 직업에 능력이 있는 칸
// generate.ts
export interface GenParams { w: number; h: number; trouble: number; accomplice: number; pool: RoleId[]; must?: RoleId[] }
export function generateCase(p: GenParams, seed: number): CaseDef | null     // 한 번 시도, 실패면 null
export function generateValid(p: GenParams, seed: number, maxTries?: number): CaseDef  // 기본 500, 못 찾으면 throw
export function endlessParams(n: number): GenParams             // n = 1부터
```

checkCase 알고리즘(G2 는 세계 목록을 나누는 방식으로, 다시 풀지 않는다):

```
worlds = solve(fullKnowledge(def)); capped 면 'tooMany'
ok = g2(worlds, abilityCells(def))
g2(ws, cells):
  모든 ws 의 signature 가 같으면 true
  cells 가 비었으면 false
  cells 의 각 c, 모든 대상 쌍 (a<b, a,b ≠ c) 에 대해:
    ws 를 답(same true/false)으로 나눈다. 세계 w 에서의 답은 modeAt(w,c) 가
    'true' 면 pairSameFact, 'false' 면 그 반대, 'any' 면 양쪽 모두에 넣는다
    비지 않은 모든 묶음이 g2(묶음, cells - c) 이면 true
  false
ok 가 아니면 'ambiguous'. ok 인데 유일 signature ≠ signature(truth) 이면 'truthMismatch'
```

generateCase 가 할 일: pool 과 must 에서 말썽꾼 trouble 명, 공범 accomplice 명, 주범 1명을 weight 로 뽑는다(must 는 반드시 포함, 직업마다 한 번). 배치 규칙(망보기)을 지키게 섞어 놓는다. 나머지 칸은 pool 의 증인 직업을 weight 로(중복 허용). 위장 겉 직업은 pool 의 증인 직업 중 무작위. 오염 대상을 규칙대로 정한다. 진술은 truth 와 말하는 방식에 맞게: 참이면 실제 값, 거짓이면 가능한 범위(evil4 0..이웃수, evil8 0..둘레수, evilRow 0..w-1, evilCol 0..h-1, nearest 0..w+h-2, bossRow 1..h)에서 실제와 다른 값, pairOne 은 맞는 쌍을 고른다, 'any' 는 동전. 기자 겉 직업이 2칸을 넘으면 null. 마지막에 checkCase 가 ok 일 때만 돌려준다.

endlessParams: n 이 오를수록 격자 3×3 → 3×4 → 4×4 → 4×5, 공범 1 → 4, 말썽꾼 0 → 3, pool 은 tier 상한을 올려 20개 전부. 정확한 곡선은 만드는 사람이 정한다(n = 1 은 3×3·공범 1·말썽꾼 0·tier 1, n ≥ 25 는 상한).

- [ ] **Step 1: 실패하는 시험 작성**

```ts
test('hand-made ambiguous case is rejected', () => {
  // 3x3, 좀도둑 1 + 두목 1, 모두 약사로 보이고 진술이 대칭이라 두 배치가 다 맞는 사건을 손으로 만든다
  expect(checkCase(AMBIGUOUS)).toEqual({ ok: false, reason: 'ambiguous' });
});
test('case that needs the reporter is accepted only with the ability', () => {
  expect(checkCase(NEEDS_REPORTER).ok).toBe(true);
  expect(checkCase(withoutReporter(NEEDS_REPORTER)).ok).toBe(false);
});
test('generated cases: truth consistent, unique, matches truth', () => {
  for (let n = 1; n <= 30; n++) for (let s = 0; s < 5; s++) {
    const def = generateValid(endlessParams(n), n * 1000 + s);
    expect(consistent(fullKnowledge(def), def.truth)).toBe(true);
    const res = checkCase(def);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.signature).toBe(signature(def.truth));
    expect(abilityCells(def).length).toBeLessThanOrEqual(2);
  }
});
test('same seed same case', () =>
  expect(generateValid(endlessParams(10), 99)).toEqual(generateValid(endlessParams(10), 99)));
test('must roles always present', () => {
  const def = generateValid({ w:3, h:4, trouble:1, accomplice:2, pool: ['postman','pharmacist','mayor','guard','baker','photographer','braggart','lost','thief','blackmailer','lookout','chief'], must: ['blackmailer','lost'] }, 5);
  expect(def.inPlay).toEqual(expect.arrayContaining(['blackmailer','lost']));
});
test('endless generation is fast enough', () => {      // Review Focus 1
  for (const n of [1, 10, 20, 30]) {
    const t = performance.now(); generateValid(endlessParams(n), n);
    expect(performance.now() - t).toBeLessThan(1000);
  }
});
```

- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: unique.ts → generate.ts 구현**
- [ ] **Step 4: 실행해 PASS.** 속도 시험이 실패하면 solve 의 가지치기를 먼저 손보고, 그래도 안 되면 endlessParams 상한을 낮춘 뒤 HISTORY 에 적는다.
- [ ] **Step 5: 커밋** "feat: add uniqueness check and case generator"

---

### Task 5: 해설·난이도·힌트

**Files:**
- Create: src/core/explain.ts
- Test: src/core/explain.test.ts

**Interfaces:**
- Consumes: solve, fullKnowledge, signature, campAt, Knowledge.knownCamps.
- Produces:

```ts
export type Fact = { type: 'clue'; cell: number } | { type: 'ability'; index: number } | { type: 'camp'; cell: number; camp: Camp };
export interface Step { cell: number; camp: Camp; because: Fact[] | 'all' }
export function explain(k: Knowledge): Step[]              // 모든 칸이 정해질 때까지
export function difficulty(steps: Step[]): 1|2|3|4|5
export type Hint = { kind: 'step'; step: Step } | { kind: 'investigate'; cell: number }
export function nextHint(k: Knowledge): Hint
export function describeStep(step: Step, def: CaseDef): string   // "3번은 공범: 1번 우체부와 5번 약사의 진술이 함께 참일 수 없다."
```

explain 알고리즘: 사실 목록 = 보이는 진술 + 능력 관찰 + 앞 단계에서 정한 진영. 아직 안 정한 칸 중 모든 세계에서 진영이 같은 칸마다, 사실 묶음 S 를 크기 1 → 2 → 3 순으로 찾는다. S 만 남긴 Knowledge(겉 직업·inPlay 는 늘 포함, 다른 진술은 null)로 풀었을 때 그 칸이 다른 진영인 세계가 하나도 없으면 S 가 이유다. 3개로도 없으면 'all'. 이유가 가장 작은 칸을 고르고(같으면 번호 작은 칸) knownCamps 에 더해 반복한다. 후보 S 는 그 칸을 참조하거나 참조 칸을 공유하는 사실로 먼저 좁혀도 된다.

difficulty: 단계마다 이유 크기 1 → 1점, 2 → 2점, 3 → 4점, 'all' → 8점을 더하고, 칸 수로 나눈 값을 1 ~ 5로 나눈다. 1장 사건이 1 ~ 2, 6장이 3 ~ 5에 오게 경계값을 정한다.

nextHint: solve(k, 2000) 이 capped 이거나, 진영이 정해지는 미정 칸이 없으면 조사 안 한 칸 중 번호가 가장 작은 칸으로 { kind: 'investigate' }. 조사할 칸도 없으면 능력 칸. 아니면 explain 의 첫 단계.

- [ ] **Step 1: 실패하는 시험 작성**

```ts
test('explain covers every cell and matches truth', () => {
  for (let s = 0; s < 20; s++) {
    const def = generateValid(endlessParams(8), s);
    const steps = explain(fullKnowledge(def));
    expect(new Set(steps.map(x => x.cell)).size).toBe(def.w * def.h);
    for (const st of steps) expect(st.camp).toBe(campAt(def.truth, st.cell));
  }
});
test('one-clue deduction has reason size 1', () => {
  // 손으로 만든 3x3: inPlay lost·thief·chief. 0번 길치(겉 직업 = 진짜, 참만 말함)가
  // "오른쪽 칸(1번) 기준 둘레 8칸에 악 0명" → 2·3·4·5번은 증인. 이유는 그 진술 하나.
  const first = explain(fullKnowledge(ONE_CLUE))[0];
  expect([2,3,4,5]).toContain(first.cell);
  expect(first.because).toEqual([{ type: 'clue', cell: 0 }]);
});
test('hint asks to investigate when nothing is investigated', () => {   // Review Focus 2
  const def = generateValid(endlessParams(20), 3);
  expect(nextHint(emptyKnowledgeOf(def))).toEqual({ kind: 'investigate', cell: 0 });
});
test('hint never throws on capped knowledge', () => {
  const def = generateValid(endlessParams(30), 4);
  expect(() => nextHint(emptyKnowledgeOf(def))).not.toThrow();
});
test('explain on 4x4 finishes under 3s', () => { /* performance.now() 로 잰다 */ });
```

- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: explain.ts 구현** (describeStep 문장은 한국어, 칸 번호는 1부터)
- [ ] **Step 4: 실행해 PASS**
- [ ] **Step 5: 커밋** "feat: add step solver for explanations, difficulty and hints"

---

### Task 6: 게임 상태 + 저장

**Files:**
- Create: src/core/game.ts, src/core/save.ts
- Test: src/core/game.test.ts, src/core/save.test.ts

**Interfaces:**
- Consumes: CaseDef, Knowledge, role, campAt, isEvil, abilityAnswer.
- Produces:

```ts
// game.ts
export type Note = 'good' | 'evil' | 'unsure';
export interface Game {
  def: CaseDef; hour: number; rep: number;
  investigated: boolean[]; arrested: boolean[]; used: boolean[];
  abilities: AbilityObs[]; notes: (Note | undefined)[];
  status: 'playing' | 'solved' | 'failed';
}
export function newGame(def: CaseDef, rep?: number): Game          // 기본 10
export function investigate(g: Game, cell: number): Game           // +2시간
export function arrest(g: Game, cell: number): Game                // +1시간, 선이면 rep -2
export function useAbility(g: Game, cell: number, a: number, b: number): Game  // 0시간
export function setNote(g: Game, cell: number, note?: Note): Game
export function visibleClue(g: Game, cell: number): Clue | null    // 조사했고, trigger 가 있으면 hour >= trigger
export function knowledgeOf(g: Game): Knowledge
// save.ts
export interface Save { v: 1; cleared: number[]; seenCards: string[]; endlessBest: number; endless?: { n: number; rep: number; seed: number } }
export function loadSave(store: Pick<Storage, 'getItem'>): Save
export function writeSave(store: Pick<Storage, 'setItem'>, s: Save): void
```

잘못된 행동(이미 조사한 칸 조사, 체포된 칸 조사, 이미 체포한 칸 체포, 조사 안 한 칸·능력 없는 겉 직업·이미 쓴 칸의 능력, 대상이 자기 자신이거나 a = b, status 가 'playing' 이 아님)은 받은 g 를 그대로 돌려준다(같은 객체). 정상 행동은 새 객체. 악이 모두 체포되면 'solved', rep ≤ 0 이면 'failed'.

- [ ] **Step 1: 실패하는 시험 작성**

```ts
test('investigate costs 2h, arrest 1h, ability 0h', () => { /* hour 0 → 2 → 3 → 3 */ });
test('arresting a good costs 2 rep; evil costs none', () => { /* 10 → 8, 8 → 8 */ });
test('all evil arrested → solved', () => { /* … */ });
test('five good arrests → failed', () => { /* rep 0 */ });
test('bellringer clue hidden before hour 12', () => {
  // 종지기 칸을 처음 조사한 직후(hour 2)는 null, 조사를 더 해서 hour 12 가 되면 Clue
});
test('invalid actions return the same object', () => {                      // Review Focus 3
  let g = newGame(DEF);   // DEF: 시험 파일 안에 손으로 만든 3x3 사건, 0번 좀도둑, 5번 겉 직업 우체부 g = arrest(g, 0);
  expect(investigate(g, 0)).toBe(g);
  expect(arrest(g, 0)).toBe(g);
  expect(useAbility(g, 5, 5, 6)).toBe(g);
});
test('knowledgeOf matches what the player saw', () => { /* faces 는 조사한 칸만, arrested 는 체포한 칸만 */ });
test('corrupt or old save falls back to default', () => {                   // Review Focus 4
  const def = { v: 1, cleared: [], seenCards: [], endlessBest: 0 };
  expect(loadSave({ getItem: () => '{not json' })).toEqual(def);
  expect(loadSave({ getItem: () => JSON.stringify({ v: 0, x: 1 }) })).toEqual(def);
  expect(loadSave({ getItem: () => null })).toEqual(def);
});
```

- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: game.ts, save.ts 구현** (저장 키 'village-case-save')
- [ ] **Step 4: 실행해 PASS**
- [ ] **Step 5: 커밋** "feat: add game state machine and save data"

---

### Task 7: 장 정의 + 스테이지 30개 생성 + 안내 문장

**Files:**
- Create: src/content/chapters.ts, src/tools/build-stages.ts, src/content/stages.json(생성물, 커밋함), src/content/tutorial.ts
- Test: src/content/stages.test.ts

**Interfaces:**
- Consumes: generateValid, checkCase, explain, difficulty, fullKnowledge, ROLES.
- Produces:

```ts
// chapters.ts
export interface Chapter { no: number; stages: [number, number]; sizes: [number, number][]; newRoles: RoleId[] }
export const CHAPTERS: Chapter[]
// stages.json 원소
export interface Stage { id: number; chapter: number; def: CaseDef; difficulty: number; newRoles: RoleId[] }
// tutorial.ts
export const GUIDE: Record<1 | 2, { cell?: number; text: string }[]>   // 1·2스테이지 따라 하기 단계
export const CARDS: Record<string, { title: string; body: string }>    // 직업 id 20개 + 'trouble','taint','ability','trigger'
export function cardsFor(stage: Stage, seen: string[]): string[]       // 이 스테이지에서 처음 보는 카드 키
```

장 데이터(설계 7장):

```
no  stages    sizes              newRoles
1   1 ~ 5     3×3                postman pharmacist thief chief
2   6 ~ 10    3×3, 3×4           mayor guard braggart
3   11 ~ 15   3×4                baker photographer lost blackmailer
4   16 ~ 20   4×4                lookout shill gossip hidden reporter
5   21 ~ 25   4×4                bellringer shadow smooth briber
6   26 ~ 30   4×4, 4×5           (없음)
```

build-stages 규칙: 장 j 의 k번째(1 ~ 5) 스테이지는 pool = 1 ~ j장 newRoles 전부, must = 그 장 newRoles 의 앞 ceil(개수 × k / 5)개(말썽꾼·악만 must 에 넣고 증인은 pool 가중치를 3배로). 후보를 시드 여럿으로 40개씩 만들어 difficulty 를 재고, 장 안에서 difficulty 가 줄지 않게 고른다. 6장은 difficulty 3 ~ 5. 1장 1 ~ 2스테이지는 3×3·좀도둑 1·두목 1·말썽꾼 0. 카드 키는 직업 id 와 개념(말썽꾼 첫 등장 'trouble', 오염 직업 첫 등장 'taint', 기자 첫 등장 'ability', 종지기 첫 등장 'trigger').

- [ ] **Step 1: 실패하는 시험 작성**

```ts
import stages from './stages.json';
test('30 stages, ids 1..30', () => expect(stages.map(s => s.id)).toEqual([...Array(30)].map((_, i) => i + 1)));
test('every stage passes G1-G3', () => {
  for (const s of stages) { const r = checkCase(s.def); expect(r.ok, `stage ${s.id}`).toBe(true); }
});
test('difficulty never drops inside a chapter', () => { /* 장마다 단조 증가(같아도 됨) */ });
test('roles only from chapters so far', () => { /* inPlay·faces ⊆ 1..j장 newRoles */ });
test('each chapter last stage has all its new trouble/evil roles somewhere in the chapter', () => { /* … */ });
test('stage 1 is 3x3 with thief and chief only', () => expect(stages[0].def.inPlay.sort()).toEqual(['chief','thief']));
test('cardsFor shows a card once', () => { /* seen 에 있으면 안 나옴 */ });
```

- [ ] **Step 2: 실행해 실패 확인** (stages.json 없음)
- [ ] **Step 3: chapters.ts, tutorial.ts, build-stages.ts 구현 → npm run stages 로 stages.json 생성**
- [ ] **Step 4: npx vitest run → PASS**
- [ ] **Step 5: 커밋** "feat: generate 30 fixed stages with tutorial content"

---

### Task 8: 화면 — 스테이지 모드로 한 판 끝까지

**Files:**
- Create: src/ui/main.ts(화면 전환), src/ui/style.css, src/ui/screens/title.ts, src/ui/screens/stageList.ts, src/ui/screens/caseScreen.ts, src/ui/screens/result.ts, src/ui/tutorialOverlay.ts, src/tools/check-ui.mjs
- Modify: src/index.html

**Interfaces:**
- Consumes: Game 함수 전부, Stage, CHAPTERS, cardsFor, GUIDE, CARDS, nextHint, describeStep, explain, loadSave/writeSave, ROLES.
- Produces: 다음 Task 가 쓰는 화면 진입 함수

```ts
export function showTitle(): void
export function showCase(def: CaseDef, opts: { mode: 'stage' | 'endless'; stageId?: number; rep?: number; onEnd: (g: Game) => void }): void
```

화면 요구(설계 4·9장):
- 사건 화면 위 줄: 경과 시간, 평판, 비율(말썽꾼 n · 공범 n · 주범 1), 이번 사건 말썽꾼·악 직업 목록(누르면 설명).
- 격자 칸: 번호, 조사했으면 겉 직업 이름, 체포했으면 진짜 직업과 진영 색, 메모 표시(구석).
- 칸을 누르면 메뉴: 조사(2시간) · 능력(0시간, 기자일 때, 두 칸 고르기 모드) · 체포(1시간) · 메모 선/악/?/지우기.
- 아래 진술 목록: "1번 우체부: 이웃 4칸에 악이 1명". 시각 계기 전이면 "12시간에 말함".
- 힌트 버튼: 스테이지 무료. 결과가 investigate 면 그 칸을 반짝이게.
- 결과 화면: 해결/실패, describeStep 목록, 다음 스테이지 / 다시 하기.
- 1·2스테이지는 GUIDE 단계를 말풍선으로, 이후 cardsFor 카드를 사건 시작 때 한 장씩. 본 카드는 seenCards 에 저장.
- 스테이지 목록: 1 ~ 30, 푼 것 표시, 다음 것만 열림.

- [ ] **Step 1: 화면 구현** (npm run dev 로 띄워 손으로 1스테이지를 끝까지 풀어 본다)
- [ ] **Step 2: check-ui.mjs 작성** — puppeteer-core + 설치된 Chrome(C:\Program Files\Google\Chrome\Application\chrome.exe), 390×844 로 dev 서버에 접속해: 타이틀 → 스테이지 1 → GUIDE 첫 말풍선 보임 → stages.json 1번 사건의 악 칸들을 조사 후 체포 → 결과 화면에 "해결"과 해설 줄 1개 이상. 단계마다 logs/ui-check/ 에 스크린샷.
- [ ] **Step 3: node src/tools/check-ui.mjs → 모든 확인 OK 출력**, 스크린샷을 눈으로 확인(글자 겹침·잘림 없음), npm run build 통과
- [ ] **Step 4: 커밋** "feat: playable stage mode UI"

---

### Task 9: 무한 모드 + Worker + 도감·규칙

**Files:**
- Create: src/ui/worker.ts, src/ui/endless.ts, src/ui/screens/codex.ts, src/ui/screens/rules.ts
- Modify: src/ui/screens/title.ts, src/tools/check-ui.mjs

**Interfaces:**
- Consumes: generateValid, endlessParams, showCase, loadSave/writeSave, CARDS, ROLES.
- Produces:

```ts
// worker 메시지
type GenRequest = { n: number; seed: number };
type GenReply = { def: CaseDef } | { error: string };
export function startEndless(resume: boolean): void
```

- 무한 모드: n = 1, rep = 10 에서 시작. 사건 해결 → rep +1(최대 10), n +1, 다음 사건. 실패 → 끝, 푼 사건 수와 최고 기록(endlessBest) 표시. 진행 중 상태(n, rep, seed)를 저장해 이어 하기.
- 지금 사건을 푸는 동안 Worker 에 다음 사건을 미리 요청한다. 아직 안 왔으면 "사건 준비 중" 표시.
- 힌트는 평판 1을 쓴다(rep 1 이면 버튼 잠금).
- 사건 화면에 시드 표시. 타이틀의 "시드로 하기"에 숫자를 넣으면 endlessParams(10) 으로 그 사건 한 판.
- 도감: 만난 직업(seenCards 기준) 설명, 못 만난 직업은 이름만 ?. 규칙: 4장 요약과 개념 카드 4장.

- [ ] **Step 1: 구현**
- [ ] **Step 2: check-ui.mjs 에 무한 모드 확인 추가** — 무한 시작 → 사건 화면 뜸(5초 안) → 진짜 악을 모두 체포(시험용으로 window.__game 노출, 개발 빌드에서만) → 다음 사건이 n = 2 로 뜸 → 도감 화면 스크린샷.
- [ ] **Step 3: node src/tools/check-ui.mjs → OK, npm run build 통과, npx vitest run 통과**
- [ ] **Step 4: 커밋** "feat: endless mode with worker generation, codex and rules"

---

### Task 10: 오프라인(PWA) + 배포 준비 + 기록

**Files:**
- Create: .github/workflows/pages.yml, src/public/icon-192.png, src/public/icon-512.png(단색 바탕 + 돋보기 같은 단순 도형)
- Modify: vite.config.ts, package.json, README.md, HISTORY.md, conversations/2026-11-23.md(또는 그날 날짜 파일)

- [ ] **Step 1: vite-plugin-pwa 추가.** registerType 'autoUpdate', 모든 빌드 파일 precache, manifest(name 마을 수사록, display standalone, 세로, 아이콘 2개, start_url·scope '/village-case/').
- [ ] **Step 2: 빌드 확인** — npm run build 후 dist/sw.js 와 dist/manifest.webmanifest 가 있고, sw.js 안에 index.html 과 stages.json 을 포함한 번들이 precache 목록에 있는지 확인. (Review Focus 5)
- [ ] **Step 3: pages.yml** — main push 에서 npm ci → npm test → npm run build → actions/deploy-pages. 시험이 실패하면 배포하지 않는다.
- [ ] **Step 4: README(현재 상태·폴더 구조·실행: npm run dev / npm test / npm run stages / npm run build, 배포 주소 https://yongbard.github.io/village-case/), HISTORY, 대화 요약 갱신**
- [ ] **Step 5: 커밋** "chore: add PWA and GitHub Pages workflow"
- [ ] **Step 6: 사용자에게 묻기** — 공개 레포 yongbard/village-case 생성 + main push(커밋 목록, push 하면 Actions 가 시험·빌드·Pages 배포를 시작한다는 것)를 알리고 명시적으로 "push 하라"는 답을 받은 뒤에만 gh repo create + push, Pages(Actions) 켜기. 배포 뒤 폰에서 열고 비행기 모드로 다시 열어 오프라인 확인을 사용자에게 부탁한다.
