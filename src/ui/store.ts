// 저장 데이터. 저장소를 못 써도(사생활 보호 모드·용량 초과) 이번 세션 동안은 메모리에서 이어진다.
import { loadSave, writeSave, type Save } from '../core/save';

let cache: Save | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getSave(): Save {
  cache ??= loadSave(storage() ?? { getItem: () => null });
  return cache;
}

export function updateSave(change: (s: Save) => Save): void {
  cache = change(getSave());
  try {
    const s = storage();
    if (s) writeSave(s, cache);
  } catch {
    // 저장 실패는 무시하고 메모리 값으로 계속한다
  }
}
