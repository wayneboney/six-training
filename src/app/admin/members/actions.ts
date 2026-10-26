// 회원 관리 Server Action. 순서: ① 관리자 확인 → ② 입력값 검증 → ③ DB 함수 호출 → ④ 화면 갱신
// 실제 규칙(홀딩 횟수, 날짜 겹침 등)은 DB 함수가 최종 판단하고, 여기서는 형식만 먼저 검사합니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { parseBigintId, parseDate, parseInteger, parseNote, parseUuid } from "@/lib/members/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type MemberActionState = ActionResult | undefined;

const BAD_REQUEST: MemberActionState = { ok: false, message: "잘못된 요청입니다. 화면을 새로고침한 뒤 다시 시도해 주세요." };

// 처리 후 이 회원의 화면과 목록을 새 데이터로 다시 그리게 합니다.
function refresh(userId: string) {
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}

// 회원권 등록 (= 가입 승인). 이미 이용 중이면 DB가 끝난 다음 날부터 이어서 시작시킵니다.
export async function registerMembershipAction(
  userId: string,
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  await requireAdmin();
  const uid = parseUuid(userId);
  const days = parseInteger(formData.get("days"));
  const startDate = parseDate(formData.get("startDate"));
  const note = parseNote(formData.get("note"));
  if (!uid || days === null || days < 1 || days > 1100) {
    return BAD_REQUEST;
  }
  if (startDate === undefined) {
    return { ok: false, message: "시작일 형식이 올바르지 않습니다." };
  }
  // 시작일 칸이 화면에 있는데(= 이어 붙일 회원권이 없는 경우) 비어 있으면 선택하라고 안내합니다.
  // 칸 자체가 없으면(목록의 빠른 승인, 이어서 시작) 비워 둔 것이 정상이며 DB가 알아서 정합니다.
  if (formData.has("startDate") && startDate === null) {
    return { ok: false, message: "시작일을 선택해 주세요." };
  }
  if (note === undefined) {
    return { ok: false, message: "메모는 200자 이하로 입력해 주세요." };
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_register_membership", {
    p_user_id: uid,
    p_days: days,
    p_start_date: startDate,
    p_note: note,
  });
  if (error) {
    return toFailure(error, "회원권 등록");
  }
  refresh(uid);
  return { ok: true, message: "회원권을 등록했습니다." };
}

// 역할/상태 수정 (콤보박스)
export async function updateMemberAction(
  userId: string,
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  await requireAdmin();
  const uid = parseUuid(userId);
  const role = formData.get("role");
  const status = formData.get("status");
  if (!uid || typeof role !== "string" || typeof status !== "string") {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_update_member", {
    p_user_id: uid,
    p_role: role,
    p_status: status,
  });
  if (error) {
    return toFailure(error, "회원 수정");
  }
  refresh(uid);
  return { ok: true, message: "저장했습니다." };
}

// 홀딩 해제 (회원이 등록한 홀딩을 관리자가 풀어 줌. 시작된 홀딩은 오늘부터 풀리고, 사용한 횟수는 돌아오지 않음)
// 홀딩 등록은 회원만 합니다. (/me)
export async function cancelHoldAction(userId: string, holdId: number): Promise<MemberActionState> {
  await requireAdmin();
  const uid = parseUuid(userId);
  const hid = parseBigintId(holdId);
  if (!uid || hid === null) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("admin_cancel_hold", { p_hold_id: hid });
  if (error) {
    return toFailure(error, "홀딩 해제");
  }
  refresh(uid);
  return { ok: true, message: "홀딩을 해제했습니다." };
}

// 서비스 일수 추가/차감. 같은 입력칸에서 어떤 버튼을 눌렀는지(mode)로 구분합니다.
//   add    : 일수를 더함 (끝난 회원권도 가능)
//   remove : 잘못 추가한 서비스 일수를 되돌림 (그 회원권에 서비스로 추가한 일수까지만 가능, DB가 확인)
export async function adjustDaysAction(
  userId: string,
  membershipId: number,
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  await requireAdmin();
  const uid = parseUuid(userId);
  const mid = parseBigintId(membershipId);
  const mode = formData.get("mode");
  const days = parseInteger(formData.get("days"));
  const note = parseNote(formData.get("note"));
  if (!uid || mid === null || (mode !== "add" && mode !== "remove")) {
    return BAD_REQUEST;
  }
  if (days === null || days < 1 || days > 1000) {
    return { ok: false, message: "일수는 1~1000일로 입력해 주세요." };
  }
  if (note === undefined) {
    return { ok: false, message: "메모는 200자 이하로 입력해 주세요." };
  }

  const supabase = await createAuthSupabase();
  const { error } =
    mode === "add"
      ? await supabase.rpc("admin_add_membership_days", { p_membership_id: mid, p_days: days, p_note: note })
      : await supabase.rpc("admin_remove_membership_days", { p_membership_id: mid, p_days: days, p_note: note });
  if (error) {
    return toFailure(error, mode === "add" ? "일수 추가" : "일수 차감");
  }
  refresh(uid);
  return { ok: true, message: mode === "add" ? `${days}일을 추가했습니다.` : `${days}일을 차감했습니다.` };
}
