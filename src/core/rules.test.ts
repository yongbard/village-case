import { describe, expect, test } from 'vitest';
import { ROLES, isEvil, role } from './roles';
import {
  abilityAnswer, abilityTruth, campAt, clueFact, consistent, countValue, modeAt, pairSameFact, statementHolds,
} from './rules';
import { ANY_WITNESS, type CaseDef, type Side, type Clue, type Knowledge, type RoleId, type World } from './types';

// 3x3, 0 = 대역(decoy, 위장 거짓말 공범), 8 = 두목(chief), 나머지 증인
const W: World = { roles: ['decoy','*w','*w','*w','*w','*w','*w','*w','chief'], taint: Array(9).fill(-1) };
const withRole = (w: World, i: number, r: RoleId): World => ({ ...w, roles: w.roles.map((x, j) => (j === i ? r : x)) });
const world = (roles: RoleId[], taint: Record<number, number> = {}): World => ({
  roles, taint: roles.map((_, i) => (i in taint ? taint[i] : -1)),
});
const wit = (set: Record<number, RoleId>): RoleId[] => Array.from({ length: 9 }, (_, i) => set[i] ?? ANY_WITNESS);

/** 증인 직업마다 넉넉한 인원 (인원 제약을 시험하지 않을 때) */
const ROOMY: Record<RoleId, number> = Object.fromEntries(
  Object.values(ROLES).filter((r) => r.camp === 'witness').map((r) => [r.id, 9]),
);

function K(inPlay: RoleId[], extra: Partial<Knowledge> = {}): Knowledge {
  return {
    w: 3, h: 3, inPlay, roster: ROOMY,
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
  test('28 roles, camps and defaults', () => {
    expect(Object.keys(ROLES).length).toBe(28);
    const camps = Object.values(ROLES).map((r) => r.camp);
    expect(camps.filter((c) => c === 'witness').length).toBe(16);
    expect(camps.filter((c) => c === 'trouble').length).toBe(3);
    expect(camps.filter((c) => c === 'accomplice').length).toBe(5);
    expect(camps.filter((c) => c === 'boss').length).toBe(4);
    expect(ROLES.hidden).toBeUndefined();
    expect(ROLES.smooth).toBeUndefined();
    expect(role(ANY_WITNESS).camp).toBe('witness');
    expect(isEvil('boss') && isEvil('accomplice') && !isEvil('trouble') && !isEvil('witness')).toBe(true);
    for (const r of Object.values(ROLES)) expect(r.desc.length).toBeGreaterThan(5);
    expect(new Set(Object.values(ROLES).map((r) => r.name)).size).toBe(28);
  });
});

describe('clueFact: counts', () => {
  test('evil8 from center counts 2', () => expect(clueFact(3,3,W,{kind:'evil8',base:4,n:2})).toBe(true));
  test('evil4 from 1 counts decoy only', () => expect(clueFact(3,3,W,{kind:'evil4',base:1,n:1})).toBe(true));
  test('evilRow excludes base', () => {
    expect(clueFact(3,3,W,{kind:'evilRow',base:1,n:1})).toBe(true);
    expect(clueFact(3,3,W,{kind:'evilRow',base:0,n:0})).toBe(true);
  });
  test('evilCol', () => expect(clueFact(3,3,W,{kind:'evilCol',base:2,n:1})).toBe(true));
  test('nearest from 4 is 2 steps', () => expect(clueFact(3,3,W,{kind:'nearest',base:4,n:2})).toBe(true));
  test('nearest with no evil counted is 0', () => {
    const S = withRole(withRole(W, 0, '*w'), 8, 'shadow');
    expect(clueFact(3,3,S,{kind:'nearest',base:4,n:0})).toBe(true);
  });
  test('diag counts both diagonals through the base, excluding it', () => {
    const D = world(wit({ 0: 'chief', 8: 'thief' }), { 8: 5 });
    expect(countValue(3,3,D,{kind:'diag',base:4,n:0})).toBe(2);
    expect(clueFact(3,3,D,{kind:'diag',base:4,n:2})).toBe(true);
  });
  test('shadow is not counted, framed good cell is counted', () => {
    const F = world(wit({ 1: 'shadow', 7: 'framer' }), { 7: 3 });
    expect(countValue(3,3,F,{kind:'evil4',base:4,n:0})).toBe(2); // 3 (누명), 7 (모사꾼). 1 (그림자) 은 안 셈
  });
  test('trouble roles are not evil', () => {
    expect(clueFact(3,3,withRole(W, 1, 'braggart'),{kind:'evil8',base:4,n:2})).toBe(true);
  });
});

describe('clueFact: views and boss pointers', () => {
  // 1 두목, 3 협박꾼 → 4 협박
  const B = world(wit({ 1: 'chief', 3: 'blackmailer' }), { 3: 4 });
  test('shield view drops bosses from counts and relations', () => {
    expect(countValue(3,3,B,{kind:'evil4',base:4,n:0},'real')).toBe(2);
    expect(countValue(3,3,B,{kind:'evil4',base:4,n:0},'shield')).toBe(1);
    expect(clueFact(3,3,B,{kind:'accuse',base:4,a:1},'shield')).toBe(false);
    expect(clueFact(3,3,B,{kind:'accuse',base:4,a:1},'real')).toBe(true);
  });
  test('decoy is a boss for bossRow and bossDir; shield keeps only the decoy', () => {
    const D = world(wit({ 0: 'decoy', 8: 'chief' }));
    expect(clueFact(3,3,D,{kind:'bossRow',base:4,r:1,n:1})).toBe(true);
    expect(clueFact(3,3,D,{kind:'bossRow',base:4,r:3,n:1})).toBe(true);
    expect(clueFact(3,3,D,{kind:'bossRow',base:4,r:3,n:0},'shield')).toBe(true);
    expect(clueFact(3,3,D,{kind:'bossRow',base:4,r:1,n:1},'shield')).toBe(true);
    expect(clueFact(3,3,D,{kind:'bossDir',base:4,dir:'down'})).toBe(true);
    expect(clueFact(3,3,D,{kind:'bossDir',base:4,dir:'down'},'shield')).toBe(false);
    expect(clueFact(3,3,D,{kind:'bossDir',base:4,dir:'up'},'shield')).toBe(true);
  });
  test('bossDir false when nothing that way', () => {
    expect(clueFact(3,3,W,{kind:'bossDir',base:0,dir:'up'})).toBe(false);
    expect(clueFact(3,3,W,{kind:'bossDir',base:0,dir:'left'})).toBe(false);
  });
  test('halves on odd width skips the middle column', () => {
    // 왼쪽 0,3,6 / 오른쪽 2,5,8. W: 왼쪽 1(대역) 오른쪽 1(두목) → 같음
    expect(clueFact(3,3,W,{kind:'halves',base:4,n:0})).toBe(true);
    const M = withRole(W, 1, 'decoy'); // 1 은 가운데 세로줄: 바뀌지 않음
    expect(clueFact(3,3,{ ...M, roles: M.roles },{kind:'halves',base:4,n:0})).toBe(true);
    const R = withRole(W, 5, 'thief');
    expect(clueFact(3,3,R,{kind:'halves',base:4,n:1})).toBe(true);
    expect(clueFact(3,3,R,{kind:'halves',base:4,n:-1})).toBe(false);
  });
  test('adjPair finds a horizontally adjacent counted pair', () => {
    expect(clueFact(3,3,W,{kind:'adjPair',base:4,n:0})).toBe(true);
    expect(clueFact(3,3,withRole(W, 1, 'thief'),{kind:'adjPair',base:4,n:1})).toBe(true);
    expect(clueFact(3,3,withRole(W, 4, 'thief'),{kind:'adjPair',base:2,n:0})).toBe(true); // 대각선은 아님
  });
  test('alibi, accuse, sameSide, atLeastOne use real evil (shadow evil, framed not)', () => {
    const F = world(wit({ 0: 'shadow', 8: 'framer' }), { 8: 2 });
    expect(clueFact(3,3,F,{kind:'accuse',base:4,a:0})).toBe(true);
    expect(clueFact(3,3,F,{kind:'alibi',base:4,a:2})).toBe(true);
    expect(clueFact(3,3,F,{kind:'sameSide',base:4,a:0,b:8})).toBe(true);
    expect(clueFact(3,3,F,{kind:'sameSide',base:4,a:0,b:2})).toBe(false);
    expect(clueFact(3,3,F,{kind:'pairOne',base:4,a:0,b:2})).toBe(true);
    expect(clueFact(3,3,F,{kind:'atLeastOne',base:4,cells:[1,2,3]})).toBe(false);
    expect(clueFact(3,3,F,{kind:'atLeastOne',base:4,cells:[1,2,8]})).toBe(true);
  });
});

describe('modes and statementHolds', () => {
  test('braggart (over) holds only when said number exceeds the real one', () => {
    const G = withRole(world(wit({ 0: 'chief' })), 4, 'braggart');
    expect(modeAt(G, 4)).toBe('over');
    expect(statementHolds(3,3,G,4,{kind:'evil8',base:4,n:2})).toBe(true);
    expect(statementHolds(3,3,G,4,{kind:'evil8',base:4,n:1})).toBe(false);
    expect(statementHolds(3,3,G,4,{kind:'evil8',base:4,n:0})).toBe(false);
  });
  test('gossip accuse is always false: target must be good', () => {
    const G = withRole(W, 4, 'gossip');
    expect(modeAt(G, 4)).toBe('false');
    expect(statementHolds(3,3,G,4,{kind:'accuse',base:4,a:1})).toBe(true);
    expect(statementHolds(3,3,G,4,{kind:'accuse',base:4,a:0})).toBe(false);
  });
  test('thief makes its target lie, blackmailer shields, framer changes nothing about the mode', () => {
    expect(modeAt(world(wit({ 3: 'thief', 8: 'chief' }), { 3: 4 }), 4)).toBe('false');
    expect(modeAt(world(wit({ 3: 'blackmailer', 8: 'chief' }), { 3: 4 }), 4)).toBe('shield');
    expect(modeAt(world(wit({ 3: 'chief', 8: 'framer' }), { 8: 4 }), 4)).toBe('true');
    expect(modeAt(W, 0)).toBe('false');
    expect(modeAt(withRole(W, 0, 'shill'), 0)).toBe('true');
    expect(modeAt(withRole(W, 1, 'lost'), 1)).toBe('true');
  });
  test('shielded witness tells the truth as if bosses were good', () => {
    const B = world(wit({ 1: 'chief', 3: 'blackmailer' }), { 3: 4 });
    expect(statementHolds(3,3,B,4,{kind:'evil4',base:4,n:1})).toBe(true);
    expect(statementHolds(3,3,B,4,{kind:'evil4',base:4,n:2})).toBe(false);
  });
  test('campAt and pairSameFact', () => {
    expect(campAt(W,0)).toBe('accomplice');
    expect(campAt(W,8)).toBe('boss');
    expect(pairSameFact(W,0,8)).toBe(true);
    expect(pairSameFact(W,0,1)).toBe(false);
  });
});

describe('abilities', () => {
  const mk = (truth: World): CaseDef => ({
    seed: 7, w: 3, h: 3, truth, faces: Array(9).fill('reporter'), clues: Array(9).fill(null),
    inPlay: ['chief','decoy'], roster: ROOMY,
  });
  test('truthful reporter answers the fact; evil reporter inverts', () => {
    const d = mk(W);
    expect(abilityAnswer(d, 1, 0, 8)).toBe(true);
    expect(abilityAnswer(d, 1, 0, 2)).toBe(false);
    expect(abilityAnswer(d, 0, 0, 8)).toBe(false);
  });
  test('abilityTruth: shielded reporter answers as if bosses were good', () => {
    const B = world(wit({ 1: 'chief', 3: 'blackmailer' }), { 3: 4 });
    expect(abilityTruth(B, 4, 1, 2)).toBe(true); // 두목을 선으로 침
    expect(abilityTruth(B, 5, 1, 2)).toBe(false);
  });
});

describe('consistent', () => {
  test('baseline accepts', () => expect(consistent(K(['chief','decoy']), W)).toBe(true));
  test('duplicate accomplices must match inPlay multiset', () => {
    const D = world(wit({ 0: 'decoy', 2: 'decoy', 8: 'chief' }));
    expect(consistent(K(['chief','decoy','decoy']), D)).toBe(true);
    expect(consistent(K(['chief','decoy']), D)).toBe(false);
    expect(consistent(K(['chief','decoy','decoy']), W)).toBe(false);
  });
  test('witness counts above roster are rejected', () => {
    const P = world(wit({ 0: 'decoy', 1: 'postman', 2: 'postman', 8: 'chief' }));
    expect(consistent(K(['chief','decoy'], { roster: { ...ROOMY, postman: 2 } }), P)).toBe(true);
    expect(consistent(K(['chief','decoy'], { roster: { ...ROOMY, postman: 1 } }), P)).toBe(false);
  });
  test('two sources may not taint the same cell', () => {
    const T = world(wit({ 3: 'thief', 5: 'thief', 8: 'chief' }), { 3: 4, 5: 4 });
    expect(consistent(K(['chief','thief','thief']), T)).toBe(false);
    const ok = world(wit({ 3: 'thief', 5: 'thief', 8: 'chief' }), { 3: 4, 5: 2 });
    expect(consistent(K(['chief','thief','thief']), ok)).toBe(true);
  });
  test('frame target must be good, lie/shield target a real witness', () => {
    const k = K(['framer','braggart','decoy']);
    const roles = wit({ 0: 'decoy', 4: 'braggart', 8: 'framer' });
    expect(consistent(k, world(roles, { 8: 4 }))).toBe(true); // 말썽꾼에게 누명 가능
    expect(consistent(k, world(roles, { 8: 0 }))).toBe(false); // 악에게는 안 됨
    expect(consistent(k, world(roles, { 8: 8 }))).toBe(false);
    const kt = K(['chief','thief','braggart']);
    const rt = wit({ 1: 'braggart', 0: 'thief', 8: 'chief' });
    expect(consistent(kt, world(rt, { 0: 3 }))).toBe(true);
    expect(consistent(kt, world(rt, { 0: 1 }))).toBe(false); // 말썽꾼은 증인 아님
    expect(consistent(kt, world(rt, { 0: -1 }))).toBe(false); // 대상이 있는데 -1
  });
  test('tainter with no eligible cell must have -1', () => {
    const roles = wit({ 0: 'thief', 1: 'chief', 3: 'decoy' });
    const k = K(['chief','decoy','thief']);
    expect(consistent(k, world(roles, { 0: -1 }))).toBe(true);
  });
  test('non-tainter with a taint target is rejected', () => {
    expect(consistent(K(['chief','decoy']), { ...W, taint: W.taint.map((_, i) => (i === 0 ? 4 : -1)) })).toBe(false);
  });
  test('lookout needs a real boss in 8 neighbours, decoy does not count', () => {
    expect(consistent(K(['chief','lookout']), world(wit({ 0: 'lookout', 4: 'chief' })))).toBe(true);
    expect(consistent(K(['chief','lookout']), world(wit({ 0: 'lookout', 8: 'chief' })))).toBe(false);
    expect(consistent(K(['chief','decoy','lookout']), world(wit({ 0: 'lookout', 4: 'decoy', 8: 'chief' })))).toBe(false);
  });
  test('disguised liar: clue must be false', () => {
    const k = (n: number) => K(['chief','decoy'], { faces: faceAt({ 0: 'postman' }), clues: clueAt({ 0: { kind: 'evil4', base: 0, n } }) });
    expect(consistent(k(1), W)).toBe(true);
    expect(consistent(k(0), W)).toBe(false);
  });
  test('witness face: genuine witness must match, evil may disguise', () => {
    const k = (cell: number, face: RoleId) => K(['chief','decoy'], { faces: faceAt({ [cell]: face }) });
    expect(consistent(k(1, 'postman'), W)).toBe(true);
    expect(consistent(k(0, 'postman'), W)).toBe(true);
    expect(consistent(k(1, 'postman'), withRole(W, 1, 'pharmacist'))).toBe(false);
    expect(consistent(k(1, 'postman'), withRole(W, 1, 'postman'))).toBe(true);
  });
  test('trouble face means true role is that id', () => {
    const w = withRole(W, 1, 'braggart');
    const k = (face: RoleId) => K(['braggart','chief','decoy'], { faces: faceAt({ 1: face }) });
    expect(consistent(k('braggart'), w)).toBe(true);
    expect(consistent(k('lost'), w)).toBe(false);
  });
  test('arrested and knownSides must match', () => {
    expect(consistent(K(['chief','decoy'], { arrested: faceAt({ 0: 'decoy' }) }), W)).toBe(true);
    expect(consistent(K(['chief','decoy'], { arrested: faceAt({ 0: 'chief' }) }), W)).toBe(false);
    expect(consistent(K(['chief','decoy'], { arrested: faceAt({ 2: ANY_WITNESS }) }), W)).toBe(true);
    const sides = (set: Record<number, Side>) => sparse<Side | undefined>(set, undefined);
    expect(consistent(K(['chief','decoy'], { knownSides: sides({ 0: 'good' }) }), W)).toBe(false);
    expect(consistent(K(['chief','decoy'], { knownSides: sides({ 0: 'evil', 4: 'good' }) }), W)).toBe(true);
  });
  test('ability observations', () => {
    const ob = (cell: number, a: number, b: number, same: boolean) => K(['chief','decoy'], { abilities: [{ cell, a, b, same }] });
    expect(consistent(ob(1, 0, 8, true), W)).toBe(true);
    expect(consistent(ob(1, 0, 8, false), W)).toBe(false);
    expect(consistent(ob(0, 0, 8, false), W)).toBe(true);
  });
});
