// 회원 본인 화면(/me) Server Action. 홀딩은 회원이 직접 등록합니다.
// 어느 회원권인지는 서버가 정합니다. 회원이 보내는 값은 시작일/종료일뿐이고, 남의 회원권은 건드릴 수 없습니다.
"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/member";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { parseDate } from "@/lib/members/validation";
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
