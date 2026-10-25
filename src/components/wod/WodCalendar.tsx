// 월 이동, 날짜 선택처럼 클릭에 반응해야 해서 브라우저에서 실행되는 컴포넌트로 만듭니다.
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import WodDetail from "@/components/wod/WodDetail";
import { wodTypeStyles } from "@/components/wod/wodTypeStyles";
import { wodTypeLabels, wodTypes, type Wod } from "@/data/wods";
import { dateToKey, monthCells, parseDateKey, toDateKey, weekdayLabels } from "@/lib/date";

type WodCalendarProps = {
  // WOD 목록은 바깥(page.tsx)에서 넘겨받습니다.
  // 이 컴포넌트는 데이터가 파일에서 왔는지 DB에서 왔는지 모르기 때문에, 나중에 DB로 바꿔도 수정할 필요가 없습니다.
  wods: Wod[];
};

export default function WodCalendar({ wods }: WodCalendarProps) {
  // 날짜별로 WOD를 묶어 둡니다. { "2026-10-26": [Wod, Wod], ... } (Java의 Map<String, List<Wod>>)
  // useMemo = wods가 바뀔 때만 다시 계산 (화면이 다시 그려질 때마다 매번 계산하지 않도록)
  const wodsByDate = useMemo(() => {
    const map = new Map<string, Wod[]>();
    for (const wod of wods) {
      map.set(wod.date, [...(map.get(wod.date) ?? []), wod]);
    }
    return map;
  }, [wods]);

  // 오늘 날짜. 페이지는 빌드할 때 미리 만들어지므로 그때는 "오늘"을 알 수 없어서 null,
  // 방문자 브라우저에서 화면이 열리면 그 컴퓨터의 오늘 날짜가 들어옵니다.
  const today = useToday();

  // 방문자가 직접 고른 달/날짜. 아직 고르지 않았으면 null이고, 그때는 오늘 기준으로 보여줍니다.
  const [pickedView, setPickedView] = useState<{ year: number; month: number } | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  // 오늘을 아직 모를 때(빌드 시점) 보여줄 달: 가장 최근 WOD가 있는 달
  // "YYYY-MM-DD" 문자열은 글자 순서 = 날짜 순서라서 문자열 비교로 가장 늦은 날짜를 찾을 수 있습니다.
  const latestKey = wods.reduce((max, wod) => (wod.date > max ? wod.date : max), "");
  const fallbackKey = today ?? latestKey;
  const fallback = fallbackKey ? parseDateKey(fallbackKey) : { year: 2026, month: 0 };

  // 실제로 화면에 쓰는 값 = 직접 고른 값이 있으면 그것, 없으면 오늘 기준 (?? = null이면 오른쪽 값 사용)
  const view = pickedView ?? { year: fallback.year, month: fallback.month };
  const selected = pickedDate ?? today;

  // 이전/다음 달로 이동. 1월에서 이전으로 가면 작년 12월이 되도록 Date가 알아서 계산하게 합니다.
  function moveMonth(diff: number) {
    const next = new Date(view.year, view.month + diff, 1);
    setPickedView({ year: next.getFullYear(), month: next.getMonth() });
  }

  // "오늘" 버튼: 직접 고른 값을 지워서 다시 오늘 기준으로 돌아갑니다.
  function goToday() {
    setPickedView(null);
    setPickedDate(null);
  }

  const cells = monthCells(view.year, view.month);

  return (
    // lg 이상(1024px~): 왼쪽 달력 + 오른쪽 상세, 그보다 작으면 위아래로
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        {/* 달력 위쪽: 월 이동 */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
            className="rounded-md border border-line px-3 py-1 hover:bg-surface"
          >
            ‹
          </button>
          <h2 className="text-xl font-black">
            {view.year}년 {view.month + 1}월
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-line px-3 py-1 text-sm hover:bg-surface"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="다음 달"
              className="rounded-md border border-line px-3 py-1 hover:bg-surface"
            >
              ›
            </button>
          </div>
        </div>

        {/* 요일 머리글 */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-muted">
          {weekdayLabels.map((label, index) => (
            <div key={label} className={`py-2 ${index === 0 ? "text-accent" : ""}`}>
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 칸 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            // 1일 앞의 빈칸
            if (day === null) {
              return <div key={`empty-${index}`} />;
            }

            const key = toDateKey(view.year, view.month, day);
            const dayWods = wodsByDate.get(key) ?? [];
            const isSelected = key === selected;
            const isToday = key === today;
            const isSunday = index % 7 === 0;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setPickedDate(key)}
                aria-pressed={isSelected}
                aria-label={`${view.month + 1}월 ${day}일${dayWods.length > 0 ? `, WOD ${dayWods.length}개` : ""}`}
                className={`flex min-h-16 flex-col items-center gap-1 rounded-md border p-1 text-sm sm:min-h-20 ${
                  isSelected
                    ? "border-accent bg-accent text-white"
                    : isToday
                      ? "border-accent"
                      : "border-line hover:bg-surface"
                }`}
              >
                <span
                  className={`font-bold ${!isSelected && isSunday ? "text-accent" : ""}`}
                >
                  {day}
                </span>
                {/* 그날 있는 WOD 종류를 작은 표시로. 모바일은 점, PC(sm 이상)는 글자 */}
                <span className="flex flex-wrap justify-center gap-0.5">
                  {dayWods.map((wod, wodIndex) => (
                    <WodMark key={wodIndex} type={wod.type} inverted={isSelected} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        {/* 범례: 종류 목록(wodTypes)을 돌면서 만들어서, 종류가 늘어나도 여기는 고칠 필요가 없습니다 */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {wodTypes.map((type) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${wodTypeStyles[type].color}`} />
              {wodTypeLabels[type]}
            </span>
          ))}
        </div>
      </div>

      {/* 선택한 날짜의 WOD 상세 */}
      <WodDetail date={selected} wods={selected ? (wodsByDate.get(selected) ?? []) : []} />
    </div>
  );
}

// 브라우저에서만 알 수 있는 "오늘 날짜"를 읽어 오는 훅(hook).
// useSyncExternalStore = React 바깥의 값(여기서는 컴퓨터 시계)을 안전하게 읽는 React 공식 방법
//   - 세 번째 함수: 서버(빌드)에서 쓸 값 → null (오늘을 모름)
//   - 두 번째 함수: 브라우저에서 쓸 값 → 오늘 날짜
// 날짜가 바뀌는 순간을 실시간으로 감지할 필요는 없어서 구독(subscribe)은 아무 일도 하지 않습니다.
function useToday(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => dateToKey(new Date()),
    () => null,
  );
}

// 날짜 칸 안의 WOD 종류 표시
function WodMark({ type, inverted }: { type: Wod["type"]; inverted: boolean }) {
  const { color, short: shortLabel } = wodTypeStyles[type];
  return (
    <>
      {/* 모바일: 점 */}
      <span className={`h-1.5 w-1.5 rounded-full sm:hidden ${inverted ? "bg-white" : color}`} />
      {/* PC: 짧은 글자 */}
      <span
        className={`hidden rounded px-1 text-[10px] font-bold sm:inline ${
          inverted ? "bg-white text-accent" : `${color} text-white`
        }`}
      >
        {shortLabel}
      </span>
    </>
  );
}
