// 요일 여러 개를 고르는 체크박스 줄 (월~토) + "월~금", "전체", "해제" 빠른 선택 버튼.
// 선택한 요일은 같은 이름(weekday)의 값으로 폼에 함께 제출됩니다.
"use client";

import { useState } from "react";
import { weekdayLabels } from "@/lib/date";

const WEEKDAYS = [1, 2, 3, 4, 5, 6];

const quickButton = "rounded-md border border-line px-2 py-1 text-xs font-bold text-muted hover:bg-surface hover:text-foreground";

export default function WeekdayPicker() {
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(day: number) {
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold">요일 (여러 개 선택)</legend>
      <div className="flex flex-wrap items-center gap-2">
        {WEEKDAYS.map((day) => (
          <label
            key={day}
            className={`flex min-w-10 items-center justify-center rounded-md border px-3 py-1.5 text-sm font-bold ${
              selected.includes(day) ? "border-accent bg-accent text-white" : "border-line text-muted hover:bg-surface"
            }`}
          >
            {/* 체크박스는 화면에서 숨기고 글자 칸 전체가 눌리게 합니다 */}
            <input
              type="checkbox"
              name="weekday"
              value={day}
              checked={selected.includes(day)}
              onChange={() => toggle(day)}
              className="sr-only"
            />
            {weekdayLabels[day]}
          </label>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <button type="button" className={quickButton} onClick={() => setSelected([1, 2, 3, 4, 5])}>
          월~금
        </button>
        <button type="button" className={quickButton} onClick={() => setSelected(WEEKDAYS)}>
          월~토
        </button>
        <button type="button" className={quickButton} onClick={() => setSelected([])}>
          해제
        </button>
      </div>
    </fieldset>
  );
}
