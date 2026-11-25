# village_case_261123 — 마을 수사록 (가제)

## JIRA 주소

없음 (취미 프로젝트)

## 목적

출퇴근길에 폰으로 혼자 하는 추리 퍼즐 웹게임(PC 웹도 됨). 격자에 숨은 용의자를 조사해 진술을 모으고, 거짓말을 가려 주범을 모두 체포한다(주범 사냥).
장르 구조는 Dupery 같은 1인 추리 게임에서 가져오고, 직업은 전부 새로 만든다. 모든 사건은 솔버로 답이 정확히 하나인지 확인한다.
상세 설계: docs/2026-11-23-village-case-design.md, 규칙 개편(주범 사냥): docs/2026-11-24-boss-hunt-design.md

## 현재 상태

- 2026-11-25: 읽기 쉽게 다듬기 배포(Actions 45532213075). 진술은 "수상한 사람" 말투(칸 번호는 그대로), 사건 화면 위 메모는 직업별 인원(체포 0/2 · 두목 2 · …), 본문 글꼴은 고딕 Village Sans(IBM Plex Sans KR 부분 집합). 시험 167개, check-ui 93개, check-offline 통과, 최종 검토 반영. 설계 docs/2026-11-25-readability-design.md
- 2026-11-24 오후: 규칙 개편 1단계 "주범 사냥" 구현·배포(main push, Actions 45352954799 통과). 목표는 주범 모두 체포, 직업 28개, 칸 번호를 밝힌 직업 말투 진술, 인원표, 거짓일 수 있는 자백. 스테이지 30개 새로 만듦. 시험 162개, check-ui 90개, check-offline, 교차 검증 3000 통과. 2단계(시간 사건: 두목 살인·의사·술꾼)와 3단계(인상착의)는 설계 7장.
- 2026-11-23: 구현 10개 작업 완료(브랜치 feat/v1). 스테이지 30개(5스테이지 × 6장), 무한 모드, 오프라인(PWA), GitHub Pages 배포 workflow 까지 만듦.
- 시험 114개 통과(13 파일), 타입 검사(npm run typecheck), 사건 교차 검증(npm run test:cross) 와 화면 확인(check-ui) 통과.
- 2026-11-23 최종 검토 수정: 힌트가 같은 칸에 머물지 않고(앞 힌트 답을 알던 선악으로 넘김), 한 번에 1.5초 안에 답하며, 쓸모없어진 힌트는 취소된다.
- 2026-11-24 09:30: 그래픽·UI 를 수사 서류철 모습으로 바꿈(main 에 합치고 사용자 승인 후 push, 10:00 Pages 배포). 코르크판·종이·도장, 직업 20개 인물 사진(SVG), 글꼴 송명·고운바탕·나눔손글씨 펜(부분 집합 343KB, 오프라인 포함). 시험 124개, check-ui 80개, check-offline 통과.
- 2026-11-23 16:05: 진술 문장을 실제 세는 칸 수로 고치고, 직업 창에 말하는 방식(참말·거짓말 범위)을 붙임. 시험 118개.
- 2026-11-23 15:30: 공개 레포 yongbard/village-case 에 push, GitHub Actions(시험·교차 검증 3000·빌드) 통과 후 Pages 배포. 폰에서 열고 비행기 모드로 오프라인 확인은 사용자 확인 대기.

## 데이터

- src/content/stages.json: 고정 스테이지 30개(npm run stages 로 다시 만든다). 무한 모드 사건은 생성기가 그때그때 만든다.

## 모델(출처)

없음.

## 폴더 구조

```
village_case_261123/
├── README.md       현재 상태
├── HISTORY.md      작업 이력
├── package.json    스크립트·의존성
├── vite.config.ts  Vite + PWA(vite-plugin-pwa) + vitest 설정, base /village-case/
├── .github/workflows/pages.yml   main push 시 시험 → 빌드 → Pages 배포
├── docs/           설계·계획
│   ├── 2026-11-23-village-case-design.md   설계
│   ├── 2026-11-23-village-case-plan.md     구현 계획 (작업 10개)
│   ├── 2026-11-23-remaining-work.md        남은 과제 (검토에서 나왔지만 미룬 것)
│   ├── 2026-11-24-casefile-ui-design.md    그래픽·UI 설계 (수사 서류철)
│   ├── 2026-11-24-boss-hunt-design.md      규칙 개편 설계 (주범 사냥, 3단계 중 1단계)
│   ├── 2026-11-24-boss-hunt-plan.md        주범 사냥 구현 계획 (작업 10개)
│   ├── 2026-11-25-readability-design.md    읽기 쉽게 다듬기 설계 (글꼴·인원 표시·진술 말투)
│   ├── 2026-11-25-readability-plan.md      그 구현 계획 (작업 4개)
│   └── mockups/    그래픽 시안 (png, html)
├── src/            (Vite root)
│   ├── index.html  진입 페이지
│   ├── public/     아이콘 icon-192.png, icon-512.png (make-icons.mjs 가 만듦), fonts/ 글꼴 부분 집합 woff2 4개(송명, 본문 고딕 Village Sans 500·700, 손글씨 Village Hand) + glyphs.txt + OFL.txt (make-fonts.ts 가 만듦)
│   ├── core/       규칙·솔버·생성기·게임 상태·저장 (+ 시험)
│   ├── content/    장 구성, 튜토리얼 카드, stages.json (+ 시험)
│   ├── ui/         화면(main, screens/, 무한 모드, 워커, 스타일 style.css, 글꼴 fonts.css, 인물 사진 portraits.ts, 진술 문장 clueText.ts, 인원표 roster.ts)
│   └── tools/      build-stages.ts(스테이지 생성), test-cross.mjs(교차 검증 3000건), check-ui.mjs(화면 확인), check-offline.mjs(오프라인 확인), make-icons.mjs(아이콘 생성), make-fonts.ts·glyphs.ts(글꼴 부분 집합), contact-sheet.mjs(인물 사진 대조표), peek-case.mjs(사건 화면 미리 보기)
├── data/fonts-src/ 글꼴 원본 TTF·라이선스 (git 제외, npm run fonts 가 내려받음)
├── dist/           빌드 결과 (git 제외)
├── logs/           화면 확인 스크린샷 (git 제외)
├── archive/fonts/  안 쓰게 된 글꼴 (고운바탕 woff2, 11-25 고딕으로 바꾸며 뺌)
└── conversations/  대화 기록
```

## 실행

Node 24. 프로젝트 루트에서:

```
npm run dev                 개발 서버
npm run typecheck           타입 검사 (tsc --noEmit)
npm test                    시험 (vitest, 162개)
npm run test:cross          솔버 교차 검증 3000건
npm run stages              stages.json 다시 만들기
npm run build               dist 빌드 (sw.js, manifest.webmanifest 포함)
node src/tools/check-ui.mjs 화면 확인 (dev 서버 + Chrome 390x844)
node src/tools/make-icons.mjs 아이콘 다시 만들기
npm run fonts               글꼴 부분 집합 다시 만들기 (문구가 바뀌어 glyphs 시험이 실패하면)
node src/tools/contact-sheet.mjs 인물 사진 대조표 → logs/portraits.png
node src/tools/peek-case.mjs [n] 무한 모드 n번째 사건 화면 미리 보기 → logs/peek/
node src/tools/check-offline.mjs 오프라인 확인 (npm run build 다음)
```

## 경로

- 로컬: C:\Users\USER\Desktop\yongbeom\village_case_261123
- 레포(예정): github.com/yongbard/village-case (공개). push 는 매번 묻는다.
- 배포 주소: https://yongbard.github.io/village-case/ (main push 하면 자동 배포, push 는 매번 사용자에게 묻는다)
- 레포: https://github.com/yongbard/village-case (공개)
