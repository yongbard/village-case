// worker.ts 에 일을 맡기고 답을 Promise 로 받는다. worker 는 한 번 만들어 계속 쓴다.
// worker 에는 한 번에 한 일만 보내고 나머지는 여기서 줄을 세운다: 줄에 선 일은 그냥 빼서 취소할 수 있고,
// 돌고 있는 일을 취소하면 worker 를 끝내고 새로 만들어 다음 일부터 이어 간다(줄에 선 일은 잃지 않는다).
import { type Hint, type Step } from '../core/explain';
import { type AbilityObs, type CaseDef, type Knowledge } from '../core/types';
import { type WorkerReply, type WorkerRequest } from './worker';

type Job = { type: 'hint'; k: Knowledge } | { type: 'generate'; n: number; seed: number } | { type: 'explain'; def: CaseDef };
interface Entry {
  id: number;
  job: Job;
  resolve: (r: WorkerReply) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const queue: Entry[] = [];
let running: Entry | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WorkerReply>) => {
    if (w !== worker || !running || e.data.id !== running.id) return;
    const r = running;
    running = null;
    r.resolve(e.data);
    pump();
  };
  w.onerror = (e) => {
    if (w !== worker) return;
    // worker 가 죽었다: 돌던 일만 실패로 돌리고, 줄에 선 일은 새 worker 로 이어 간다
    const r = running;
    running = null;
    killWorker();
    r?.reject(new Error(e.message || 'worker error'));
    pump();
  };
  worker = w;
  return w;
}

function killWorker() {
  worker?.terminate();
  worker = null;
}

function pump() {
  if (running || queue.length === 0) return;
  running = queue.shift()!;
  const req: WorkerRequest = { ...running.job, id: running.id };
  getWorker().postMessage(req);
}

/** signal 이 취소되면: 줄에 서 있으면 빼고, 돌고 있으면 worker 를 새로 만든다. 어느 쪽이든 AbortError 로 실패한다. */
function request(job: Job, signal?: AbortSignal): Promise<WorkerReply> {
  const id = nextId++;
  return new Promise<WorkerReply>((resolve, reject) => {
    const abortError = () => new DOMException('aborted', 'AbortError');
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const entry: Entry = { id, job, resolve, reject };
    const onAbort = () => {
      const at = queue.indexOf(entry);
      if (at >= 0) queue.splice(at, 1);
      else if (running === entry) {
        running = null;
        killWorker();
        pump();
      } else return; // 이미 끝났다
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const done = () => signal?.removeEventListener('abort', onAbort);
    entry.resolve = (r) => (done(), resolve(r));
    entry.reject = (e) => (done(), reject(e));
    queue.push(entry);
    pump();
  }).then((r) => {
    if (r.type === 'error') throw new Error(r.error);
    return r;
  });
}

/** signal 로 취소할 수 있다 (관찰이 바뀌어 쓸모없어진 힌트) */
export async function requestHint(k: Knowledge, signal?: AbortSignal): Promise<Hint> {
  const r = await request({ type: 'hint', k }, signal);
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
