// 출석한 날짜 목록: 이번 달만 바로 보여 주고, 지난달 이전은 "더 보기"로 접어 둡니다. 월별로 묶어서 "10/29(목)" 모양으로 보여 줍니다.
// dates는 최근순 "YYYY-MM-DD".
import { parseDateKey, seoulTodayKey, weekdayLabels } from "@/lib/date";

type Group = { key: string; label: string; days: string[] };

function MonthGroup({ group }: { group: Group }) {
  return (
    <div>
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
  );
}

export default function AttendanceDates({ dates, total }: { dates: string[]; total: number }) {
  if (dates.length === 0) {
    return <p className="text-sm text-muted">아직 출석 기록이 없습니다.</p>;
  }

  // 월별로 묶기 (입력이 최근순이라 순서가 그대로 유지됩니다)
  const groups: Group[] = [];
  for (const date of dates) {
    const { year, month, day } = parseDateKey(date);
    const key = `${year}-${month}`;
    const weekday = weekdayLabels[new Date(year, month, day).getDay()];
    const text = `${month + 1}/${day}(${weekday})`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.days.push(text);
    } else {
      groups.push({ key, label: `${year}년 ${month + 1}월`, days: [text] });
    }
  }

  // 이번 달(한국 시간) 묶음만 바로 보여 주고, 나머지는 접어 둡니다.
  const today = parseDateKey(seoulTodayKey());
  const thisMonthKey = `${today.year}-${today.month}`;
  const current = groups.find((g) => g.key === thisMonthKey);
  const older = groups.filter((g) => g.key !== thisMonthKey);
  const olderDays = older.reduce((sum, g) => sum + g.days.length, 0);

  return (
    <div className="space-y-3">
      {current ? <MonthGroup group={current} /> : <p className="text-sm text-muted">이번 달 출석이 아직 없습니다.</p>}

      {older.length > 0 && (
        <details className="rounded-md border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold">지난 출석 더 보기 ({olderDays}일)</summary>
          <div className="mt-3 space-y-3">
            {older.map((group) => (
              <MonthGroup key={group.key} group={group} />
            ))}
            {total > dates.length && <p className="text-xs text-muted">최근 {dates.length}일만 보여 줍니다. (전체 {total}일)</p>}
          </div>
        </details>
      )}
    </div>
  );
}
