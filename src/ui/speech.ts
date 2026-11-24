// 직업을 눌렀을 때 보여 줄 말하는 방식: 언제 참·거짓을 말하는지, 참말일 때와 거짓말일 때 나올 수 있는 답의 범위.
// 거짓말은 그 형식에서 나올 수 있는 답 중 실제와 다른 아무 답이다 (makeClue 와 같은 규칙).
import { nbr4, nbr8 } from '../core/board';
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
  if (d.camp === 'witness') {
    if (d.ability) return '진술 대신 능력을 씁니다. 결과는 참입니다. 단, 오염되면 반대로 답합니다.';
    return '항상 참말을 합니다. 단, 오염되면 거짓말을 합니다.';
  }
  if (id === 'braggart') return '약사 형식으로 말하고 항상 거짓말을 합니다.';
  if (id === 'lost') return '약사 형식으로 참말을 하지만, 오른쪽 칸(없으면 왼쪽)을 가운데로 놓고 셉니다.';
  if (!d.clue && d.face !== 'witness' && d.camp === 'trouble') return '진술이 없습니다.';
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
    default:
      return { truth: '', lie: '' }; // 작업 6 에서 새 문장으로
    case 'bossRow':
      return {
        truth: '주범이 있는 가로줄 번호를 그대로 말합니다.',
        lie: `${spot ? `1 ~ ${spot.h}번째` : '판의'} 가로줄 중 주범이 없는 줄을 말합니다.`,
      };
  }
}

const COUNT_KINDS: ClueKind[] = ['evil4', 'evil8', 'evilRow', 'evilCol', 'nearest'];

/** 직업 id 의 말하는 방식. spot 이 있으면 그 칸 기준 숫자로 적는다. */
export function speechLines(id: RoleId, spot?: Spot): SpeechLine[] {
  const d = role(id);
  const out: SpeechLine[] = [{ label: '말투', text: manner(id) }];
  const canTrue = d.camp === 'witness' || d.mode === 'true' || d.mode === 'any' || id === 'lost';
  const canLie = d.camp === 'witness' || id === 'braggart' || (d.camp !== 'trouble' && d.mode !== 'true');

  if (d.clue) {
    const f = formLines(d.clue, d.shift === 'right', spot);
    if (canTrue) out.push({ label: '참말일 때', text: f.truth });
    if (canLie) out.push({ label: '거짓말일 때', text: f.lie });
    if (COUNT_KINDS.includes(d.clue)) out.push({ label: '세는 법', text: '자기 칸은 세지 않습니다. 그림자(주범)는 악인데도 세지 않습니다.' });
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
