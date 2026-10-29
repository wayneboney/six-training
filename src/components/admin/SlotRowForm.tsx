// 시간표 관리의 수업 한 줄: 시작 시각, 종류, 기본 정원을 고치는 폼 + 삭제 버튼.
// 서버 함수를 실행하는 폼(MemberActionForm)을 쓰므로 브라우저에서 실행되는 컴포넌트입니다.
"use client";

import { deleteSlotAction, updateSlotAction } from "@/app/admin/schedule/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import { classLabelsKo } from "@/data/timetable";
import type { AdminSlot } from "@/lib/schedule/repository";

const fieldClass = "rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

export default function SlotRowForm({ slot }: { slot: AdminSlot }) {
  return (
    <li className="space-y-2 p-3">
      <MemberActionForm
        action={updateSlotAction.bind(null, slot.id)}
        submitLabel="저장"
        pendingLabel="저장 중…"
        layout="inline"
      >
        <label className="sr-only" htmlFor={`time-${slot.id}`}>
          시작 시각
        </label>
        {/* key: 저장 후에도 DB의 현재 값이 보이도록 값이 바뀌면 입력칸을 새로 만듭니다 */}
        <input
          key={`t-${slot.startTime}`}
          id={`time-${slot.id}`}
          name="startTime"
          type="time"
          required
          defaultValue={slot.startTime}
          className={fieldClass}
        />
        <select
          key={`c-${slot.classType}`}
          name="classType"
          aria-label="수업 종류"
          defaultValue={slot.classType}
          className={fieldClass}
        >
          {(Object.keys(classLabelsKo) as (keyof typeof classLabelsKo)[]).map((type) => (
            <option key={type} value={type}>
              {classLabelsKo[type]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          정원
          <input
            key={`p-${slot.capacity}`}
            name="capacity"
            type="number"
            required
            min={1}
            max={200}
            defaultValue={slot.capacity}
            className={`${fieldClass} w-16`}
          />
        </label>
      </MemberActionForm>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {slot.booked > 0 ? (
          <span>오늘 이후 예약/대기 {slot.booked}건 (시간·종류는 바꿀 수 없고, 삭제하면 모두 취소됩니다)</span>
        ) : (
          <span>오늘 이후 예약 없음</span>
        )}
        <MemberActionForm
          action={deleteSlotAction.bind(null, slot.id)}
          submitLabel="삭제"
          pendingLabel="삭제 중…"
          confirmMessage={
            slot.booked > 0
              ? `${slot.startTime} ${classLabelsKo[slot.classType as keyof typeof classLabelsKo] ?? slot.classType} 수업을 삭제할까요?\n오늘 이후 예약/대기 ${slot.booked}건이 모두 취소됩니다. 되돌릴 수 없습니다.`
              : `${slot.startTime} ${classLabelsKo[slot.classType as keyof typeof classLabelsKo] ?? slot.classType} 수업을 삭제할까요?`
          }
          layout="inline"
        />
      </div>
    </li>
  );
}
