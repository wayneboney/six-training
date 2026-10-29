import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addSlotsAction } from "@/app/admin/schedule/actions";
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

      {/* 수업 추가: 여러 요일에 한 번에 */}
      {slots !== null && (
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
            // 요일마다 접어 둡니다. 시간표는 한 번 정해 두면 자주 고치지 않아서, 길게 펼쳐지지 않게 합니다. 제목 줄에 시간이 요약으로 보입니다.
            <details key={weekday} className="rounded-lg border border-line">
              <summary className="cursor-pointer bg-surface px-4 py-3">
                <span className="font-black">{weekdayLabels[weekday]}요일</span>{" "}
                <span className="text-sm font-normal text-muted">
                  수업 {daySlots.length}개
                  {daySlots.length > 0 && ` · ${daySlots.map((s) => s.startTime).join(", ")}`}
                </span>
              </summary>
              {daySlots.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">등록된 수업이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {daySlots.map((slot) => (
                    <SlotRowForm key={slot.id} slot={slot} />
                  ))}
                </ul>
              )}
            </details>
          );
        })
      )}
    </div>
  );
}
