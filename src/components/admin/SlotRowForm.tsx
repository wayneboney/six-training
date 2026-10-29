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
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
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
        <span aria-hidden="true">-</span>
        <label className="sr-only" htmlFor={`end-${slot.id}`}>
          종료 시각
        </label>
        <input
          key={`e-${slot.endTime ?? ""}`}
          id={`end-${slot.id}`}
          name="endTime"
          type="time"
          required
          defaultValue={slot.endTime ?? undefined}
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

      {/* 삭제: 저장 버튼 바로 옆. 예약이 있으면 확인 팝업에 취소될 건수가 나옵니다 */}
      <MemberActionForm
        action={deleteSlotAction.bind(null, slot.id)}
        submitLabel="삭제"
        pendingLabel="삭제 중…"
        confirmMessage={`${slot.endTime ? `${slot.startTime} - ${slot.endTime}` : slot.startTime} ${classLabelsKo[slot.classType as keyof typeof classLabelsKo] ?? slot.classType} 수업을 삭제할까요?\n이 수업의 예약 기록이 지난 수업까지 모두 함께 삭제되며, 되돌릴 수 없습니다.${slot.booked > 0 ? `\n(오늘 이후 예약/대기 ${slot.booked}건 포함)` : ""}`}
        layout="inline"
      />

      {/* 알림이 필요할 때만 작게: 예약이 있으면 건수, 종료 시각이 비어 있으면 입력 안내 */}
      {slot.booked > 0 && <span className="text-xs text-muted">예약 {slot.booked}건</span>}
      {slot.endTime === null && <span className="text-xs font-bold text-accent">종료 시각 입력 필요</span>}
    </li>
  );
}
