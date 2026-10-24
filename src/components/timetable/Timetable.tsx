import TimetableMobile from "@/components/timetable/TimetableMobile";
import { classStyles } from "@/components/timetable/classStyles";
import {
  classLabels,
  days,
  openingHours,
  timetable,
  timetableNotes,
  type ClassType,
  type DayKey,
} from "@/data/timetable";

type Cell = { type: ClassType; span: number };

// 월~금 칸 중에서 같은 수업이 이어지는 칸을 하나로 합칩니다.
// 예: [CROSSFIT, CROSSFIT, CLOSE, CROSSFIT, CROSSFIT] → [CROSSFIT×2, CLOSE×1, CROSSFIT×2]
// 토요일은 원본 시간표처럼 항상 따로 표시합니다.
function mergeWeekdays(classes: Record<DayKey, ClassType>): Cell[] {
  const cells: Cell[] = [];
  for (const day of days) {
    if (day.key === "SAT") continue;
    const type = classes[day.key];
    const last = cells[cells.length - 1];
    if (last && last.type === type) {
      last.span += 1;
    } else {
      cells.push({ type, span: 1 });
    }
  }
  return cells;
}

// Timetable = 수업 시간표 전체 (PC 표 + 모바일 요일 탭 + 운영 시간 안내)
export default function Timetable() {
  return (
    <div className="space-y-6">
      {/* PC: 요일 x 시간 표. 화면이 좁으면 숨기고 모바일용 목록을 보여줍니다. */}
      <table className="hidden w-full table-fixed border-separate border-spacing-1 text-center sm:table">
        <thead>
          <tr>
            <th className="w-20" />
            {days.map((day) => (
              <th
                key={day.key}
                className={`rounded py-2 text-sm font-bold text-white ${
                  day.key === "SAT" ? "bg-foreground" : "bg-accent"
                }`}
              >
                {day.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timetable.map((slot) => (
            <tr key={slot.time}>
              <th className="rounded bg-foreground py-3 text-sm font-bold text-white">{slot.time}</th>
              {/* colSpan = 합쳐진 칸 수만큼 가로로 차지 */}
              {mergeWeekdays(slot.classes).map((cell, index) => (
                <td
                  key={index}
                  colSpan={cell.span}
                  className={`rounded border border-line py-3 text-sm ${classStyles[cell.type]}`}
                >
                  {classLabels[cell.type]}
                </td>
              ))}
              <td
                className={`rounded border border-line py-3 text-sm ${classStyles[slot.classes.SAT]}`}
              >
                {classLabels[slot.classes.SAT]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 모바일: 요일을 골라서 보는 목록 */}
      <TimetableMobile />

      {/* 운영 시간 */}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface p-4">
          <dt className="text-sm font-bold text-accent">OPEN</dt>
          <dd className="mt-1 text-xl font-black">{openingHours.open}</dd>
        </div>
        <div className="rounded-lg bg-surface p-4">
          <dt className="text-sm font-bold text-accent">CLOSE</dt>
          <dd className="mt-1 text-xl font-black">{openingHours.close}</dd>
        </div>
        <div className="rounded-lg bg-surface p-4">
          <dt className="text-sm font-bold text-muted">BREAK TIME</dt>
          <dd className="mt-1 text-xl font-black">{openingHours.breakTime}</dd>
        </div>
      </dl>

      <ul className="space-y-1 text-sm text-muted">
        {timetableNotes.map((note) => (
          <li key={note}>* {note}</li>
        ))}
      </ul>
    </div>
  );
}
