// 수업 예약 Server Action. 예약 규칙(정원, 자격, 시간)의 최종 판단은 DB 함수가 합니다.
// 여기서는 로그인/권한을 확인하고, 입력 형식을 검사한 뒤, DB 함수를 부르고 안내 문구를 돌려줍니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { requireMember } from "@/lib/auth/member";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { parseBigintId, parseDate, parseInteger } from "@/lib/members/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type ReserveActionState = ActionResult | undefined;

const BAD_REQUEST: ReserveActionState = {
  ok: false,
  message: "잘못된 요청입니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
};

// 예약하기 (정원이 차 있으면 자동으로 대기 등록)
export async function reserveAction(slotId: number, classDate: string): Promise<ReserveActionState> {
  await requireMember();
  const sid = parseBigintId(slotId);
  const date = parseDate(classDate);
  if (sid === null || !date) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("member_reserve_class", { p_slot_id: sid, p_class_date: date });
  if (error) {
    return toFailure(error, "수업 예약");
  }
  revalidatePath("/reserve");
  return data === "waiting"
    ? { ok: true, message: "정원이 차서 대기로 등록했습니다. 자리가 나면 자동으로 예약됩니다." }
    : { ok: true, message: "예약되었습니다." };
}

// 내 예약/대기 취소 (수업 시작 전까지)
export async function cancelReservationAction(reservationId: number): Promise<ReserveActionState> {
  await requireMember();
  const id = parseBigintId(reservationId);
  if (id === null) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("member_cancel_reservation", { p_reservation_id: id });
  if (error) {
    return toFailure(error, "예약 취소");
  }
  revalidatePath("/reserve");
  return { ok: true, message: "예약을 취소했습니다." };
}

// 관리자: 다른 회원의 예약/대기 취소
export async function adminCancelReservationAction(reservationId: number): Promise<ReserveActionState> {
  await requireAdmin();
  const id = parseBigintId(reservationId);
  if (id === null) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_cancel_reservation", { p_reservation_id: id });
  if (error) {
    return toFailure(error, "관리자 예약 취소");
  }
  revalidatePath("/reserve");
  return { ok: true, message: "예약을 취소했습니다." };
}

// 관리자: 그 날짜의 수업 정원을 20명 또는 30명으로 변경
export async function setCapacityAction(
  slotId: number,
  classDate: string,
  _prev: ReserveActionState,
  formData: FormData,
): Promise<ReserveActionState> {
  await requireAdmin();
  const sid = parseBigintId(slotId);
  const date = parseDate(classDate);
  const capacity = parseInteger(formData.get("capacity"));
  if (sid === null || !date) {
    return BAD_REQUEST;
  }
  if (capacity !== 20 && capacity !== 30) {
    return { ok: false, message: "정원은 20명 또는 30명만 선택할 수 있습니다." };
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_set_class_capacity", {
    p_slot_id: sid,
    p_class_date: date,
    p_capacity: capacity,
  });
  if (error) {
    return toFailure(error, "정원 변경");
  }
  revalidatePath("/reserve");
  return { ok: true, message: `정원을 ${capacity}명으로 바꿨습니다. 정원이 늘면 대기자가 자동으로 예약됩니다.` };
}
