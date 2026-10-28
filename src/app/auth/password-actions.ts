// 비밀번호 찾기(메일 요청) / 새 비밀번호 저장 Server Action
"use server";

import { redirect } from "next/navigation";
import { landingPathAfterLogin } from "@/lib/auth/landing";
import { sendPasswordResetMail } from "@/lib/auth/password-reset";
import { checkPassword, isValidEmail } from "@/lib/auth/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type ForgotState = { status: "error"; error: string; email: string } | { status: "sent"; email: string } | undefined;
export type ResetState = { error: string } | undefined;

// 비밀번호 찾기: 가입된 이메일인지와 상관없이 같은 안내를 보여줍니다. (가입 여부가 노출되지 않게)
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isValidEmail(email)) {
    return { status: "error", error: "이메일 형식이 올바르지 않습니다.", email };
  }
  const result = await sendPasswordResetMail(email);
  if (!result.ok && result.reason === "rate-limit") {
    return { status: "error", error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", email };
  }
  if (!result.ok) {
    return { status: "error", error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", email };
  }
  return { status: "sent", email };
}

// 새 비밀번호 저장: 메일 링크로 만들어진 임시 로그인 상태에서만 동작합니다.
export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const invalid = checkPassword(password, passwordConfirm);
  if (invalid) {
    return { error: invalid };
  }

  const supabase = await createAuthSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 진행해 주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[auth] 비밀번호 변경 실패", error.code, error.message);
    if (error.code === "same_password") {
      return { error: "이전과 다른 비밀번호를 입력해 주세요." };
    }
    if (error.code === "weak_password") {
      return { error: "비밀번호가 너무 쉽습니다. 더 복잡하게 만들어 주세요." };
    }
    return { error: "비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 비밀번호를 바꿨으니 다른 기기의 로그인은 모두 끊습니다. (실패해도 변경은 끝났으므로 로그만 남김)
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.error("[auth] 다른 기기 로그아웃 실패", signOutError.message);
  }

  redirect((await landingPathAfterLogin(supabase, user.id)) ?? "/");
}
