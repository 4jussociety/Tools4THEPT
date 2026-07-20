/**
 * 한국 시간(KST) 기반 날짜 유틸리티 함수 모음
 * ReportTab, BedModal 등 여러 컴포넌트에서 공통으로 사용하는 KST 변환 로직을 일원화합니다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 현재 시각을 KST 기준 YYYY-MM-DD 문자열로 반환합니다. */
export function getTodayKST(): string {
  const now = new Date();
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().split('T')[0];
}

/** ISO 타임스탬프를 KST 기준 YYYY-MM-DD 문자열로 변환합니다. */
export function getKSTDateString(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const kstDate = new Date(d.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().split('T')[0];
}

/** ISO 타임스탬프를 HH:MM 형식으로 포맷합니다. (로컬 시간 기준) */
export function formatTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** 방문 일자를 '오늘', '어제', 'N일 전' 또는 날짜로 포맷합니다. */
export function formatLastVisitDate(visitTimeStr: string): string {
  const visitDate = new Date(visitTimeStr);
  const today = new Date();
  const visitDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = todayDay.getTime() - visitDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return `${visitDate.getFullYear() % 100}.${(visitDate.getMonth() + 1).toString().padStart(2, '0')}.${visitDate.getDate().toString().padStart(2, '0')}`;
}

/** 지정된 일수만큼 과거의 KST 날짜를 YYYY-MM-DD로 반환합니다. */
export function getKSTPastDate(daysAgo: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const kstDate = new Date(past.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().split('T')[0];
}

/** 요일 문자열을 반환합니다 (0=일, 6=토). */
export function getDayOfWeekKR(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateObj = new Date(dateStr);
  return days[dateObj.getDay()];
}
