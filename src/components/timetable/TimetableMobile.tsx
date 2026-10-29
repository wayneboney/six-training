// 요일 버튼을 누르면 목록이 바뀌어야 해서 브라우저에서 실행되는 컴포넌트로 만듭니다.
"use client";

import { useState } from "react";
import { classStyles } from "@/components/timetable/classStyles";
import { classLabels, days, type DayKey, type TimeSlot } from "@/data/timetable";

// TimetableMobile = 모바일에서 요일을 골라 그날 수업만 보여주는 목록
// 7칸짜리 표는 휴대폰 화면에서 너무 좁아서, 요일별로 나눠서 보여줍니다.
export default function TimetableMobile({ timetable }: { timetable: TimeSlot[] }) {
  // 선택한 요일. 처음에는 월요일
  const [selected, setSelected] = useState<DayKey>("MON");

  return (
    <div className="sm:hidden">
      {/* 요일 버튼 */}
      <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="요일 선택">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={selected === day.key}
            onClick={() => setSelected(day.key)}
            className={`rounded py-2 text-sm font-bold ${
              selected === day.key ? "bg-accent text-white" : "bg-surface text-muted"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* 선택한 요일의 수업 목록 */}
      <ul className="mt-3 space-y-1" role="tabpanel">
        {timetable.map((slot) => {
          const type = slot.classes[selected];
          return (
            <li key={slot.time} className="flex gap-1">
              <span className="w-20 shrink-0 rounded bg-foreground py-3 text-center text-sm font-bold text-white">
                {slot.time}
              </span>
              <span
                className={`flex-1 rounded border border-line py-3 text-center text-sm ${classStyles[type]}`}
              >
                {classLabels[type]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
