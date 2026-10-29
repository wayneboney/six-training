import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addSlotsAction, fillEndTimesAction, setEndTimeAction } from "@/app/admin/schedule/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import SlotRowForm from "@/components/admin/SlotRowForm";
import WeekdayPicker from "@/components/admin/WeekdayPicker";
import { classLabelsKo } from "@/data/timetable";
import { requireAdmin } from "@/lib/auth/admin";
import { weekdayLabels } from "@/lib/date";
import { listAdminSlots, type AdminSlot } from "@/lib/schedule/repository";

export const metadata: Metadata = {
  title: "시간표 관리",
};

const fieldClass = "rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

// 월(1) ~ 토(6). 일요일은 휴무라서 관리하지 않습니다.
const weekdays = [1, 2, 3, 4, 5, 6];

// 같은 시작 시각의 수업을 묶어서 (요일 목록, 현재 종료 시각들)을 보여줍니다. "종료 시각 한꺼번에 설정"에 씁니다.
function startGroups(slots: AdminSlot[]): { start: string; weekdays: number[]; ends: string[] }[] {
  const groups = new Map<string, { start: string; weekdays: number[]; ends: Set<string> }>();
  for (const slot of slots) {
    const group = groups.get(slot.startTime) ?? { start: slot.startTime, weekdays: [], ends: new Set<string>() };
    group.weekdays.push(slot.weekday);
    if (slot.endTime) {
      group.ends.add(slot.endTime);
    }
    groups.set(slot.startTime, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((g) => ({ start: g.start, weekdays: g.weekdays, ends: [...g.ends].sort() }));
}

// /admin/schedule = 시간표 관리. 수업 시간을 정해 두면 Program(운동 내용)을 등록하고, 회원이 그 시간으로 예약합니다.
export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="text-muted">확인 중…</p>}>
      <ScheduleAdmin />
    </Suspense>
  );
}

async function ScheduleAdmin() {
  await connection();
  await requireAdmin();

  let slots: AdminSlot[] | null = null;
  try {
    slots = await listAdminSlots();
  } catch (error) {
    console.error("[admin] 시간표 조회 실패", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">시간표 관리</h1>
        <p className="mt-2 text-sm text-muted">
          수업 시간을 정하면 회원이 그 시간으로 예약하고, 박스 소개의 시간표에도 바로 반영됩니다.
          (순서: 시간표 설정 → Program 등록 → 회원 예약)
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>예약이 있는 수업은 시작 시각과 종류를 바꿀 수 없습니다. 종료 시각과 정원은 바꿀 수 있고, 시작 시각을 바꾸려면 수업을 삭제한 뒤 새로 추가하세요.</li>
          <li>수업을 삭제하면 시작하지 않은 오늘 이후의 예약/대기가 모두 취소됩니다. 지난 수업의 예약 기록은 남습니다.</li>
          <li>이 정원은 기본값입니다. 특정 날짜만 20명 ↔ 30명으로 바꾸려면 수업 예약 화면에서 변경하세요.</li>
        </ul>
      </div>

      {slots !== null && (
        <>
          {/* 수업 추가: 여러 요일에 한 번에 */}
          <section className="space-y-3 rounded-lg border border-line p-4">
            <h2 className="font-black">수업 추가</h2>
            <p className="text-xs text-muted">요일을 여러 개 고르면 같은 시간의 수업이 한 번에 추가됩니다. (예: 월~금 19:00 - 20:00)</p>
            <MemberActionForm action={addSlotsAction} submitLabel="수업 추가" pendingLabel="추가 중…" layout="stack">
              <WeekdayPicker />
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="new-start">
                  시작 시각
                </label>
                <input id="new-start" name="startTime" type="time" required className={fieldClass} />
                <span aria-hidden="true">-</span>
                <label className="sr-only" htmlFor="new-end">
                  종료 시각
                </label>
                <input id="new-end" name="endTime" type="time" required className={fieldClass} />
                <select name="classType" aria-label="수업 종류" defaultValue="CROSSFIT" className={fieldClass}>
                  {(Object.keys(classLabelsKo) as (keyof typeof classLabelsKo)[]).map((type) => (
                    <option key={type} value={type}>
                      {classLabelsKo[type]}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm">
                  정원
                  <input name="capacity" type="number" required min={1} max={200} defaultValue={20} className={`${fieldClass} w-16`} />
                </label>
              </div>
            </MemberActionForm>
          </section>

          {/* 종료 시각 한꺼번에: 시작 시각이 같은 수업을 모든 요일에 한 번에 */}
          <section className="space-y-3 rounded-lg border border-line p-4">
            <h2 className="font-black">종료 시각 한꺼번에 설정</h2>
            <p className="text-xs text-muted">같은 시작 시각의 수업은 모든 요일에 한 번에 적용됩니다. 예약이 있어도 바꿀 수 있습니다.</p>
            <MemberActionForm
              action={fillEndTimesAction}
              submitLabel="비어 있는 종료 시각 채우기"
              pendingLabel="채우는 중…"
              confirmMessage="종료 시각이 비어 있는 수업(오픈짐 제외)의 종료 시각을 '시작 시각 + 입력한 분'으로 채웁니다. 이미 입력한 종료 시각은 바뀌지 않습니다. 진행할까요?"
              layout="inline"
            >
              <label className="flex items-center gap-1 text-sm">
                수업 시간
                <input name="minutes" type="number" required min={15} max={240} defaultValue={60} className={`${fieldClass} w-20`} />분
              </label>
            </MemberActionForm>
            <ul className="divide-y divide-line rounded-md border border-line">
              {startGroups(slots).map((group) => (
                <li key={group.start} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-bold">{group.start}</span>{" "}
                    <span className="text-muted">
                      {group.weekdays.map((d) => weekdayLabels[d]).join("·")} · 종료{" "}
                      {group.ends.length === 0 ? "미정" : group.ends.join(", ")}
                    </span>
                  </span>
                  <MemberActionForm
                    action={setEndTimeAction.bind(null, group.start)}
                    submitLabel="적용"
                    pendingLabel="적용 중…"
                    layout="inline"
                  >
                    <label className="sr-only" htmlFor={`end-${group.start}`}>
                      {group.start} 시작 수업의 종료 시각
                    </label>
                    <input id={`end-${group.start}`} name="endTime" type="time" required className={fieldClass} />
                  </MemberActionForm>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {slots === null ? (
        <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="font-bold">시간표를 불러오지 못했습니다.</p>
          <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
        </div>
      ) : (
        weekdays.map((weekday) => {
          const daySlots = slots.filter((s) => s.weekday === weekday);
          return (
            <section key={weekday} className="rounded-lg border border-line">
              <h2 className="border-b border-line bg-surface px-4 py-2 font-black">
                {weekdayLabels[weekday]}요일{" "}
                <span className="text-sm font-normal text-muted">수업 {daySlots.length}개</span>
              </h2>
              {daySlots.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">등록된 수업이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {daySlots.map((slot) => (
                    <SlotRowForm key={slot.id} slot={slot} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
