import { expect, test } from 'vitest';
import { difficulty } from '../core/explain';
import { ROLES, isEvil, role } from '../core/roles';
import { abilityAnswer, campAt } from '../core/rules';
import { abilityCells, checkCase, solvedKnowledge } from '../core/unique';
import { CHAPTERS, rolesFor, rolesUpTo, type Stage } from './chapters';
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

test('no stage uses a chapter-j new role outside its prefix (ceil(n*k/5); chapter 1 at least three)', () => {
  for (const s of stages) {
    const allowed = new Set(rolesFor(s.id));
    for (const id of rolesIn(s)) expect(allowed.has(id), `stage ${s.id}: ${id}`).toBe(true);
  }
});

test('abilities are the solvedKnowledge observations the steps index into', () => {
  for (const s of stages) {
    const used = s.steps.flatMap((st) => (st.because === 'all' ? [] : st.because)).filter((f) => f.type === 'ability');
    for (const f of used) expect(f.type === 'ability' && f.index < s.abilities.length, `stage ${s.id}`).toBe(true);
    for (const o of s.abilities) {
      expect(abilityCells(s.def), `stage ${s.id}`).toContain(o.cell);
      expect(o.same, `stage ${s.id}`).toBe(abilityAnswer(s.def, o.cell, o.a, o.b));
    }
    if (abilityCells(s.def).length > 0) expect(s.abilities, `stage ${s.id}`).toEqual(solvedKnowledge(s.def).abilities);
    else expect(s.abilities).toEqual([]);
  }
});

test('each chapter last stage has all its new trouble/evil roles somewhere in the chapter', () => {
  for (const c of CHAPTERS) {
    const used = new Set(stages.filter((s) => s.chapter === c.no).flatMap((s) => s.def.inPlay));
    for (const id of c.newRoles.filter((id) => role(id).camp !== 'witness')) {
      expect(used.has(id), `chapter ${c.no}: ${id}`).toBe(true);
    }
    // 끝 스테이지는 그 장의 새 말썽꾼·악을 모두 쓴다
    const last = stages[c.stages[1] - 1].def.inPlay;
    for (const id of c.newRoles.filter((id) => role(id).camp !== 'witness')) {
      expect(last, `chapter ${c.no} last stage: ${id}`).toContain(id);
    }
  }
});

test('stages 1-2: 3x3, the chief alone, witness faces only postman/pharmacist', () => {
  for (const s of stages.slice(0, 2)) {
    expect([s.def.w, s.def.h]).toEqual([3, 3]);
    expect(s.def.inPlay).toEqual(['chief']);
    expect(s.def.faces.every((f) => f === 'postman' || f === 'pharmacist'), `stage ${s.id}`).toBe(true);
  }
});

test('roster is the whole board and matches the truth', () => {
  for (const s of stages) {
    const total = Object.values(s.def.roster).reduce((a, b) => a + b, 0);
    expect(total, `stage ${s.id}`).toBe(s.def.w * s.def.h);
    for (const [id, c] of Object.entries(s.def.roster)) expect(s.def.truth.roles.filter((r) => r === id).length, `stage ${s.id} ${id}`).toBe(c);
  }
});

test('explanations end on the bosses', () => {
  for (const s of stages) {
    const bosses = s.def.truth.roles.flatMap((r, i) => (role(r).camp === 'boss' ? [i] : []));
    expect(s.steps.filter((st) => st.claim === 'boss').map((st) => st.cell).sort((a, b) => a - b), `stage ${s.id}`).toEqual(bosses);
  }
});

test('the first accomplice comes after a boss-pointing witness (dog) is available', () => {
  for (const s of stages) {
    if (s.def.inPlay.some((id) => role(id).camp === 'accomplice')) expect(rolesFor(s.id), `stage ${s.id}`).toContain('dog');
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

test('cards: one per role plus the six concepts', () => {
  expect(Object.keys(CARDS).sort()).toEqual([...Object.keys(ROLES), 'ability', 'confession', 'roster', 'taint', 'trigger', 'trouble'].sort());
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
  expect(cardsFor(s(['chief'], ['postman', 'postman']), [])).toEqual(['roster', 'postman', 'chief']);
  expect(cardsFor(s(['braggart', 'lookout', 'chief'], ['braggart']), ['roster', 'chief'])).toEqual(['trouble', 'braggart', 'confession', 'lookout']);
  expect(cardsFor(s(['blackmailer', 'chief'], ['reporter', 'bellringer']), ['roster', 'chief', 'confession'])).toEqual(
    ['ability', 'reporter', 'trigger', 'bellringer', 'taint', 'blackmailer'],
  );
  expect(cardsFor(s(['gossip', 'chief'], []), ['roster', 'chief', 'trouble'])).toEqual(['gossip']);
});

test('guide: stage 1 walks investigate, read, note, arrest; cells are on the board', () => {
  const s1 = stages[0];
  const n = s1.def.w * s1.def.h;
  for (const g of [...GUIDE[1], ...GUIDE[2]]) {
    expect(g.text.length).toBeGreaterThan(0);
    if (g.cell !== undefined) expect(g.cell >= 0 && g.cell < n).toBe(true);
  }
  const text = GUIDE[1].map((g) => g.text).join('\n');
  for (const word of ['조사', '진술', '메모', '체포', '거짓말', '인원표', '주범']) expect(text).toContain(word);
  expect(GUIDE[2].length).toBeLessThan(GUIDE[1].length);
  // 안내가 진술을 옮길 때는 화면 진술과 같은 말(수상한 사람)을 쓴다
  expect(text).not.toMatch(/악이 없다/);
  expect(text).toContain('수상한 사람이 없다');
  // 체포를 안내하는 칸은 실제로 악이다
  const arrest = GUIDE[1].filter((g) => g.cell !== undefined && g.text.includes('체포'));
  expect(arrest.length).toBeGreaterThan(0);
  for (const g of arrest) expect(isEvil(campAt(s1.def.truth, g.cell!)), `cell ${g.cell}`).toBe(true);
  // 안내 문장이 말하는 사건: 우체부는 인원표에 1명인데 4번·7번(칸 3·6)이 우체부로 보이고,
  // 1번 약사(칸 0)가 4번을 포함한 둘러싼 칸에 악이 없다고 한다. 주범은 7번(칸 6).
  expect(s1.def.inPlay).toEqual(['chief']);
  expect(s1.def.roster.postman).toBe(1);
  expect(s1.def.faces.flatMap((f, i) => (f === 'postman' ? [i] : []))).toEqual([3, 6]);
  expect(s1.def.faces[0]).toBe('pharmacist');
  expect(s1.def.clues[0]).toMatchObject({ kind: 'evil8', base: 0, n: 0 });
  expect(s1.def.truth.roles[6]).toBe('chief');
});

test('taint card tells the two hidden rules the solver uses (one effect per person, always used when possible)', () => {
  expect(CARDS.taint.body).toContain('한 사람에게는 하나만');
  expect(CARDS.taint.body).toContain('반드시');
});
