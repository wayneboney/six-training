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
