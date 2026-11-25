// 화면에 쓰는 이름표
import { type Camp, type Side } from '../core/types';

export const CAMP_NAME: Record<Camp, string> = {
  witness: '증인',
  trouble: '말썽꾼',
  accomplice: '공범',
  boss: '주범',
};

export const SIDE_NAME: Record<Side, string> = { good: '선', evil: '악' };
