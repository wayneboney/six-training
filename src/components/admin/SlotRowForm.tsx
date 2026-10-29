// 시간표 관리의 수업 한 줄: 시작 시각, 종류, 기본 정원을 고치는 폼 + 삭제 버튼.
// 서버 함수를 실행하는 폼(MemberActionForm)을 쓰므로 브라우저에서 실행되는 컴포넌트입니다.
"use client";

import { deleteSlotAction, updateSlotAction } from "@/app/admin/schedule/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import SlotBookingsButton from "@/components/admin/SlotBookingsButton";
import { classLabelsKo } from "@/data/timetable";
import type { AdminSlot } from "@/lib/schedule/repository";

const fieldClass = "rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

export default function SlotRowForm({ slot }: { slot: AdminSlot }) {
  // 예약 N건 + 인원 보기(?) 버튼. 모바일은 윗줄(시각 줄)의 남는 오른쪽 자리에, PC는 삭제 버튼 오른쪽에 보입니다. (같은 내용을 두 곳에 두고 화면 크기로 하나만 보여줌)
  const bookingNote = slot.booked > 0 && (
    <>
      <span className="whitespace-nowrap text-xs text-muted">예약 {slot.booked}건</span>
      <SlotBookingsButton
        slotId={slot.id}
        label={`${slot.endTime ? `${slot.startTime} - ${slot.endTime}` : slot.startTime} ${classLabelsKo[slot.classType as keyof typeof classLabelsKo] ?? slot.classType}`}
      />
    </>
  );

  return (
    // [&_button]:px-3 = 모바일에서 이 줄의 버튼(저장, 삭제) 좌우 여백을 줄여서 두 버튼이 한 줄에 나란히 들어가게 합니다
    <li className="flex flex-wrap items-center gap-1.5 px-3 py-2 sm:gap-2 [&_button]:px-3 sm:[&_button]:px-4">
      <MemberActionForm
        action={updateSlotAction.bind(null, slot.id)}
        submitLabel="저장"
        pendingLabel="저장 중…"
        layout="contents"
      >
        {/* 시작 - 종료: 모바일에서는 이 묶음이 한 줄을 차지하고(basis-full), 그 아래 줄에 종류·정원·저장·삭제가 나란히 옵니다 */}
        <div className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto sm:flex-nowrap">
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
          {/* 모바일: 시각 줄의 오른쪽 빈자리. 자리가 모자란 좁은 화면에서는 시각 아래 줄로 내려갑니다 */}
          {bookingNote && <div className="ml-auto flex items-center gap-1.5 sm:hidden">{bookingNote}</div>}
        </div>
        <select
          key={`c-${slot.classType}`}
          name="classType"
          aria-label="수업 종류"
          defaultValue={slot.classType}
          className={`${fieldClass} w-28 pr-7!`}
        >
          {(Object.keys(classLabelsKo) as (keyof typeof classLabelsKo)[]).map((type) => (
            <option key={type} value={type}>
              {classLabelsKo[type]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          {/* 모바일은 자리가 좁아서 "정원" 글자 대신 숫자 뒤에 "명"만 붙입니다 */}
          <span className="hidden sm:inline">정원</span>
          <input
            key={`p-${slot.capacity}`}
            name="capacity"
            type="number"
            required
            min={1}
            max={200}
            aria-label="정원"
            defaultValue={slot.capacity}
            className={`${fieldClass} w-14`}
          />
          <span className="text-xs text-muted sm:hidden">명</span>
        </label>
      </MemberActionForm>

      {/* 삭제: 저장 버튼 바로 옆. 예약이 있으면 확인 팝업에 취소될 건수가 나옵니다 */}
      <MemberActionForm
        action={deleteSlotAction.bind(null, slot.id)}
        submitLabel="삭제"
        pendingLabel="삭제 중…"
        confirmMessage={`${slot.endTime ? `${slot.startTime} - ${slot.endTime}` : slot.startTime} ${classLabelsKo[slot.classType as keyof typeof classLabelsKo] ?? slot.classType} 수업을 삭제할까요?\n이 수업의 예약 기록이 지난 수업까지 모두 함께 삭제되며, 되돌릴 수 없습니다.\n(회원의 출석 일수는 줄어들지 않습니다.)${slot.booked > 0 ? `\n(오늘 이후 예약/대기 ${slot.booked}건 포함)` : ""}`}
        layout="contents"
      />

      {/* 알림이 필요할 때만 작게: 예약이 있으면 건수, 종료 시각이 비어 있으면 입력 안내 */}
      {bookingNote && <div className="hidden items-center gap-1.5 sm:flex">{bookingNote}</div>}
      {slot.endTime === null && <span className="text-xs font-bold text-accent">종료 시각 입력 필요</span>}
    </li>
  );
}
