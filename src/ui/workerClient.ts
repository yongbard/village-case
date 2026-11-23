// worker.ts 에 일을 맡기고 답을 Promise 로 받는다. worker 는 한 번 만들어 계속 쓴다.
import { type Hint } from '../core/explain';
import { type Knowledge } from '../core/types';
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

export function requestHint(k: Knowledge): Promise<Hint> {
  const id = nextId++;
  const req: WorkerRequest = { id, type: 'hint', k };
  return new Promise<WorkerReply>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(req);
  }).then((r) => {
    if (r.type === 'error') throw new Error(r.error);
    return r.hint;
  });
}
