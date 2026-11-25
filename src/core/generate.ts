// 사건 생성기 (설계 5.4). 직업을 뽑아 배치하고, 실제 세계에 맞는 겉 직업·진술을 만든 뒤
// checkCase 를 통과한 사건만 돌려준다.
import { nbr8 } from './board';
import { assignTaint, makeClue, makeFaces } from './makeCase';
import { makeRng, shuffle, type Rng } from './rng';
import { ROLES, role, rosterOf } from './roles';
import { type CaseDef, type Camp, type RoleId, type World } from './types';
import { checkCase } from './unique';

export interface GenParams {
  w: number;
  h: number;
  /** 진영별 인원. 같은 직업이 MAX_COPIES 명까지 나올 수 있다 (must 직업은 반드시 1명 이상) */
  trouble: number;
  accomplice: number;
  boss: number;
  pool: RoleId[];
  must?: RoleId[];
  /** 직업별 뽑기 가중치 배수 (없으면 1). 스테이지가 새 증인 직업을 자주 보이게 할 때 쓴다. */
  weights?: Partial<Record<RoleId, number>>;
}

/** 대상 고르는 능력(기자 겉 직업)은 사건당 이만큼까지 */
const MAX_ABILITY_FACES = 2;
/** 한 사건에 같은 직업(증인 아닌)은 이만큼까지 */
const MAX_COPIES = 2;

type Mul = GenParams['weights'];
const weightOf = (id: RoleId, mul: Mul): number => role(id).weight * (mul?.[id] ?? 1);

function pickWeighted(r: Rng, ids: RoleId[], mul: Mul): RoleId {
  const total = ids.reduce((s, id) => s + weightOf(id, mul), 0);
  let x = r() * total;
  for (const id of ids) {
    x -= weightOf(id, mul);
    if (x < 0) return id;
  }
  return ids[ids.length - 1];
}

/** 직업 k 개를 weight 로 뽑는다 (같은 직업은 have 에 있는 것까지 합쳐 MAX_COPIES 명까지). 못 뽑으면 null */
function drawCopies(r: Rng, ids: RoleId[], k: number, mul: Mul, have: RoleId[]): RoleId[] | null {
  const out: RoleId[] = [];
  const count = (id: RoleId) => have.filter((x) => x === id).length + out.filter((x) => x === id).length;
  while (out.length < k) {
    const left = ids.filter((id) => count(id) < MAX_COPIES);
    if (left.length === 0) return null;
    out.push(pickWeighted(r, left, mul));
  }
  return out;
}

/**
 * 한 번 시도. 진술을 못 만들거나, 오염 대상이 겹칠 수밖에 없거나, 기자 겉 직업이 2칸을 넘거나,
 * checkCase(주범 자리가 하나)를 통과 못 하면 null.
 */
export function generateCase(p: GenParams, seed: number): CaseDef | null {
  const { w, h } = p;
  const n = w * h;
  const r = makeRng(seed);
  const must = [...new Set(p.must ?? [])];
  const avail = [...new Set([...p.pool, ...must])];
  const ofCamp = (ids: RoleId[], camp: Camp) => ids.filter((id) => role(id).camp === camp);

  // 말썽꾼·공범·주범: must 는 반드시 1명, 나머지는 pool 에서 weight 로 (같은 직업 MAX_COPIES 명까지)
  const inPlay: RoleId[] = [];
  for (const [camp, k] of [['trouble', p.trouble], ['accomplice', p.accomplice], ['boss', p.boss]] as const) {
    const forced = ofCamp(must, camp);
    if (forced.length > k) throw new Error(`cannot pick ${k} ${camp} roles`);
    const drawn = drawCopies(r, ofCamp(avail, camp), k - forced.length, p.weights, forced);
    if (!drawn) throw new Error(`cannot pick ${k} ${camp} roles`);
    inPlay.push(...forced, ...drawn);
  }
  inPlay.sort();
  const witnesses = ofCamp(avail, 'witness');
  const mustWitness = ofCamp(must, 'witness');
  if (witnesses.length === 0 || inPlay.length + mustWitness.length > n) throw new Error('cannot place roles');

  // 배치: 망보기는 둘레 8칸 안에 주범이 있게 될 때까지 다시 섞는다 (너무 오래 안 되면 이 시도는 버린다)
  const all = Array.from({ length: n }, (_, i) => i);
  const lookoutOk = (cells: number[]) => inPlay.every((id, j) =>
    role(id).place !== 'bossIn8' || nbr8(w, h, cells[j]).some((q) => inPlay.some((b, jb) => cells[jb] === q && role(b).camp === 'boss')));
  let cells = shuffle(r, all);
  for (let t = 0; !lookoutOk(cells); t++) {
    if (t >= 200) return null;
    cells = shuffle(r, all);
  }
  const roles: RoleId[] = Array(n);
  inPlay.forEach((id, j) => (roles[cells[j]] = id));
  mustWitness.forEach((id, j) => (roles[cells[inPlay.length + j]] = id));
  for (const i of cells.slice(inPlay.length + mustWitness.length)) roles[i] = pickWeighted(r, witnesses, p.weights);

  const taint = assignTaint(r, w, h, roles);
  if (!taint) return null;
  const truth: World = { roles, taint };
  const roster = rosterOf(roles);
  // 위장은 이번 사건에 실제로 있는 증인 직업으로만 (없는 직업으로 위장하면 인원표에서 바로 들통난다)
  const faces = makeFaces(r, truth, witnesses.filter((id) => (roster[id] ?? 0) > 0));
  if (faces.filter((f) => role(f).ability).length > MAX_ABILITY_FACES) return null;
  const clues = faces.map((f, i) => makeClue(r, w, h, truth, i, f));
  if (clues.some((c, i) => c === null && role(faces[i]).clue)) return null;

  const def: CaseDef = { seed, w, h, truth, faces, clues, inPlay, roster };
  return checkCase(def).ok ? def : null;
}

/** (seed, 시도 번호) → 시도마다 쓸 시드. 결정적이다. */
export function trySeed(seed: number, t: number): number {
  let x = (seed ^ Math.imul(t + 1, 0x9e3779b9)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * 통과하는 사건이 나올 때까지 시도한다. 같은 seed 는 같은 사건. 못 찾으면 throw.
 * 돌려주는 사건의 seed 는 화면에 보이는 이 seed 다 (시도마다 쓴 시드는 안에서만 쓴다).
 */
export function generateValid(p: GenParams, seed: number, maxTries = 500): CaseDef {
  for (let t = 0; t < maxTries; t++) {
    const def = generateCase(p, trySeed(seed, t));
    if (def) return { ...def, seed };
  }
  throw new Error(`no valid case in ${maxTries} tries (seed ${seed})`);
}

/**
 * 무한 모드 n 번째 사건(1부터)의 매개변수. 스테이지를 다 해 본 사람이 하는 모드라 스테이지 4장 수준(4×4, 주범 1)에서
 * 시작한다(설계 docs/2026-11-25-endless-difficulty-design.md). 판·말썽꾼·주범·악(공범 + 주범) 수는 n 에 대해 줄지 않는다.
 * n >= 13 은 상한(4×5, 말썽꾼 3, 주범 3, 공범 1). 주범 3 + 공범 2 는 4×5 에서 사건 하나에 중앙값 3초를 넘어
 * 주범이 3명이 될 때 공범을 1명으로 줄인다(악 4명은 그대로). 같은 직업이 여럿 나올 수 있어 인원은 직업 수에 묶이지 않는다.
 */
export function endlessParams(n: number): GenParams {
  const [w, h] = n <= 7 ? [4, 4] : [4, 5];
  const tier = n <= 3 ? 3 : n <= 5 ? 4 : 5;
  const pool = Object.values(ROLES).filter((d) => d.tier <= tier).map((d) => d.id);
  const trouble = n <= 12 ? 2 : 3;
  const accomplice = n <= 12 ? 2 : 1;
  const boss = n <= 3 ? 1 : n <= 12 ? 2 : 3;
  return { w, h, trouble: pool.some((id) => role(id).camp === 'trouble') ? trouble : 0, accomplice, boss, pool };
}
