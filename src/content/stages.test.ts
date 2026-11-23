import { expect, test } from 'vitest';
import { difficulty } from '../core/explain';
import { ROLES, isEvil, role } from '../core/roles';
import { campAt } from '../core/rules';
import { checkCase } from '../core/unique';
import { CHAPTERS, rolesUpTo, type Stage } from './chapters';
import stagesJson from './stages.json';
import { CARDS, GUIDE, cardsFor } from './tutorial';

const stages = stagesJson as unknown as Stage[];
const rolesIn = (s: Stage) => new Set([...s.def.inPlay, ...s.def.faces]);

test('30 stages, ids 1..30', () => expect(stages.map((s) => s.id)).toEqual([...Array(30)].map((_, i) => i + 1)));

test('every stage passes G1-G3', () => {
  for (const s of stages) {
    const r = checkCase(s.def);
    expect(r.ok, `stage ${s.id}`).toBe(true);
  }
});

test('stage chapter, size and stored difficulty match', () => {
  for (const c of CHAPTERS) {
    for (let id = c.stages[0]; id <= c.stages[1]; id++) {
      const s = stages[id - 1];
      expect(s.chapter, `stage ${id}`).toBe(c.no);
      expect(c.sizes.some(([w, h]) => w === s.def.w && h === s.def.h), `stage ${id} size`).toBe(true);
      expect(s.steps.length, `stage ${id} steps`).toBeGreaterThan(0);
      expect(s.difficulty, `stage ${id}`).toBe(difficulty(s.steps));
    }
  }
});

test('difficulty never drops inside a chapter', () => {
  for (const c of CHAPTERS) {
    const ds = stages.filter((s) => s.chapter === c.no).map((s) => s.difficulty);
    expect(ds, `chapter ${c.no}`).toEqual([...ds].sort((a, b) => a - b));
  }
});

test('roles only from chapters so far', () => {
  for (const s of stages) {
    const allowed = new Set(rolesUpTo(s.chapter));
    for (const id of rolesIn(s)) expect(allowed.has(id), `stage ${s.id}: ${id}`).toBe(true);
  }
});

test('each chapter last stage has all its new trouble/evil roles somewhere in the chapter', () => {
  for (const c of CHAPTERS) {
    const used = new Set(stages.filter((s) => s.chapter === c.no).flatMap((s) => s.def.inPlay));
    for (const id of c.newRoles.filter((id) => role(id).camp !== 'witness')) {
      expect(used.has(id), `chapter ${c.no}: ${id}`).toBe(true);
    }
    // 끝 스테이지는 그 장의 새 말썽꾼·악을 (주범은 한 명뿐이라 가장 늦게 들어온 주범만) 모두 쓴다
    const last = stages[c.stages[1] - 1].def.inPlay;
    const newEvilOrTrouble = c.newRoles.filter((id) => role(id).camp !== 'witness');
    const bosses = newEvilOrTrouble.filter((id) => role(id).camp === 'boss');
    for (const id of newEvilOrTrouble.filter((id) => role(id).camp !== 'boss' || id === bosses[bosses.length - 1])) {
      expect(last, `chapter ${c.no} last stage: ${id}`).toContain(id);
    }
  }
});

test('stage 1 is 3x3 with thief and chief only', () => {
  expect([stages[0].def.w, stages[0].def.h]).toEqual([3, 3]);
  expect([...stages[0].def.inPlay].sort()).toEqual(['chief', 'thief']);
});

test('stages 1-2: 3x3, thief + chief, no trouble, witness faces only postman/pharmacist', () => {
  for (const s of stages.slice(0, 2)) {
    expect([s.def.w, s.def.h]).toEqual([3, 3]);
    expect([...s.def.inPlay].sort()).toEqual(['chief', 'thief']);
    expect(s.def.faces.every((f) => f === 'postman' || f === 'pharmacist'), `stage ${s.id}`).toBe(true);
  }
});

test('chapter 6 difficulty is 3-5', () => {
  for (const s of stages.filter((s) => s.chapter === 6)) expect(s.difficulty, `stage ${s.id}`).toBeGreaterThanOrEqual(3);
});

test('stage newRoles are the roles first seen in that stage', () => {
  const seen = new Set<string>();
  for (const s of stages) {
    const fresh = [...rolesIn(s)].filter((id) => !seen.has(id));
    expect([...s.newRoles].sort(), `stage ${s.id}`).toEqual(fresh.sort());
    fresh.forEach((id) => seen.add(id));
  }
});

test('cards: one per role plus the four concepts', () => {
  expect(Object.keys(CARDS).sort()).toEqual([...Object.keys(ROLES), 'ability', 'taint', 'trigger', 'trouble'].sort());
  for (const id of Object.keys(ROLES)) expect(CARDS[id].title).toBe(ROLES[id].name);
  for (const c of Object.values(CARDS)) expect(c.body.length).toBeGreaterThan(0);
});

test('cardsFor shows a card once', () => {
  const seen: string[] = [];
  const shown: string[] = [];
  for (const s of stages) {
    const keys = cardsFor(s, seen);
    for (const k of keys) {
      expect(seen, `stage ${s.id}: ${k}`).not.toContain(k);
      expect(CARDS[k], k).toBeDefined();
    }
    seen.push(...keys);
    shown.push(...keys);
    expect(cardsFor(s, seen), `stage ${s.id} again`).toEqual([]);
  }
  // 30 스테이지를 다 하면 모든 카드를 한 번씩 본다
  expect([...shown].sort()).toEqual(Object.keys(CARDS).sort());
});

test('cardsFor: role order follows ROLES, a concept key comes right before its first role', () => {
  const s = (inPlay: string[], faces: string[]) => ({ def: { inPlay, faces } }) as unknown as Stage;
  expect(cardsFor(s(['thief', 'chief'], ['postman', 'postman']), [])).toEqual(['postman', 'thief', 'chief']);
  expect(cardsFor(s(['braggart', 'thief', 'chief'], ['braggart']), ['thief', 'chief'])).toEqual(['trouble', 'braggart']);
  expect(cardsFor(s(['blackmailer', 'chief'], ['reporter', 'bellringer']), ['chief'])).toEqual(
    ['ability', 'reporter', 'trigger', 'bellringer', 'taint', 'blackmailer'],
  );
  expect(cardsFor(s(['gossip', 'chief'], []), ['chief', 'trouble', 'taint'])).toEqual(['gossip']);
});

test('guide: stage 1 walks investigate, read, note, arrest; cells are on the board', () => {
  const s1 = stages[0];
  const n = s1.def.w * s1.def.h;
  for (const g of [...GUIDE[1], ...GUIDE[2]]) {
    expect(g.text.length).toBeGreaterThan(0);
    if (g.cell !== undefined) expect(g.cell >= 0 && g.cell < n).toBe(true);
  }
  const text = GUIDE[1].map((g) => g.text).join('\n');
  for (const word of ['조사', '진술', '메모', '체포', '거짓말']) expect(text).toContain(word);
  expect(GUIDE[2].length).toBeLessThan(GUIDE[1].length);
  // 체포를 안내하는 칸은 실제로 악이다
  const arrest = GUIDE[1].filter((g) => g.cell !== undefined && g.text.includes('체포'));
  expect(arrest.length).toBeGreaterThan(0);
  for (const g of arrest) expect(isEvil(campAt(s1.def.truth, g.cell!)), `cell ${g.cell}`).toBe(true);
  // 안내 문장이 말하는 6번(칸 5)의 거짓 진술: 주변 8칸에 악 4명 (이 사건의 악은 2명뿐)
  expect(s1.def.clues[5]).toMatchObject({ kind: 'evil8', base: 5, n: 4 });
  expect(s1.def.inPlay.length).toBe(2);
});
