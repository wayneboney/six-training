// 날짜를 다루는 작은 도우미 함수 모음. 달력과 WOD 데이터가 같은 형식("YYYY-MM-DD")을 쓰도록 맞춥니다.

export const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

// 연, 월(0~11), 일 → "YYYY-MM-DD"
// JavaScript의 월은 0부터 시작합니다. (0 = 1월, 11 = 12월) Java의 Calendar.MONTH와 같은 방식
export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Date 객체 → "YYYY-MM-DD" (방문자 컴퓨터의 시간대 기준)
export function dateToKey(date: Date): string {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

// 한국 시간 기준 오늘 날짜 "YYYY-MM-DD".
// 서버는 보통 UTC 시간대라서 그냥 new Date()로 날짜를 만들면 한국 날짜와 하루 차이가 날 수 있습니다.
// en-CA 형식이 "YYYY-MM-DD" 모양이라 그대로 씁니다.
export function seoulTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// "YYYY-MM-DD" → 연, 월(0~11), 일
export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month: month - 1, day };
}

// "2026-10-26" → "10월 26일 (월)"
export function formatDateKey(key: string): string {
  const { year, month, day } = parseDateKey(key);
  const weekday = weekdayLabels[new Date(year, month, day).getDay()];
  return `${month + 1}월 ${day}일 (${weekday})`;
}

// 해당 월의 달력 칸 목록. 1일 앞의 빈칸은 null로 채웁니다.
// 예: 1일이 수요일이면 [null, null, null, 1, 2, 3, ...]
export function monthCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = 일요일
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 다음 달 0일 = 이번 달 마지막 날
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }
  return cells;
}
