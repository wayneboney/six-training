// 수업 시간표 관리 Server Action. 순서: ① 관리자 확인 → ② 입력값 검증 → ③ DB 함수 호출 → ④ 화면 갱신
// 겹치는 시간, 예약이 있는 수업의 변경 제한 같은 최종 규칙은 DB 함수가 판단합니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { seoulTodayKey } from "@/lib/date";
import { getActiveCodes } from "@/lib/members/repository";
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

// 수업 삭제: 수업 칸과 그 수업의 모든 예약 기록(지난 수업 포함)을 완전히 지웁니다. 되돌릴 수 없습니다.
export async function deleteSlotAction(slotId: number): Promise<ScheduleActionState> {
  await requireAdmin();
  const id = parseBigintId(slotId);
  if (id === null) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("admin_delete_class_slot", { p_slot_id: id });
  if (error) {
    return toFailure(error, "수업 삭제");
  }
  refresh();
  const removed = typeof data === "number" ? data : 0;
  return {
    ok: true,
    message: removed > 0 ? `수업을 삭제했습니다. 예약 기록 ${removed}건도 함께 삭제했습니다.` : "수업을 삭제했습니다.",
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

// ---------- 수업 한 칸의 오늘 이후 예약 인원 (시간표 관리의 "?" 팝업) ----------
export type SlotBooking = {
  classDate: string; // YYYY-MM-DD
  status: "confirmed" | "waiting";
  name: string;
  guestLabel: string | null; // 드랍인/체험이면 그 이름, 회원이면 null
};

export type SlotBookingsResult = { ok: true; bookings: SlotBooking[] } | { ok: false; message: string };

// 팝업을 열 때만 불러옵니다. 관리자만 볼 수 있고(DB 규칙도 같음), 이름과 구분만 돌려줍니다.
export async function listSlotBookingsAction(slotId: number): Promise<SlotBookingsResult> {
  await requireAdmin();
  const id = parseBigintId(slotId);
  if (id === null) {
    return { ok: false, message: "잘못된 요청입니다. 화면을 새로고침한 뒤 다시 시도해 주세요." };
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase
    .from("reservations")
    .select("class_date, status, guest_name, guest_type, profiles(name)")
    .eq("slot_id", id)
    .gte("class_date", seoulTodayKey())
    .neq("status", "cancelled")
    .order("class_date", { ascending: true })
    .order("id", { ascending: true })
    .overrideTypes<
      {
        class_date: string;
        status: "confirmed" | "waiting";
        guest_name: string | null;
        guest_type: string | null;
        profiles: { name: string } | null;
      }[],
      { merge: false }
    >();
  if (error) {
    console.error("[admin] 수업 예약 인원 조회 실패", error);
    return { ok: false, message: "예약 인원을 불러오지 못했습니다." };
  }

  // 드랍인/체험 구분 이름은 공통코드에서 읽습니다. (조회에 실패해도 이름은 그대로 보여줌)
  let guestNames = new Map<string, string>();
  try {
    guestNames = new Map((await getActiveCodes("GUEST_TYPE")).map((c) => [c.code, c.name]));
  } catch (codeError) {
    console.error("[admin] 게스트 구분 조회 실패", codeError);
  }

  return {
    ok: true,
    bookings: data.map((row) => ({
      classDate: row.class_date,
      status: row.status,
      name: row.profiles?.name ?? row.guest_name ?? "(이름 없음)",
      guestLabel: row.guest_type ? (guestNames.get(row.guest_type) ?? row.guest_type) : null,
    })),
  };
}
