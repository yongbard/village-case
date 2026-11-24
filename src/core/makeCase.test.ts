import { describe, expect, test } from 'vitest';
import { nbr4 } from './board';
import { assignTaint, makeClue, makeFaces } from './makeCase';
import { makeRng, pick, shuffle } from './rng';
import { ROLES, isEvil, role } from './roles';
import { campAt, consistent } from './rules';
import { ANY_WITNESS, type Knowledge, type RoleId, type World } from './types';

const WITNESSES = Object.values(ROLES).filter((d) => d.camp === 'witness').map((d) => d.id);
const OTHERS = Object.values(ROLES).filter((d) => d.camp !== 'witness').map((d) => d.id);
/** 증인 직업마다 넉넉한 인원 */
const ROSTER = Object.fromEntries(WITNESSES.map((id) => [id, 99]));

/** 무작위 세계: 증인 아닌 직업 2~4개를 서로 다른 칸에, 나머지는 증인 직업 */
function world(seed: number, w: number, h: number): { world: World; inPlay: RoleId[] } {
  const r = makeRng(seed);
  const n = w * h;
  const roles = Array.from({ length: n }, () => pick(r, WITNESSES));
  const inPlay = shuffle(r, OTHERS).slice(0, 2 + (seed % 3)).filter((x) => x !== 'lookout');
  const cells = shuffle(r, Array.from({ length: n }, (_, i) => i));
  inPlay.forEach((x, j) => (roles[cells[j]] = x));
  const taint = assignTaint(r, w, h, roles);
  return taint ? { world: { roles, taint }, inPlay } : world(seed + 100_000, w, h);
}

function knowledgeOf(w: number, h: number, inPlay: RoleId[], cell: number, face: RoleId, clue: Knowledge['clues'][number]): Knowledge {
  const n = w * h;
  return {
    w, h, inPlay, roster: ROSTER,
    faces: Array.from({ length: n }, (_, i) => (i === cell ? face : undefined)),
    clues: Array.from({ length: n }, (_, i) => (i === cell ? clue : null)),
    abilities: [],
    arrested: Array(n).fill(undefined),
  };
}

describe('assignTaint', () => {
  test('targets are eligible (lie/shield: witness, frame: good), -1 when none, non-tainters -1', () => {
    for (let s = 0; s < 300; s++) {
      const w = 3 + (s % 2);
      const h = 3 + ((s >> 1) % 2);
      const { world: wd } = world(s, w, h);
      wd.roles.forEach((x, i) => {
        const def = role(x);
        const t = wd.taint[i];
        if (!def.taint) return expect(t).toBe(-1);
        const pool = def.taint === 'adj4' ? nbr4(w, h, i) : wd.roles.map((_, j) => j);
        const eligible = pool.filter((j) => j !== i && (def.effect === 'frame' ? !isEvil(campAt(wd, j)) : campAt(wd, j) === 'witness'));
        if (eligible.length === 0) expect(t).toBe(-1);
        else expect(eligible).toContain(t);
      });
    }
  });
  test('taint targets never overlap', () => {
    for (let s = 0; s < 300; s++) {
      const { world: wd } = world(s, 4, 4);
      const ts = wd.taint.filter((t) => t >= 0);
      expect(new Set(ts).size).toBe(ts.length);
    }
  });
});

describe('makeFaces', () => {
  test('genuine witness shows itself, trouble self shows itself, disguisers show a pool witness', () => {
    const r = makeRng(3);
    const truth: World = { roles: ['thief', 'mayor', 'decoy', 'braggart', ANY_WITNESS, 'chief'], taint: Array(6).fill(-1) };
    for (let s = 0; s < 50; s++) {
      const f = makeFaces(r, truth, ['postman', 'baker']);
      expect(['postman', 'baker']).toContain(f[0]);
      expect(f[1]).toBe('mayor');
      expect(['postman', 'baker']).toContain(f[2]);
      expect(f[3]).toBe('braggart');
      expect(['postman', 'baker']).toContain(f[4]);
      expect(['postman', 'baker']).toContain(f[5]);
    }
  });
});

describe('makeClue', () => {
  test('every generated clue is consistent with the truth', () => {
    let made = 0;
    for (let s = 0; s < 400; s++) {
      const w = 3 + (s % 2);
      const h = 3 + ((s >> 1) % 2);
      const { world: truth, inPlay } = world(1000 + s, w, h);
      const r = makeRng(s);
      const faces = makeFaces(r, truth, WITNESSES);
      for (let cell = 0; cell < w * h; cell++) {
        const c = makeClue(r, w, h, truth, cell, faces[cell]);
        if (!role(faces[cell]).clue) {
          expect(c).toBeNull();
          continue;
        }
        if (!c) continue; // pairOne 이 불가능한 경우만
        expect(c.kind).toBe(role(faces[cell]).clue);
        made++;
        expect(consistent(knowledgeOf(w, h, inPlay, cell, faces[cell], c), truth), `s${s} cell${cell}`).toBe(true);
      }
    }
    expect(made).toBeGreaterThan(1000);
  });

  test('reporter face has no clue; gossip always accuses a good person', () => {
    const truth: World = { roles: ['gossip', 'reporter', ANY_WITNESS, 'decoy', ANY_WITNESS, 'chief', ANY_WITNESS, ANY_WITNESS, ANY_WITNESS], taint: Array(9).fill(-1) };
    const r = makeRng(1);
    expect(makeClue(r, 3, 3, truth, 1, 'reporter')).toBeNull();
    for (let s = 0; s < 30; s++) {
      const c = makeClue(r, 3, 3, truth, 0, 'gossip')!;
      expect(c.kind).toBe('accuse');
      expect(['decoy', 'chief']).not.toContain(truth.roles[c.a!]);
    }
  });

  test('makeClue bossDir never names an empty direction', () => {
    const truth: World = { roles: ['dog', ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, 'chief'], taint: Array(9).fill(-1) };
    const r = makeRng(4);
    for (let s = 0; s < 40; s++) {
      const c = makeClue(r, 3, 3, truth, 0, 'dog')!;
      expect(['down', 'right']).toContain(c.dir);
    }
    const liar: World = { ...truth, roles: truth.roles.map((x, i) => (i === 0 ? 'decoy' : x)) };
    for (let s = 0; s < 40; s++) expect(makeClue(r, 3, 3, liar, 0, 'dog')).toBeNull(); // 아래·오른쪽 다 주범이 있어 거짓 방향이 없다
  });

  test('makeClue braggart value is above the real count', () => {
    const truth: World = { roles: ['chief', ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, 'braggart', ANY_WITNESS, ANY_WITNESS, ANY_WITNESS, ANY_WITNESS], taint: Array(9).fill(-1) };
    const r = makeRng(5);
    for (let s = 0; s < 40; s++) expect(makeClue(r, 3, 3, truth, 4, 'braggart')!.n).toBeGreaterThan(1);
  });

  test("lost's base is the right neighbour, else the left", () => {
    const r = makeRng(2);
    const mk = (cell: number): World => ({
      roles: Array.from({ length: 9 }, (_, i) => (i === cell ? 'lost' : i === 4 && cell !== 4 ? 'thief' : i === 0 && cell !== 0 ? 'chief' : ANY_WITNESS)),
      taint: Array(9).fill(-1),
    });
    expect(makeClue(r, 3, 3, mk(0), 0, 'lost')!.base).toBe(1);
    expect(makeClue(r, 3, 3, mk(4), 4, 'lost')!.base).toBe(5);
    expect(makeClue(r, 3, 3, mk(2), 2, 'lost')!.base).toBe(1);
    expect(makeClue(r, 3, 3, mk(8), 8, 'lost')!.base).toBe(7);
    expect(makeClue(r, 3, 3, mk(3), 3, 'braggart')!.base).toBe(3);
  });
});
