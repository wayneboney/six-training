import { connection } from "next/server";
import TimetableMobile from "@/components/timetable/TimetableMobile";
import { classStyles } from "@/components/timetable/classStyles";
import {
  classLabels,
  days,
  openingHours,
  timetableNotes,
  type ClassType,
  type DayKey,
  type TimeSlot,
} from "@/data/timetable";
import { getPublicTimetable } from "@/lib/schedule/repository";

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
// 시간표는 DB(관리자의 "시간표 관리"에서 바꾼 값)에서 읽습니다. 그래서 방문할 때마다 새로 읽습니다.
export default async function Timetable() {
  await connection();

  // DB 조회만 try/catch로 감쌉니다. 실패해도 페이지의 다른 부분은 그대로 보이게 안내 문구만 보여줍니다.
  let timetable: TimeSlot[] | null = null;
  try {
    timetable = await getPublicTimetable();
  } catch (error) {
    console.error("[timetable] 수업 시간표 조회 실패", error);
  }
  if (timetable === null) {
    return (
      <p role="alert" className="rounded-lg bg-surface p-6 text-center text-muted">
        수업 시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* PC: 요일 x 시간 표. 화면이 좁으면 숨기고 모바일용 목록을 보여줍니다. */}
      <table className="hidden w-full table-fixed border-separate border-spacing-1 text-center sm:table">
        <thead>
          <tr>
            <th className="w-36" />
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
              <th className="rounded bg-foreground px-1 py-3 text-sm font-bold text-white">{slot.time}</th>
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
      <TimetableMobile timetable={timetable} />

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
