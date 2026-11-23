// worker.ts 에 일을 맡기고 답을 Promise 로 받는다. worker 는 한 번 만들어 계속 쓴다.
import { type Hint, type Step } from '../core/explain';
import { type AbilityObs, type CaseDef, type Knowledge } from '../core/types';
import { type WorkerReply, type WorkerRequest } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerReply) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WorkerReply>) => {
    const p = pending.get(e.data.id);
    pending.delete(e.data.id);
    p?.resolve(e.data);
  };
  w.onerror = (e) => {
    // worker 가 죽었다: 기다리던 일을 모두 실패로 돌리고 다음에 새로 만든다
    for (const p of pending.values()) p.reject(new Error(e.message || 'worker error'));
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

type Job = { type: 'hint'; k: Knowledge } | { type: 'generate'; n: number; seed: number } | { type: 'explain'; def: CaseDef };

function request(job: Job): Promise<WorkerReply> {
  const id = nextId++;
  const req: WorkerRequest = { ...job, id };
  return new Promise<WorkerReply>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(req);
  }).then((r) => {
    if (r.type === 'error') throw new Error(r.error);
    return r;
  });
}

export async function requestHint(k: Knowledge): Promise<Hint> {
  const r = await request({ type: 'hint', k });
  if (r.type !== 'hint') throw new Error('unexpected reply');
  return r.hint;
}

/** 무한 모드 n 번째 사건을 시드 seed 로 만든다 */
export async function requestGenerate(n: number, seed: number): Promise<CaseDef> {
  const r = await request({ type: 'generate', n, seed });
  if (r.type !== 'generate') throw new Error('unexpected reply');
  return r.def;
}

/** 해결된 사건의 해설 단계와 능력 결과 (오래 걸릴 수 있다) */
export async function requestExplain(def: CaseDef): Promise<{ steps: Step[]; abilities: AbilityObs[] }> {
  const r = await request({ type: 'explain', def });
  if (r.type !== 'explain') throw new Error('unexpected reply');
  return { steps: r.steps, abilities: r.abilities };
}
