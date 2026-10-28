// 회원 관리 Server Action. 순서: ① 관리자 확인 → ② 입력값 검증 → ③ DB 함수 호출 → ④ 화면 갱신
// 실제 규칙(홀딩 횟수, 날짜 겹침 등)은 DB 함수가 최종 판단하고, 여기서는 형식만 먼저 검사합니다.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { PASSWORD_RESET_ENABLED } from "@/lib/auth/features";
import { sendPasswordResetMail } from "@/lib/auth/password-reset";
import { AVATAR_BUCKET } from "@/lib/profile/avatar";
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

// 회원 삭제: 계정(프로필, 회원권, 홀딩 기록 포함)과 프로필 사진 파일을 함께 지웁니다.
// 순서가 중요합니다. ① 사진 목록 확인 → ② 계정 삭제(실패하면 아무것도 지워지지 않음) → ③ 사진 파일 삭제
//   사진을 먼저 지우면 계정 삭제가 실패했을 때 사진만 사라지기 때문에, 계정을 먼저 지우고 사진은 마지막에 정리합니다.
//   (사진 삭제만 실패하면 파일이 남지만 회원 삭제는 이미 끝난 상태이므로 로그만 남깁니다.)
// 비활동 전환(회원권 종료)은 이 함수와 무관하게 아무것도 지우지 않습니다.
export async function deleteMemberAction(userId: string): Promise<MemberActionState> {
  await requireAdmin();
  const uid = parseUuid(userId);
  if (!uid) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();

  // ① 이 회원 폴더의 사진 파일 목록 (관리자는 DB 규칙으로 읽기 허용)
  const { data: files, error: listError } = await supabase.storage.from(AVATAR_BUCKET).list(uid, { limit: 100 });
  if (listError) {
    console.error("[members] 사진 목록 조회 실패", listError.message);
    return { ok: false, message: "사진 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  const paths = (files ?? []).map((file) => `${uid}/${file.name}`);

  // ② 계정 삭제 (관리자 확인, 자기 자신/관리자 계정 보호는 DB 함수가 합니다)
  const { error } = await supabase.rpc("admin_delete_member", { p_user_id: uid });
  if (error) {
    return toFailure(error, "회원 삭제");
  }

  // ③ 사진 파일 삭제
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
    if (removeError) {
      console.error("[members] 삭제한 회원의 사진 파일 정리 실패", removeError.message);
    }
  }

  revalidatePath("/admin/members");
  // redirect는 try/catch 밖에서 호출해야 합니다. 삭제된 회원의 상세 화면은 더 이상 없으므로 목록으로 이동
  redirect("/admin/members?deleted=1");
}

// 비밀번호 재설정 메일 보내기. 관리자는 새 비밀번호를 정하거나 볼 수 없고, 회원 본인이 메일의 링크로 직접 정합니다.
// 메일은 이 회원의 가입 이메일로만 갑니다. (이메일은 DB에서 읽으며 화면에서 받은 값은 쓰지 않음)
export async function sendPasswordResetAction(userId: string): Promise<MemberActionState> {
  await requireAdmin();
  if (!PASSWORD_RESET_ENABLED) {
    return { ok: false, message: "비밀번호 초기화는 아직 사용할 수 없습니다." };
  }
  const uid = parseUuid(userId);
  if (!uid) {
    return BAD_REQUEST;
  }

  const supabase = await createAuthSupabase();
  const { data: profile, error } = await supabase.from("profiles").select("email").eq("user_id", uid).maybeSingle();
  if (error) {
    return toFailure(error, "회원 이메일 조회");
  }
  const email = (profile?.email as string | null | undefined) ?? null;
  if (!email) {
    return { ok: false, message: "이 회원의 이메일을 찾을 수 없습니다." };
  }

  const result = await sendPasswordResetMail(email);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "rate-limit"
          ? "메일을 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요."
          : "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return { ok: true, message: `${email}로 비밀번호 재설정 메일을 보냈습니다.` };
}
