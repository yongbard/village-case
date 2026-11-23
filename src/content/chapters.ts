// 스테이지 장 정의 (설계 7장). 장마다 새 직업 묶음이 들어오고, 그 장 안에서 되풀이해 나온다.
import { type Step } from '../core/explain';
import { type AbilityObs, type CaseDef, type RoleId } from '../core/types';

export interface Chapter {
  no: number;
  /** 첫·끝 스테이지 번호 (1부터) */
  stages: [number, number];
  /** 이 장에서 쓰는 격자 [w, h]. 앞 스테이지부터 차례로 나눠 쓴다. */
  sizes: [number, number][];
  /** 이 장에서 새로 들어오는 직업 (들어오는 순서) */
  newRoles: RoleId[];
}

export const CHAPTERS: Chapter[] = [
  { no: 1, stages: [1, 5], sizes: [[3, 3]], newRoles: ['postman', 'pharmacist', 'thief', 'chief'] },
  { no: 2, stages: [6, 10], sizes: [[3, 3], [3, 4]], newRoles: ['mayor', 'guard', 'braggart'] },
  { no: 3, stages: [11, 15], sizes: [[3, 4]], newRoles: ['baker', 'photographer', 'lost', 'blackmailer'] },
  { no: 4, stages: [16, 20], sizes: [[4, 4]], newRoles: ['lookout', 'shill', 'gossip', 'hidden', 'reporter'] },
  { no: 5, stages: [21, 25], sizes: [[4, 4]], newRoles: ['bellringer', 'shadow', 'smooth', 'briber'] },
  { no: 6, stages: [26, 30], sizes: [[4, 4], [4, 5]], newRoles: [] },
];

/**
 * stages.json 원소. steps 는 explain(solvedKnowledge(def)) 를 미리 계산해 둔 해설 단계이고,
 * abilities 는 그때 쓴 능력 관찰(solvedKnowledge 가 고른 것)이다. 단계의 { type: 'ability', index } 는 abilities[index] 를 가리킨다.
 */
export interface Stage {
  id: number;
  chapter: number;
  def: CaseDef;
  difficulty: number;
  /** 이 스테이지에서 처음 나오는 직업 (앞 스테이지들의 inPlay·겉 직업에 없던 것) */
  newRoles: RoleId[];
  abilities: AbilityObs[];
  steps: Step[];
}

/** 장 1 ~ j 의 새 직업 전부 */
export function rolesUpTo(chapter: number): RoleId[] {
  return CHAPTERS.filter((c) => c.no <= chapter).flatMap((c) => c.newRoles);
}

/**
 * 스테이지 id 에서 쓸 수 있는 그 장의 새 직업: 앞 ceil(개수 × k / 5)개 (설계 7장: 장이 진행될수록 더 많이).
 * 1장은 예외로 처음부터 넷 다: 사건마다 공범·주범이 있어야 하는데 1장 밖에는 좀도둑·두목을 대신할 직업이 없다.
 */
export function chapterPrefix(id: number): RoleId[] {
  const { chapter, k } = chapterOf(id);
  const n = chapter.newRoles.length;
  return chapter.newRoles.slice(0, chapter.no === 1 ? n : Math.ceil((n * k) / 5));
}

/** 스테이지 id 에 나올 수 있는 직업: 앞 장들의 새 직업 전부 + 이 장의 chapterPrefix */
export function rolesFor(id: number): RoleId[] {
  const { chapter } = chapterOf(id);
  return [...rolesUpTo(chapter.no - 1), ...chapterPrefix(id)];
}

/** 스테이지 id 가 속한 장의 몇 번째(1 ~ 5) 스테이지인가 */
export function chapterOf(id: number): { chapter: Chapter; k: number } {
  const chapter = CHAPTERS.find((c) => id >= c.stages[0] && id <= c.stages[1]);
  if (!chapter) throw new Error(`no chapter for stage ${id}`);
  return { chapter, k: id - chapter.stages[0] + 1 };
}
