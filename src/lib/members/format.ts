// 화면 표시용 날짜 변환 도우미

// DB의 시각(ISO, 예: "2026-10-26T03:12:00+00:00") → 한국 날짜 "2026-10-26"
// 서버는 보통 UTC라서 그냥 앞 10글자를 자르면 한국 날짜와 하루 차이가 날 수 있어 시간대를 지정해서 변환합니다.
export function formatDateTimeToKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

// 홀딩 기간 표시. 시작 전에 해제한 홀딩은 종료일이 시작일보다 하루 앞으로 저장되어(사용 0일) 그대로 보여주면 이상해 보이므로 따로 표시합니다.
export function formatHoldRange(start: string, end: string, days: number): string {
  if (days <= 0) {
    return `${start} 시작 예정이었던 홀딩 (사용 0일)`;
  }
  return `${start} ~ ${end} (${days}일)`;
}
