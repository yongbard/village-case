import { describe, expect, test } from 'vitest';
import { abilityAnswer } from './rules';
import type { CaseDef } from './types';
import { arrest, hintKnowledge, investigate, knowledgeOf, newGame, setNote, useAbility, visibleClue } from './game';

// 3x3: 0 decoy (face postman), 4 chief (face mayor), others genuine witnesses.
// 1 reporter (ability), 2 bellringer (trigger 12), 5 postman.
const DEF: CaseDef = {
  seed: 7,
  w: 3,
  h: 3,
  truth: {
    roles: ['decoy', '*w', '*w', '*w', 'chief', '*w', '*w', '*w', '*w'],
    taint: [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  },
  faces: ['postman', 'reporter', 'bellringer', 'pharmacist', 'mayor', 'postman', 'guard', 'baker', 'photographer'],
  clues: [
    { kind: 'evil4', base: 0, n: 1 }, // decoy lies
    null,
    { kind: 'bossRow', base: 2, r: 2, n: 1 },
    { kind: 'evil8', base: 3, n: 1 },
    { kind: 'evilRow', base: 4, n: 0 }, // chief lies
    { kind: 'evil4', base: 5, n: 1 },
    { kind: 'evilCol', base: 6, n: 1 },
    { kind: 'nearest', base: 7, n: 1 },
    { kind: 'pairOne', base: 8, a: 0, b: 1 },
  ],
  inPlay: ['chief', 'decoy'], roster: {},
};

/** 3×3 에 직업을 놓은 사건 (진술 없음): 자백·체포 시험용 */
const placed = (set: Record<number, string>, seed = 7): CaseDef => {
  const roles = Array.from({ length: 9 }, (_, i) => set[i] ?? '*w');
  return {
    seed, w: 3, h: 3, truth: { roles, taint: Array(9).fill(-1) },
    faces: Array(9).fill('postman'), clues: Array(9).fill(null),
    inPlay: roles.filter((r) => r !== '*w').sort(), roster: {},
  };
};

describe('boss hunt', () => {
  test('solved when all bosses are arrested, accomplices may stay', () => {
    const g = arrest(newGame(DEF), 4);
    expect(g.status).toBe('solved');
    expect(g.arrested[0]).toBe(false);
  });

  test('arresting an accomplice costs 1 and adds a confession', () => {
    const g = arrest(newGame(DEF), 0);
    expect(g.rep).toBe(9);
    expect(g.status).toBe('playing');
    expect(g.confessions).toHaveLength(1);
    expect(g.confessions[0].cell).toBe(0);
  });

  test('arresting a good person costs 2, no confession', () => {
    const g = arrest(newGame(DEF), 3);
    expect(g.rep).toBe(8);
    expect(g.confessions).toEqual([]);
  });

  test('confession lies when a remaining boss is within 8 neighbours', () => {
    // 대역 0번 옆(4번)에 두목 → 거짓 자백: 두목이 없는 세로줄(1 또는 3번째)
    for (let s = 0; s < 20; s++) {
      const g = arrest(newGame(placed({ 0: 'decoy', 4: 'chief' }, s)), 0);
      expect([1, 3]).toContain(g.confessions[0].col);
    }
  });

  test('confession tells the truth otherwise', () => {
    for (let s = 0; s < 20; s++) {
      const g = arrest(newGame(placed({ 0: 'shill', 8: 'chief' }, s)), 0);
      expect(g.confessions[0]).toEqual({ cell: 0, decoy: false, col: 3 });
    }
  });

  test('lying confession with no boss-free column says nothing (col null)', () => {
    const g = arrest(newGame(placed({ 0: 'decoy', 3: 'chief', 4: 'chief', 5: 'shadow' })), 0);
    expect(g.confessions[0].col).toBeNull();
  });

  test('only remaining bosses count: a caught boss no longer makes the accomplice lie', () => {
    let g = newGame(placed({ 0: 'shill', 1: 'chief', 8: 'briber' }));
    g = arrest(g, 1); // 0번 옆 주범을 먼저 잡음
    g = arrest(g, 0);
    expect(g.confessions[0].col).toBe(3); // 남은 주범(8번)의 세로줄, 참
  });

  test('no confession once every boss is caught (the case is over)', () => {
    const g = arrest(newGame(DEF), 4);
    expect(arrest(g, 0)).toBe(g);
  });

  test('same arrest order gives the same confession', () => {
    const run = () => arrest(arrest(newGame(placed({ 0: 'decoy', 4: 'chief', 8: 'chief' })), 3), 0).confessions;
    expect(run()).toEqual(run());
  });

  test('decoy confession is marked decoy', () => {
    expect(arrest(newGame(DEF), 0).confessions[0].decoy).toBe(true);
    expect(arrest(newGame(placed({ 0: 'shill', 8: 'chief' })), 0).confessions[0].decoy).toBe(false);
  });
});

describe('game', () => {
  test('investigate costs 2h, arrest 1h, ability 0h', () => {
    let g = newGame(DEF);
    expect(g.hour).toBe(0);
    g = investigate(g, 1);
    expect(g.hour).toBe(2);
    g = arrest(g, 3);
    expect(g.hour).toBe(3);
    g = useAbility(g, 1, 0, 4);
    expect(g.hour).toBe(3);
    expect(g.used[1]).toBe(true);
  });

  test('ability records the answer the player sees', () => {
    const g = useAbility(investigate(newGame(DEF), 1), 1, 0, 4);
    expect(g.abilities).toEqual([{ cell: 1, a: 0, b: 4, same: abilityAnswer(DEF, 1, 0, 4) }]);
    expect(g.abilities[0].same).toBe(true);
  });

  test('arresting a good costs 2 rep; boss costs none', () => {
    let g = newGame(DEF);
    expect(g.rep).toBe(10);
    g = arrest(g, 3);
    expect(g.rep).toBe(8);
    g = arrest(g, 4);
    expect(g.rep).toBe(8);
  });

  test('five good arrests → failed', () => {
    let g = newGame(DEF);
    for (const c of [1, 2, 3, 5]) g = arrest(g, c);
    expect(g.rep).toBe(2);
    expect(g.status).toBe('playing');
    g = arrest(g, 6);
    expect(g.rep).toBe(0);
    expect(g.status).toBe('failed');
  });

  test('bellringer clue hidden before hour 12', () => {
    let g = investigate(newGame(DEF), 2);
    expect(g.hour).toBe(2);
    expect(visibleClue(g, 2)).toBeNull();
    for (const c of [3, 5, 6, 7, 8]) g = investigate(g, c);
    expect(g.hour).toBe(12);
    expect(visibleClue(g, 2)).toEqual(DEF.clues[2]);
    expect(visibleClue(g, 3)).toEqual(DEF.clues[3]);
    expect(visibleClue(newGame(DEF), 5)).toBeNull();
  });

  test('invalid actions return the same object', () => {
    let g = newGame(DEF);
    g = arrest(g, 0);
    expect(investigate(g, 0)).toBe(g);
    expect(arrest(g, 0)).toBe(g);
    expect(useAbility(g, 5, 5, 6)).toBe(g); // not investigated
    g = investigate(g, 5);
    expect(useAbility(g, 5, 6, 7)).toBe(g); // postman has no ability
    expect(investigate(g, 5)).toBe(g);
    expect(investigate(g, 99)).toBe(g);
    expect(arrest(g, -1)).toBe(g);
    let r = investigate(g, 1);
    expect(useAbility(r, 1, 1, 2)).toBe(r); // self
    expect(useAbility(r, 1, 2, 2)).toBe(r); // a = b
    expect(useAbility(r, 1, 2, 9)).toBe(r); // out of range
    r = useAbility(r, 1, 2, 3);
    expect(useAbility(r, 1, 2, 3)).toBe(r); // already used
  });

  test('finished game ignores actions', () => {
    let g = newGame(DEF);
    g = arrest(g, 4);
    expect(g.status).toBe('solved');
    expect(investigate(g, 1)).toBe(g);
    expect(arrest(g, 1)).toBe(g);
    expect(useAbility(g, 1, 2, 3)).toBe(g);
    expect(setNote(g, 1, 'good')).toBe(g);
  });

  test('notes set, change and clear; no-op returns same object', () => {
    const g = newGame(DEF);
    const a = setNote(g, 2, 'evil');
    expect(a).not.toBe(g);
    expect(a.notes[2]).toBe('evil');
    expect(g.notes[2]).toBeUndefined();
    expect(setNote(a, 2, 'evil')).toBe(a);
    expect(setNote(a, 2, undefined).notes[2]).toBeUndefined();
    expect(setNote(g, 99, 'good')).toBe(g);
  });

  test('knowledgeOf matches what the player saw', () => {
    let g = newGame(DEF);
    g = investigate(g, 2); // bellringer, hidden
    g = investigate(g, 5);
    g = arrest(g, 0); // evil
    g = arrest(g, 6); // genuine witness → its face
    g = useAbility(investigate(g, 1), 1, 2, 3);
    const k = knowledgeOf(g);
    expect(k.w).toBe(3);
    expect(k.inPlay).toEqual(DEF.inPlay);
    expect(k.faces).toEqual([undefined, 'reporter', 'bellringer', undefined, undefined, 'postman', undefined, undefined, undefined]);
    expect(k.clues[2]).toBeNull();
    expect(k.clues[5]).toEqual(DEF.clues[5]);
    expect(k.clues[0]).toBeNull();
    expect(k.arrested).toEqual(['decoy', undefined, undefined, undefined, undefined, undefined, 'guard', undefined, undefined]);
    expect(k.abilities).toEqual(g.abilities);
    expect('knownClaims' in k).toBe(false);
  });
});

test('hintKnowledge adds proven claims and visible troublemaker faces as known claims', () => {
  // 3×1: 0 허풍쟁이(말썽꾼, 겉 직업 그대로), 1 좀도둑(우체부로 위장), 2 두목(약사로 위장)
  const def: CaseDef = {
    seed: 1, w: 3, h: 1,
    truth: { roles: ['braggart', 'thief', 'chief'], taint: [-1, -1, -1] },
    faces: ['braggart', 'postman', 'pharmacist'],
    clues: [{ kind: 'evil8', base: 0, n: 0 }, { kind: 'evil4', base: 1, n: 0 }, { kind: 'evil8', base: 2, n: 0 }],
    inPlay: ['braggart', 'thief', 'chief'], roster: {},
  };
  let g = newGame(def);
  expect(hintKnowledge(g, [undefined, 'evil', undefined]).knownClaims).toEqual([undefined, 'evil', undefined]);
  g = investigate(investigate(g, 0), 1);
  const k = hintKnowledge(g, [undefined, undefined, 'boss']);
  expect(k.knownClaims).toEqual(['good', undefined, 'boss']);
  expect({ ...k, knownClaims: undefined }).toEqual({ ...knowledgeOf(g), knownClaims: undefined });
});
