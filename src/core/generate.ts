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
  trouble: number;
  accomplice: number;
  pool: RoleId[];
  must?: RoleId[];
  /** 직업별 뽑기 가중치 배수 (없으면 1). 스테이지가 새 증인 직업을 자주 보이게 할 때 쓴다. */
  weights?: Partial<Record<RoleId, number>>;
}

/** 대상 고르는 능력(기자 겉 직업)은 사건당 이만큼까지 */
const MAX_ABILITY_FACES = 2;

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

/** 서로 다른 직업 k 개를 weight 로 뽑는다 */
function drawDistinct(r: Rng, ids: RoleId[], k: number, mul: Mul): RoleId[] {
  const left = [...ids];
  const out: RoleId[] = [];
  while (out.length < k) {
    const id = pickWeighted(r, left, mul);
    out.push(id);
    left.splice(left.indexOf(id), 1);
  }
  return out;
}

/** 한 번 시도. 진술을 못 만들거나, 기자 겉 직업이 2칸을 넘거나, checkCase 를 통과 못 하면 null. */
export function generateCase(p: GenParams, seed: number): CaseDef | null {
  const { w, h } = p;
  const n = w * h;
  const r = makeRng(seed);
  const must = [...new Set(p.must ?? [])];
  const avail = [...new Set([...p.pool, ...must])];
  const ofCamp = (ids: RoleId[], camp: Camp) => ids.filter((id) => role(id).camp === camp);

  // 말썽꾼·공범·주범: must 는 반드시, 나머지는 pool 에서 weight 로 (직업마다 한 번)
  const inPlay: RoleId[] = [];
  for (const [camp, k] of [['trouble', p.trouble], ['accomplice', p.accomplice], ['boss', 1]] as const) {
    const forced = ofCamp(must, camp);
    const rest = ofCamp(avail, camp).filter((id) => !forced.includes(id));
    if (forced.length > k || forced.length + rest.length < k) throw new Error(`cannot pick ${k} ${camp} roles`);
    inPlay.push(...forced, ...drawDistinct(r, rest, k - forced.length, p.weights));
  }
  const witnesses = ofCamp(avail, 'witness');
  const mustWitness = ofCamp(must, 'witness');
  if (witnesses.length === 0 || inPlay.length + mustWitness.length > n) throw new Error('cannot place roles');

  // 배치: 망보기는 둘레 8칸 안에 주범이 있게 될 때까지 다시 섞는다
  const all = Array.from({ length: n }, (_, i) => i);
  const bossAt = inPlay.length - 1;
  let cells: number[];
  do cells = shuffle(r, all);
  while (!inPlay.every((id, j) => role(id).place !== 'bossIn8' || nbr8(w, h, cells[j]).includes(cells[bossAt])));
  const roles: RoleId[] = Array(n);
  inPlay.forEach((id, j) => (roles[cells[j]] = id));
  mustWitness.forEach((id, j) => (roles[cells[inPlay.length + j]] = id));
  for (const i of cells.slice(inPlay.length + mustWitness.length)) roles[i] = pickWeighted(r, witnesses, p.weights);

  const truth: World = { roles, taint: assignTaint(r, w, h, roles) };
  const faces = makeFaces(r, truth, witnesses);
  if (faces.filter((f) => role(f).ability).length > MAX_ABILITY_FACES) return null;
  const clues = faces.map((f, i) => makeClue(r, w, h, truth, i, f));
  if (clues.some((c, i) => c === null && role(faces[i]).clue)) return null;

  const def: CaseDef = { seed, w, h, truth, faces, clues, inPlay, roster: rosterOf(roles) };
  return checkCase(def).ok ? def : null;
}

/** (seed, 시도 번호) → 시도마다 쓸 시드. 결정적이다. */
function trySeed(seed: number, t: number): number {
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
 * 무한 모드 n 번째 사건(1부터)의 매개변수. 모두 n 에 대해 줄지 않는다. n >= 25 는 상한(4×5, 말썽꾼 3, 공범 3).
 * 공범 4명은 4×5 에서 사건 하나 만드는 데 1초를 넘기는 일이 잦아 1구역 상한을 3으로 둔다.
 */
export function endlessParams(n: number): GenParams {
  const [w, h] = n <= 4 ? [3, 3] : n <= 10 ? [3, 4] : n <= 17 ? [4, 4] : [4, 5];
  const tier = n <= 3 ? 1 : n <= 7 ? 2 : n <= 12 ? 3 : n <= 18 ? 4 : 5;
  const pool = Object.values(ROLES).filter((d) => d.tier <= tier).map((d) => d.id);
  const avail = (camp: Camp) => pool.filter((id) => role(id).camp === camp).length;
  const trouble = Math.min(n <= 2 ? 0 : n <= 8 ? 1 : n <= 15 ? 2 : 3, avail('trouble'));
  const accomplice = Math.min(n <= 5 ? 1 : n <= 12 ? 2 : 3, avail('accomplice'));
  return { w, h, trouble, accomplice, pool };
}
