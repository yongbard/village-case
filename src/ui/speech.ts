// 직업을 눌렀을 때 보여 줄 말하는 방식: 언제 참·거짓을 말하는지, 참말일 때와 거짓말일 때 나올 수 있는 답의 범위.
// 거짓말은 그 형식에서 나올 수 있는 답 중 실제와 다른 아무 답이다 (makeClue 와 같은 규칙).
import { diagOf, nbr4, nbr8 } from '../core/board';
import { role } from '../core/roles';
import { type ClueKind, type RoleId } from '../core/types';
import { h } from './dom';

export interface SpeechLine {
  label: string;
  text: string;
}

/** 사건 안에서 칸을 눌렀을 때: 그 판·칸 기준으로 실제 수를 적는다 */
export interface Spot {
  w: number;
  h: number;
  cell: number;
}

/** 언제 참말·거짓말을 하는가 */
function manner(id: RoleId): string {
  const d = role(id);
  const taken = '단, 좀도둑에게 쪽지를 바꿔치기당하거나 매수왕에게 매수되면 거짓말을, 협박꾼에게 협박당하면 주범을 선으로 치고 말합니다. 겉으로는 티가 나지 않습니다.';
  if (d.camp === 'witness') {
    if (d.ability) return `진술 대신 능력을 씁니다. 결과는 참입니다. ${taken}`;
    return `항상 참말을 합니다. ${taken}`;
  }
  if (id === 'braggart') return '약사 형식으로 말하지만 늘 실제보다 큰 수를 말합니다.';
  if (id === 'lost') return '약사 형식으로 참말을 하지만, 오른쪽 칸(없으면 왼쪽)을 가운데로 놓고 셉니다.';
  if (id === 'gossip') return '옆집 할머니 형식으로 한 사람을 악이라고 짚지만 소문은 늘 틀립니다.';
  if (d.mode === 'true') return '겉 직업의 형식으로 참말을 합니다. 능력 결과도 참입니다.';
  if (d.mode === 'any') return '겉 직업의 형식으로 참말도 거짓말도 합니다. 어느 쪽인지 알 수 없습니다.';
  return '겉 직업의 형식으로 항상 거짓말을 합니다. 능력 결과도 반대입니다.';
}

/** 진술 형식 kind 의 참말·거짓말 범위. spot 이 있으면 그 칸 기준 숫자. */
function formLines(kind: ClueKind, shift: boolean, spot?: Spot): { truth: string; lie: string } {
  let base: number | undefined;
  if (spot) {
    const x = spot.cell % spot.w;
    base = shift ? (x < spot.w - 1 ? spot.cell + 1 : spot.cell - 1) : spot.cell;
  }
  const center = spot && shift ? `${base! + 1}번 칸 ` : '';
  switch (kind) {
    case 'evil4': {
      const k = spot ? nbr4(spot.w, spot.h, base!).length : undefined;
      return {
        truth: k !== undefined
          ? `${center}상하좌우로 붙은 ${k}칸의 악 수를 그대로 말합니다.`
          : '상하좌우로 붙은 칸(가운데 4칸, 가장자리 3칸, 모서리 2칸)의 악 수를 그대로 말합니다.',
        lie: k !== undefined
          ? `0 ~ ${k}명 중 실제와 다른 수를 말합니다.`
          : '0명부터 붙은 칸 수까지 중 실제와 다른 수를 말합니다. 예: 붙은 칸 3개에 실제 악 1명이면 0·2·3명 중 하나.',
      };
    }
    case 'evil8': {
      const k = spot ? nbr8(spot.w, spot.h, base!).length : undefined;
      return {
        truth: k !== undefined
          ? `${center}주변 ${k}칸(대각선 포함)의 악 수를 그대로 말합니다.`
          : '주변 칸(대각선 포함. 가운데 8칸, 가장자리 5칸, 모서리 3칸)의 악 수를 그대로 말합니다.',
        lie: k !== undefined
          ? `0 ~ ${k}명 중 실제와 다른 수를 말합니다.`
          : '0명부터 주변 칸 수까지 중 실제와 다른 수를 말합니다. 예: 주변 5칸에 실제 악 2명이면 0·1·3·4·5명 중 하나.',
      };
    }
    case 'evilRow':
      return {
        truth: `같은 가로줄의 나머지 ${spot ? `${spot.w - 1}칸` : '칸(자기 빼고)'}의 악 수를 그대로 말합니다.`,
        lie: `0 ~ ${spot ? `${spot.w - 1}명` : '나머지 칸 수'} 중 실제와 다른 수를 말합니다.`,
      };
    case 'evilCol':
      return {
        truth: `같은 세로줄의 나머지 ${spot ? `${spot.h - 1}칸` : '칸(자기 빼고)'}의 악 수를 그대로 말합니다.`,
        lie: `0 ~ ${spot ? `${spot.h - 1}명` : '나머지 칸 수'} 중 실제와 다른 수를 말합니다.`,
      };
    case 'nearest':
      return {
        truth: '자기 말고 가장 가까운 악까지 상하좌우 걸음 수를 그대로 말합니다(대각선 한 칸은 2걸음). 악이 없으면 "나 말고는 악이 없다".',
        lie: `${spot ? `1 ~ ${spot.w + spot.h - 2}걸음과` : '판 안에서 나올 수 있는 걸음 수와'} "나 말고는 악이 없다" 중 실제와 다른 답을 말합니다.`,
      };
    case 'pairOne':
      return {
        truth: '자기를 뺀 두 사람을 짚는데, 그중 정확히 한 명이 악입니다.',
        lie: '짚은 두 사람이 둘 다 악이거나 둘 다 선입니다.',
      };
    case 'diag': {
      const k = spot ? diagOf(spot.w, spot.h, base!).length : undefined;
      return {
        truth: `자기 칸을 지나는 두 대각선 위 ${k !== undefined ? `${k}칸` : '칸'}의 악 수를 그대로 말합니다.`,
        lie: `0 ~ ${k !== undefined ? `${k}명` : '대각선 칸 수'} 중 실제와 다른 수를 말합니다.`,
      };
    }
    case 'atLeastOne':
      return {
        truth: '자기를 뺀 세 사람을 짚는데, 그중 적어도 한 명이 악입니다.',
        lie: '짚은 세 사람이 모두 선입니다.',
      };
    case 'adjPair':
      return {
        truth: '판 전체에 악 두 명이 상하좌우로 붙어 사는 곳이 있는지 그대로 말합니다.',
        lie: '있으면 없다고, 없으면 있다고 말합니다.',
      };
    case 'halves':
      return {
        truth: '판의 왼쪽 절반과 오른쪽 절반(가로 폭이 홀수면 가운데 세로줄 빼고) 중 악이 더 많은 쪽, 또는 같다고 그대로 말합니다.',
        lie: '나머지 두 답(반대쪽이 많다, 같다) 중 하나를 말합니다.',
      };
    case 'bossDir':
      return {
        truth: '주범(대역 포함)이 적어도 한 명 있는 방향을 말합니다. 위·아래는 그쪽 가로줄 전부, 왼쪽·오른쪽은 그쪽 세로줄 전부입니다.',
        lie: '말한 방향에는 주범이 한 명도 없습니다.',
      };
    case 'alibi':
      return { truth: '자기를 뺀 한 사람을 짚어 선이라고 말합니다.', lie: '짚은 사람은 악입니다.' };
    case 'accuse':
      return { truth: '자기를 뺀 한 사람을 짚어 악이라고 말합니다.', lie: '짚은 사람은 선입니다.' };
    case 'sameSide':
      return { truth: '두 사람을 짚어 같은 편이라고 말합니다.', lie: '짚은 두 사람은 다른 편입니다.' };
    case 'bossRow':
      return {
        truth: '한 가로줄을 골라 그 줄에 있는 주범 수(대역 포함)를 그대로 말합니다.',
        lie: `그 줄의 실제 주범 수와 다른 수(0 ~ ${spot ? `${spot.w}명` : '가로 칸 수'} 안에서)를 말합니다.`,
      };
  }
}

const COUNT_KINDS: ClueKind[] = ['evil4', 'evil8', 'evilRow', 'evilCol', 'diag', 'nearest', 'adjPair', 'halves'];

/** 직업 id 의 말하는 방식. spot 이 있으면 그 칸 기준 숫자로 적는다. */
export function speechLines(id: RoleId, spot?: Spot): SpeechLine[] {
  const d = role(id);
  const out: SpeechLine[] = [{ label: '말투', text: manner(id) }];
  const canTrue = d.camp === 'witness' || d.mode === 'true' || d.mode === 'any';
  const canLie = d.camp === 'witness' || d.mode === 'false' || d.mode === 'over' || (d.camp !== 'trouble' && d.mode !== 'true');

  if (d.clue) {
    const f = formLines(d.clue, d.shift === 'right', spot);
    if (canTrue) out.push({ label: '참말일 때', text: f.truth });
    if (canLie) out.push({ label: '거짓말일 때', text: d.mode === 'over' ? '실제보다 큰 수만 말합니다. 예: 실제 1명이면 2명 이상.' : f.lie });
    if (COUNT_KINDS.includes(d.clue)) {
      out.push({ label: '세는 법', text: '자기 칸은 세지 않습니다. 그림자(주범)는 악인데도 세지 않고, 모사꾼에게 누명 쓴 사람은 선인데도 셉니다.' });
    }
  } else if (d.ability) {
    out.push({ label: '참일 때', text: '고른 두 칸이 같은 편인지 다른 편인지 그대로 답합니다.' });
    out.push({ label: '거짓일 때', text: '반대로 답합니다. 같은 편이면 다른 편, 다른 편이면 같은 편.' });
  } else if (canLie && d.camp !== 'witness') {
    out.push({
      label: '거짓말 범위',
      text: '겉 직업 형식에서 나올 수 있는 답 중 실제와 다른 아무 답입니다. 숫자는 범위 안의 다른 수, 두 사람 지목은 조건이 틀린 두 사람, 능력 결과는 반대. 겉 직업 칸을 눌러 범위를 보세요.',
    });
  }
  return out;
}

/** 말하는 방식 목록 (직업 창·도감용) */
export function speechList(id: RoleId, spot?: Spot): HTMLElement {
  return h(
    'dl',
    { class: 'speech' },
    speechLines(id, spot).flatMap((l) => [h('dt', {}, l.label), h('dd', {}, l.text)]),
  );
}
