/**
 * 텍스트 관련 유틸리티 함수 모음
 * 한글/영문 가중치 글자수 계산 등 텍스트 처리에 필요한 공용 함수를 제공합니다.
 */

/** 한글은 1.5, 영문/숫자는 1.0으로 가중치를 계산한 문자열 길이를 반환합니다. */
export function getWeightedLength(str: string): number {
  let score = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // 한글 유니코드 범위 감지 (AC00~D7A3: 완성형, 3130~318F: 자모)
    if ((charCode >= 0xac00 && charCode <= 0xd7a3) || (charCode >= 0x3130 && charCode <= 0x318f)) {
      score += 1.5;
    } else {
      score += 1.0;
    }
  }
  return score;
}

/** 가중치 기준 최대 길이에 맞게 문자열을 잘라 반환합니다. */
export function truncateByWeightedLength(val: string, maxWeight: number): string {
  let temp = '';
  let score = 0;
  for (const char of val) {
    const charCode = char.charCodeAt(0);
    const charScore = ((charCode >= 0xac00 && charCode <= 0xd7a3) || (charCode >= 0x3130 && charCode <= 0x318f)) ? 1.5 : 1.0;
    if (score + charScore <= maxWeight) {
      temp += char;
      score += charScore;
    } else {
      break;
    }
  }
  return temp;
}
