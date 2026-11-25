// 사건 시작 때 보여 주는 인원표 (주범 사냥 설계 4.2): 진영별 합계와 직업별 인원.
import { ROLES } from '../core/roles';
import { type Camp, type RoleId } from '../core/types';
import { CAMP_NAME } from './labels';

export interface RosterRow {
  camp: Camp;
  label: string;
  total: number;
  items: { id: RoleId; name: string; count: number }[];
}

const ORDER: Camp[] = ['boss', 'accomplice', 'trouble', 'witness'];

/** 주범 → 공범 → 말썽꾼 → 증인. 직업은 직업표 순서, 인원 0 인 직업은 빼고 진영 줄은 늘 둔다. */
export function rosterRows(roster: Record<RoleId, number>): RosterRow[] {
  return ORDER.map((camp) => {
    const items = Object.values(ROLES)
      .filter((r) => r.camp === camp && (roster[r.id] ?? 0) > 0)
      .map((r) => ({ id: r.id, name: r.name, count: roster[r.id] }));
    return { camp, label: CAMP_NAME[camp], total: items.reduce((s, x) => s + x.count, 0), items };
  });
}

/** 증인을 뺀 직업별 인원 한 줄: "두목 2 · 좀도둑 1 · 소문쟁이 2" (주범 → 공범 → 말썽꾼). 사건 화면 위 메모 줄에 쓴다. */
export function rosterSummary(roster: Record<RoleId, number>): string {
  return rosterRows(roster)
    .filter((row) => row.camp !== 'witness')
    .flatMap((row) => row.items.map((x) => `${x.name}\u00a0${x.count}`)) // 줄을 넘길 때 직업과 수가 갈라지지 않게
    .join(' · ');
}
