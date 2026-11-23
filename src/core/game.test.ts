import { describe, expect, test } from 'vitest';
import { abilityAnswer } from './rules';
import type { CaseDef } from './types';
import { arrest, hintKnowledge, investigate, knowledgeOf, newGame, setNote, useAbility, visibleClue } from './game';

// 3x3: 0 thief (face postman), 4 chief (face mayor), others genuine witnesses.
// 1 reporter (ability), 2 bellringer (trigger 12), 5 postman.
const DEF: CaseDef = {
  seed: 7,
  w: 3,
  h: 3,
  truth: {
    roles: ['thief', '*w', '*w', '*w', 'chief', '*w', '*w', '*w', '*w'],
    taint: [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  },
  faces: ['postman', 'reporter', 'bellringer', 'pharmacist', 'mayor', 'postman', 'guard', 'baker', 'photographer'],
  clues: [
    { kind: 'evil4', base: 0, n: 1 }, // thief lies
    null,
    { kind: 'bossRow', base: 2, n: 2 },
    { kind: 'evil8', base: 3, n: 1 },
    { kind: 'evilRow', base: 4, n: 0 }, // chief lies
    { kind: 'evil4', base: 5, n: 1 },
    { kind: 'evilCol', base: 6, n: 1 },
    { kind: 'nearest', base: 7, n: 1 },
    { kind: 'pairOne', base: 8, a: 0, b: 1 },
  ],
  inPlay: ['thief', 'chief'],
};

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

  test('arresting a good costs 2 rep; evil costs none', () => {
    let g = newGame(DEF);
    expect(g.rep).toBe(10);
    g = arrest(g, 3);
    expect(g.rep).toBe(8);
    g = arrest(g, 0);
    expect(g.rep).toBe(8);
  });

  test('all evil arrested → solved', () => {
    let g = newGame(DEF);
    g = arrest(g, 0);
    expect(g.status).toBe('playing');
    g = arrest(g, 4);
    expect(g.status).toBe('solved');
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
    g = arrest(arrest(g, 0), 4);
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
    expect(k.arrested).toEqual(['thief', undefined, undefined, undefined, undefined, undefined, 'guard', undefined, undefined]);
    expect(k.abilities).toEqual(g.abilities);
    expect('knownSides' in k).toBe(false);
  });
});

test('hintKnowledge adds proven sides and visible troublemaker faces as known sides', () => {
  // 3×1: 0 허풍쟁이(말썽꾼, 겉 직업 그대로), 1 좀도둑(우체부로 위장), 2 두목(약사로 위장)
  const def: CaseDef = {
    seed: 1, w: 3, h: 1,
    truth: { roles: ['braggart', 'thief', 'chief'], taint: [-1, -1, -1] },
    faces: ['braggart', 'postman', 'pharmacist'],
    clues: [{ kind: 'evil8', base: 0, n: 0 }, { kind: 'evil4', base: 1, n: 0 }, { kind: 'evil8', base: 2, n: 0 }],
    inPlay: ['braggart', 'thief', 'chief'],
  };
  let g = newGame(def);
  expect(hintKnowledge(g, [undefined, 'evil', undefined]).knownSides).toEqual([undefined, 'evil', undefined]);
  g = investigate(investigate(g, 0), 1);
  const k = hintKnowledge(g, [undefined, undefined, 'evil']);
  expect(k.knownSides).toEqual(['good', undefined, 'evil']);
  expect({ ...k, knownSides: undefined }).toEqual({ ...knowledgeOf(g), knownSides: undefined });
});
