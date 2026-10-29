// 출석한 날짜 목록: 월별로 묶어서 "10/29(목)" 모양으로 보여 줍니다. dates는 최근순 "YYYY-MM-DD".
import { parseDateKey, weekdayLabels } from "@/lib/date";

export default function AttendanceDates({ dates, total }: { dates: string[]; total: number }) {
  if (dates.length === 0) {
    return <p className="text-sm text-muted">아직 출석 기록이 없습니다.</p>;
  }

  // 월별로 묶기 (입력이 최근순이라 순서가 그대로 유지됩니다)
  const groups: { label: string; days: string[] }[] = [];
  for (const date of dates) {
    const { year, month, day } = parseDateKey(date);
    const label = `${year}년 ${month + 1}월`;
    const weekday = weekdayLabels[new Date(year, month, day).getDay()];
    const text = `${month + 1}/${day}(${weekday})`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.days.push(text);
    } else {
      groups.push({ label, days: [text] });
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-bold text-muted">
            {group.label} <span className="font-normal">· {group.days.length}일</span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {group.days.map((day) => (
              <li key={day} className="rounded border border-line px-2 py-0.5 text-sm">
                {day}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {total > dates.length && <p className="text-xs text-muted">최근 {dates.length}일만 보여 줍니다. (전체 {total}일)</p>}
    </div>
  );
}
