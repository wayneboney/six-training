// 회원 본인 화면(/me) Server Action. 홀딩은 회원이 직접 등록합니다.
// 어느 회원권인지는 서버가 정합니다. 회원이 보내는 값은 시작일/종료일뿐이고, 남의 회원권은 건드릴 수 없습니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/member";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { parseBigintId, parseDate } from "@/lib/members/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type MyActionState = ActionResult | undefined;

export async function addMyHoldAction(_prev: MyActionState, formData: FormData): Promise<MyActionState> {
  await requireMember(); // 로그인이 풀렸으면 로그인 화면으로

  const holdStart = parseDate(formData.get("holdStart"));
  const holdEnd = parseDate(formData.get("holdEnd"));
  if (!holdStart || !holdEnd) {
    return { ok: false, message: "홀딩 시작일과 종료일을 올바르게 선택해 주세요." };
  }

  // 일수/횟수/기간/겹침 규칙은 DB 함수가 최종 판단합니다. (활동 상태의 본인 회원권만, 내일 이후부터)
  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("member_add_hold", { p_hold_start: holdStart, p_hold_end: holdEnd });
  if (error) {
    return toFailure(error, "홀딩 신청");
  }

  revalidatePath("/me");
  return { ok: true, message: "홀딩을 등록했습니다. 홀딩 일수만큼 종료일이 늘어났습니다." };
}

// 내 홀딩 해제. 시작 전이면 전부 되돌리고, 진행 중이면 어제까지 쉰 일수만 사용한 것으로 처리합니다. (사용한 횟수는 그대로)
// holdId는 화면에서 .bind로 붙여 오지만 조작될 수 있어서 다시 검사하고, 본인 홀딩인지는 DB 함수가 확인합니다.
export async function cancelMyHoldAction(holdId: number): Promise<MyActionState> {
  await requireMember();

  const id = parseBigintId(holdId);
  if (id === null) {
    return { ok: false, message: "잘못된 요청입니다. 화면을 새로고침한 뒤 다시 시도해 주세요." };
  }

  const supabase = await createAuthSupabase();
  const { error } = await supabase.rpc("member_cancel_hold", { p_hold_id: id });
  if (error) {
    return toFailure(error, "홀딩 해제");
  }

  revalidatePath("/me");
  return { ok: true, message: "홀딩을 해제했습니다. 쉰 일수만큼만 종료일이 늘어난 상태로 정리되었습니다." };
}
