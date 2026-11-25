// 오래 걸리는 계산을 화면 밖에서 돌린다: 힌트(nextHint), 사건 생성(generateEndless), 해설(explain).
import { explainWithin, nextHint, type Hint, type Step } from '../core/explain';
import { generateEndless } from '../core/endless';
import { solvedKnowledge } from '../core/unique';
import { type AbilityObs, type CaseDef, type Knowledge } from '../core/types';

export type WorkerRequest =
  | { id: number; type: 'hint'; k: Knowledge }
  | { id: number; type: 'generate'; n: number; seed: number }
  | { id: number; type: 'explain'; def: CaseDef };
export type WorkerReply =
  | { id: number; type: 'hint'; hint: Hint }
  | { id: number; type: 'generate'; def: CaseDef }
  | { id: number; type: 'explain'; steps: Step[]; abilities: AbilityObs[] }
  | { id: number; type: 'error'; error: string };

/** 무한 모드 결과 화면 해설에 쓰는 시간 (ms) */
const EXPLAIN_MS = 10_000;

function run(req: WorkerRequest): WorkerReply {
  const { id } = req;
  switch (req.type) {
    case 'hint':
      return { id, type: 'hint', hint: nextHint(req.k) };
    case 'generate':
      return { id, type: 'generate', def: generateEndless(req.n, req.seed) };
    case 'explain': {
      const k = solvedKnowledge(req.def);
      // 큰 판은 해설이 아주 오래 걸릴 수 있다: 시간 안에 못 따지면 빈 해설(결과 화면이 그렇게 알린다)
      return { id, type: 'explain', steps: explainWithin(k, EXPLAIN_MS) ?? [], abilities: k.abilities };
    }
  }
}

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  let reply: WorkerReply;
  try {
    reply = run(e.data);
  } catch (err) {
    reply = { id: e.data.id, type: 'error', error: String(err) };
  }
  self.postMessage(reply);
});
