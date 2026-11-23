// 오래 걸리는 계산을 화면 밖에서 돌린다. 지금은 힌트(nextHint), Task 9 에서 사건 생성이 더해진다.
import { nextHint, type Hint } from '../core/explain';
import { type Knowledge } from '../core/types';

export type WorkerRequest = { id: number; type: 'hint'; k: Knowledge };
export type WorkerReply = { id: number; type: 'hint'; hint: Hint } | { id: number; type: 'error'; error: string };

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const { id } = e.data;
  let reply: WorkerReply;
  try {
    reply = { id, type: 'hint', hint: nextHint(e.data.k) };
  } catch (err) {
    reply = { id, type: 'error', error: String(err) };
  }
  self.postMessage(reply);
});
