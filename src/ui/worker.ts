// 오래 걸리는 계산을 화면 밖에서 돌린다: 힌트(nextHint), 사건 생성(generateValid), 해설(explain).
import { explain, nextHint, type Hint, type Step } from '../core/explain';
import { endlessParams, generateValid } from '../core/generate';
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

function run(req: WorkerRequest): WorkerReply {
  const { id } = req;
  switch (req.type) {
    case 'hint':
      return { id, type: 'hint', hint: nextHint(req.k) };
    case 'generate':
      return { id, type: 'generate', def: generateValid(endlessParams(req.n), req.seed) };
    case 'explain': {
      const k = solvedKnowledge(req.def);
      return { id, type: 'explain', steps: explain(k), abilities: k.abilities };
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
