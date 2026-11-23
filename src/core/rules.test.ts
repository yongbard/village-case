import { describe, expect, test } from 'vitest';
import { ROLES, isEvil, role } from './roles';
import { abilityAnswer, campAt, clueFact, consistent, modeAt, pairSameFact } from './rules';
import { ANY_WITNESS, type CaseDef, type Side, type Clue, type Knowledge, type RoleId, type World } from './types';

// 3x3, 0 = 좀도둑(thief), 8 = 두목(chief), 나머지 증인
const W: World = { roles: ['thief','*w','*w','*w','*w','*w','*w','*w','chief'], taint: Array(9).fill(-1) };
const withRole = (w: World, i: number, r: RoleId): World => ({ ...w, roles: w.roles.map((x, j) => (j === i ? r : x)) });

function K(inPlay: RoleId[], extra: Partial<Knowledge> = {}): Knowledge {
  return {
    w: 3, h: 3, inPlay,
    faces: Array(9).fill(undefined), clues: Array(9).fill(null),
    abilities: [], arrested: Array(9).fill(undefined),
    ...extra,
  };
}
function sparse<T>(set: Record<number, T>, d: T): T[] {
  return Array.from({ length: 9 }, (_, i) => (i in set ? set[i] : d));
}
const faceAt = (set: Record<number, RoleId>) => sparse<RoleId | undefined>(set, undefined);
const clueAt = (set: Record<number, Clue>) => sparse<Clue | null>(set, null);

describe('roles', () => {
  test('20 roles, camps and defaults', () => {
    expect(Object.keys(ROLES).length).toBe(20);
    const camps = Object.values(ROLES).map((r) => r.camp);
    expect(camps.filter((c) => c === 'witness').length).toBe(8);
    expect(camps.filter((c) => c === 'trouble').length).toBe(4);
    expect(camps.filter((c) => c === 'accomplice').length).toBe(5);
    expect(camps.filter((c) => c === 'boss').length).toBe(3);
    expect(role(ANY_WITNESS).camp).toBe('witness');
    expect(isEvil('boss') && isEvil('accomplice') && !isEvil('trouble') && !isEvil('witness')).toBe(true);
    for (const r of Object.values(ROLES)) expect(r.desc.length).toBeGreaterThan(5);
  });
});

describe('clueFact', () => {
  test('evil8 from center counts 2', () => expect(clueFact(3,3,W,{kind:'evil8',base:4,n:2})).toBe(true));
  test('evil4 from 1 counts thief only', () => expect(clueFact(3,3,W,{kind:'evil4',base:1,n:1})).toBe(true));
  test('evil4 from 1 does not count chief', () => expect(clueFact(3,3,W,{kind:'evil4',base:1,n:2})).toBe(false));
  test('evilRow excludes base, counts others in row', () => {
    expect(clueFact(3,3,W,{kind:'evilRow',base:1,n:1})).toBe(true);
    expect(clueFact(3,3,W,{kind:'evilRow',base:0,n:0})).toBe(true); // base thief not counted
  });
  test('evilCol', () => {
    expect(clueFact(3,3,W,{kind:'evilCol',base:3,n:1})).toBe(true);
    expect(clueFact(3,3,W,{kind:'evilCol',base:2,n:1})).toBe(true);
    expect(clueFact(3,3,W,{kind:'evilCol',base:4,n:0})).toBe(true);
  });
  test('nearest from 4 is 2 steps', () => expect(clueFact(3,3,W,{kind:'nearest',base:4,n:2})).toBe(true));
  test('nearest with no evil counted is 0', () => {
    const S = withRole(withRole(W, 0, '*w'), 8, 'shadow');
    expect(clueFact(3,3,S,{kind:'nearest',base:4,n:0})).toBe(true);
  });
  test('bossRow is 3', () => expect(clueFact(3,3,W,{kind:'bossRow',base:4,n:3})).toBe(true));
  test('pairOne 0 and 1', () => expect(clueFact(3,3,W,{kind:'pairOne',base:4,a:0,b:1})).toBe(true));
  test('pairOne both evil is false', () => expect(clueFact(3,3,W,{kind:'pairOne',base:4,a:0,b:8})).toBe(false));
  test('shadow not counted by evil8 but evil for pairOne', () => {
    const S = { ...W, roles: W.roles.map((r,i)=> i===8 ? 'shadow' : r) };
    expect(clueFact(3,3,S,{kind:'evil8',base:4,n:1})).toBe(true);
    expect(clueFact(3,3,S,{kind:'pairOne',base:4,a:8,b:1})).toBe(true);
  });
  test('trouble roles are not evil', () => {
    const T = withRole(W, 1, 'braggart');
    expect(clueFact(3,3,T,{kind:'evil8',base:4,n:2})).toBe(true);
  });
});

describe('modeAt / campAt / pairSameFact', () => {
  test('tainted witness lies, evil lies, shill tells truth, smooth any', () => {
    const T: World = { roles: ['thief','*w','*w','gossip','*w','*w','*w','*w','chief'], taint: [-1,-1,-1,4,-1,-1,-1,-1,-1] };
    expect(modeAt(T,4)).toBe('false');
    expect(modeAt(T,0)).toBe('false');
    expect(modeAt(T,1)).toBe('true');
    expect(modeAt({ ...W, roles: W.roles.map((r,i)=> i===0 ? 'shill' : r) },0)).toBe('true');
    expect(modeAt({ ...W, roles: W.roles.map((r,i)=> i===0 ? 'smooth' : r) },0)).toBe('any');
  });
  test('trouble modes: braggart false, lost true, hidden true', () => {
    expect(modeAt(withRole(W,1,'braggart'),1)).toBe('false');
    expect(modeAt(withRole(W,1,'lost'),1)).toBe('true');
    expect(modeAt(withRole(W,1,'hidden'),1)).toBe('true');
  });
  test('campAt and pairSameFact', () => {
    expect(campAt(W,0)).toBe('accomplice');
    expect(campAt(W,8)).toBe('boss');
    expect(campAt(W,3)).toBe('witness');
    expect(pairSameFact(W,0,8)).toBe(true);
    expect(pairSameFact(W,0,1)).toBe(false);
    expect(pairSameFact(withRole(W,1,'hidden'),1,2)).toBe(true); // 말썽꾼은 선
  });
});

describe('abilityAnswer', () => {
  const mk = (truth: World): CaseDef => ({ seed: 7, w: 3, h: 3, truth, faces: Array(9).fill('reporter'), clues: Array(9).fill(null), inPlay: ['thief','chief'] });
  test('truthful reporter answers the fact; evil reporter inverts', () => {
    const d = mk(W);
    expect(abilityAnswer(d, 1, 0, 8)).toBe(true);
    expect(abilityAnswer(d, 1, 0, 2)).toBe(false);
    expect(abilityAnswer(d, 0, 0, 8)).toBe(false); // thief lies
  });
  test('smooth answers deterministically', () => {
    const d = mk(withRole(W, 0, 'smooth'));
    expect(abilityAnswer(d, 0, 1, 2)).toBe(abilityAnswer(d, 0, 1, 2));
  });
});

describe('consistent', () => {
  test('baseline accepts', () => expect(consistent(K(['thief','chief']), W)).toBe(true));
  test('consistent rejects lookout far from boss', () => {
    const L = withRole(W, 0, 'lookout');
    expect(consistent(K(['lookout','chief']), L)).toBe(false);
  });
  test('accepts lookout with boss in 8', () => {
    const L = { ...W, roles: ['lookout','*w','*w','*w','chief','*w','*w','*w','*w'] };
    expect(consistent(K(['lookout','chief']), L)).toBe(true);
  });
  test('consistent rejects gossip with eligible neighbour but taint -1', () => {
    const G = withRole(W, 3, 'gossip');
    expect(consistent(K(['thief','gossip','chief']), G)).toBe(false);
  });
  test('accepts gossip tainting an adjacent witness; rejects non-adjacent or non-witness target', () => {
    const base = withRole(W, 3, 'gossip');
    const mkT = (t: number): World => ({ ...base, taint: base.taint.map((_, i) => (i === 3 ? t : -1)) });
    const k = K(['thief','gossip','chief']);
    expect(consistent(k, mkT(4))).toBe(true);
    expect(consistent(k, mkT(8))).toBe(false); // not adjacent
    expect(consistent(k, mkT(0))).toBe(false); // adjacent but thief, not a witness
  });
  test('gossip with no eligible neighbours must have -1', () => {
    const R = ['*w','thief','*w','chief','gossip','shadow','*w','briber','*w'];
    const k = K(['thief','chief','gossip','shadow','briber']);
    const t = (g: number): number[] => Array.from({ length: 9 }, (_, i) => (i === 7 ? 0 : i === 4 ? g : -1));
    expect(consistent(k, { roles: R, taint: t(-1) })).toBe(true);
    expect(consistent(k, { roles: R, taint: t(1) })).toBe(false);
  });
  test('non-tainter with a taint target is rejected', () => {
    expect(consistent(K(['thief','chief']), { ...W, taint: W.taint.map((_, i) => (i === 0 ? 4 : -1)) })).toBe(false);
  });
  test('consistent rejects inPlay role placed twice or missing', () => {
    const twice = withRole(W, 1, 'thief');
    expect(consistent(K(['thief','chief']), twice)).toBe(false);
    expect(consistent(K(['thief','chief','shadow']), W)).toBe(false); // shadow missing
    expect(consistent(K(['thief']), W)).toBe(false); // chief not in inPlay
  });
  test('consistent accepts disguised thief whose false clue is false', () => {
    const k = K(['thief','chief'], {
      faces: faceAt({ 0: 'postman' }),
      clues: clueAt({ 0: { kind: 'evil4', base: 0, n: 1 } }),
    });
    expect(consistent(k, W)).toBe(true); // true count 0, claims 1: false, thief lies
  });
  test('rejects disguised thief whose clue is true', () => {
    const k = K(['thief','chief'], {
      faces: faceAt({ 0: 'postman' }),
      clues: clueAt({ 0: { kind: 'evil4', base: 0, n: 0 } }),
    });
    expect(consistent(k, W)).toBe(false);
  });
  test('witness face: genuine witness must match, evil may disguise', () => {
    const k = (cell: number, face: RoleId) => K(['thief','chief'], { faces: faceAt({ [cell]: face }) });
    expect(consistent(k(1, 'postman'), W)).toBe(true); // ANY_WITNESS
    expect(consistent(k(0, 'postman'), W)).toBe(true); // thief disguised
    expect(consistent(k(1, 'postman'), withRole(W, 1, 'pharmacist'))).toBe(false);
    expect(consistent(k(1, 'postman'), withRole(W, 1, 'postman'))).toBe(true);
  });
  test('trouble face means true role is that id', () => {
    const w = { ...W, roles: ['thief','braggart','*w','*w','*w','*w','*w','*w','chief'] };
    const k = (face: RoleId) => K(['thief','braggart','chief'], { faces: faceAt({ 1: face }) });
    expect(consistent(k('braggart'), w)).toBe(true);
    expect(consistent(k('lost'), w)).toBe(false);
  });
  test('hidden shows a witness face', () => {
    const w = { ...W, roles: ['thief','hidden','*w','*w','*w','*w','*w','*w','chief'] };
    expect(consistent(K(['thief','hidden','chief'], { faces: faceAt({ 1: 'mayor' }) }), w)).toBe(true);
  });
  test('arrested and knownSides must match', () => {
    expect(consistent(K(['thief','chief'], { arrested: faceAt({ 0: 'thief' }) }), W)).toBe(true);
    expect(consistent(K(['thief','chief'], { arrested: faceAt({ 0: 'chief' }) }), W)).toBe(false);
    expect(consistent(K(['thief','chief'], { arrested: faceAt({ 2: ANY_WITNESS }) }), W)).toBe(true);
    const sides = (set: Record<number, Side>) => sparse<Side | undefined>(set, undefined);
    expect(consistent(K(['thief','chief'], { knownSides: sides({ 0: 'good' }) }), W)).toBe(false);
    expect(consistent(K(['thief','chief'], { knownSides: sides({ 0: 'evil' }) }), W)).toBe(true);
    expect(consistent(K(['thief','chief'], { knownSides: sides({ 8: 'evil', 4: 'good' }) }), W)).toBe(true);
    expect(consistent(K(['thief','chief'], { knownSides: sides({ 4: 'evil' }) }), W)).toBe(false);
    // 말썽꾼은 선
    const wh = { ...W, roles: ['thief','hidden','*w','*w','*w','*w','*w','*w','chief'] };
    expect(consistent(K(['thief','hidden','chief'], { knownSides: sides({ 1: 'good' }) }), wh)).toBe(true);
    expect(consistent(K(['thief','hidden','chief'], { knownSides: sides({ 1: 'evil' }) }), wh)).toBe(false);
  });
  test('ability observations', () => {
    const ob = (cell: number, a: number, b: number, same: boolean) => K(['thief','chief'], { abilities: [{ cell, a, b, same }] });
    expect(consistent(ob(1, 0, 8, true), W)).toBe(true); // truthful witness, fact true
    expect(consistent(ob(1, 0, 8, false), W)).toBe(false);
    expect(consistent(ob(0, 0, 8, false), W)).toBe(true); // thief lies
    expect(consistent(ob(0, 0, 8, true), W)).toBe(false);
  });
});
