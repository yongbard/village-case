// 화면에 쓰는 이름표
import { type Camp, type Side } from '../core/types';

export const CAMP_NAME: Record<Camp, string> = {
  witness: '증인',
  trouble: '말썽꾼',
  accomplice: '공범',
  boss: '주범',
};

export const SIDE_NAME: Record<Side, string> = { good: '선', evil: '악' };
/** 색만으로 구별하지 않도록 붙이는 모양: 선 = 빈 동그라미, 악 = 찬 동그라미 */
export const SIDE_MARK: Record<Side, string> = { good: '○', evil: '●' };
