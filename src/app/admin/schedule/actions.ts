// 수업 시간표 관리 Server Action. 순서: ① 관리자 확인 → ② 입력값 검증 → ③ DB 함수 호출 → ④ 화면 갱신
// 겹치는 시간, 예약이 있는 수업의 변경 제한 같은 최종 규칙은 DB 함수가 판단합니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { parseBigintId, parseInteger } from "@/lib/members/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type ScheduleActionState = ActionResult | undefined;

const BAD_REQUEST: ScheduleActionState = {
  ok: false,
  message: "잘못된 요청입니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
};

const CLASS_TYPES = ["CROSSFIT", "HYROX", "OPEN_GYM", "COACH_TRAINING"];

// 시작 시각 "HH:MM" (24시간). 올바르지 않으면 null
function parseTime(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

// 폼 값 공통 검증: 시작 시각, 종류, 기본 정원
type SlotForm = { ok: true; time: string; endTime: string; type: string; capacity: number } | { ok: false; message: string };

function parseSlotForm(formData: FormData): SlotForm {
  const time = parseTime(formData.get("startTime"));
  const endTime = parseTime(formData.get("endTime"));
  const type = formData.get("classType");
  const capacity = parseInteger(formData.get("capacity"));
  if (!time) {
    return { ok: false, message: "시작 시각을 입력해 주세요. (예: 19:00)" };
  }
  if (!endTime) {
    return { ok: false, message: "종료 시각을 입력해 주세요. (예: 20:00)" };
  }
  if (endTime <= time) {
    return { ok: false, message: "종료 시각은 시작 시각보다 늦어야 합니다." };
  }
  if (typeof type !== "string" || !CLASS_TYPES.includes(type)) {
    return { ok: false, message: "수업 종류를 선택해 주세요." };
  }
  if (capacity === null || capacity < 1 || capacity > 200) {
    return { ok: false, message: "정원은 1~200명으로 입력해 주세요." };
  }
  return { ok: true, time, endTime, type, capacity };
}

function refresh() {
  revalidatePath("/admin/schedule");
  revalidatePath("/reserve");
  revalidatePath("/about");
}

// 수업 수정 (시작 시각, 종류, 기본 정원)
export async function updateSlotAction(
  slotId: number,
  _prev: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  await requireAdmin();
  const id = parseBigintId(slotId);
  if (id === null) {
    return BAD_REQUEST;
  }
  const parsed = parseSlotForm(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_update_class_slot", {
    p_slot_id: id,
    p_start_time: parsed.time,
    p_end_time: parsed.endTime,
    p_class_type: parsed.type,
    p_capacity: parsed.capacity,
  });
  if (error) {
    return toFailure(error, "수업 수정");
  }
  refresh();
  return { ok: true, message: "수업을 수정했습니다." };
}

// 수업 삭제 (사용 안 함으로 바꾸고, 시작하지 않은 오늘 이후의 예약/대기를 모두 취소)
export async function deleteSlotAction(slotId: number): Promise<ScheduleActionState> {
  await requireAdmin();
  const id = parseBigintId(slotId);
  if (id === null) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("admin_deactivate_class_slot", { p_slot_id: id });
  if (error) {
    return toFailure(error, "수업 삭제");
  }
  refresh();
  const cancelled = typeof data === "number" ? data : 0;
  return {
    ok: true,
    message: cancelled > 0 ? `수업을 삭제했습니다. 예약/대기 ${cancelled}건을 취소했습니다.` : "수업을 삭제했습니다.",
  };
}

// 여러 요일에 같은 수업을 한 번에 추가 (하나라도 실패하면 DB가 전부 취소)
export async function addSlotsAction(_prev: ScheduleActionState, formData: FormData): Promise<ScheduleActionState> {
  await requireAdmin();
  const weekdays = [...new Set(formData.getAll("weekday").map((value) => parseInteger(value as FormDataEntryValue)))].filter(
    (day): day is number => day !== null && day >= 1 && day <= 6,
  );
  if (weekdays.length === 0) {
    return { ok: false, message: "요일을 하나 이상 선택해 주세요." };
  }
  const parsed = parseSlotForm(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("admin_add_class_slots", {
    p_weekdays: weekdays,
    p_start_time: parsed.time,
    p_end_time: parsed.endTime,
    p_class_type: parsed.type,
    p_capacity: parsed.capacity,
  });
  if (error) {
    return toFailure(error, "수업 여러 요일 추가");
  }
  refresh();
  const added = typeof data === "number" ? data : weekdays.length;
  return { ok: true, message: `${parsed.time} - ${parsed.endTime} 수업을 ${added}개 요일에 추가했습니다.` };
}

// 같은 시작 시각의 모든 수업에 종료 시각 설정 (시작 시각은 화면에서 bind로 붙여 오지만 조작될 수 있어서 다시 검사)
export async function setEndTimeAction(
  startTime: string,
  _prev: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  await requireAdmin();
  const start = parseTime(startTime);
  const end = parseTime(formData.get("endTime"));
  if (!start) {
    return BAD_REQUEST;
  }
  if (!end) {
    return { ok: false, message: "종료 시각을 입력해 주세요. (예: 20:00)" };
  }
  if (end <= start) {
    return { ok: false, message: "종료 시각은 시작 시각보다 늦어야 합니다." };
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("admin_set_class_end_time", { p_start_time: start, p_end_time: end });
  if (error) {
    return toFailure(error, "종료 시각 일괄 설정");
  }
  refresh();
  return { ok: true, message: `${start} 시작 수업 ${typeof data === "number" ? data : ""}개의 종료 시각을 ${end}로 바꿨습니다.` };
}

// 종료 시각이 비어 있는 수업(오픈짐 제외)을 "시작 + N분"으로 채우기
export async function fillEndTimesAction(_prev: ScheduleActionState, formData: FormData): Promise<ScheduleActionState> {
  await requireAdmin();
  const minutes = parseInteger(formData.get("minutes"));
  if (minutes === null || minutes < 15 || minutes > 240) {
    return { ok: false, message: "수업 시간은 15~240분으로 입력해 주세요." };
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("admin_fill_missing_end_times", { p_minutes: minutes });
  if (error) {
    return toFailure(error, "종료 시각 채우기");
  }
  refresh();
  const filled = typeof data === "number" ? data : 0;
  return {
    ok: true,
    message: filled > 0 ? `종료 시각이 비어 있던 수업 ${filled}개를 채웠습니다.` : "채울 수업이 없습니다. (종료 시각이 모두 입력되어 있습니다)",
  };
}
