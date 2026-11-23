// 교차 검증 3000판 전체를 돌린다 (npm run test:cross).
// 셸마다 환경 변수 문법이 달라서, node 로 CROSS_CASES 를 넣고 vitest 를 직접 실행한다.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vitest = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
const res = spawnSync(process.execPath, [vitest, 'run', 'core/solve.test.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, CROSS_CASES: process.env.CROSS_CASES ?? '3000' },
});
process.exit(res.status ?? 1);
