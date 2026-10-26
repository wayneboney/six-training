// 회원 가입/로그인/로그아웃 Server Action. 모든 검증은 서버에서 합니다.
"use server";

import { redirect } from "next/navigation";
import { landingPathAfterLogin } from "@/lib/auth/landing";
import { getSiteUrl } from "@/lib/auth/site-url";
import { validateSignup } from "@/lib/auth/validation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type SignupState =
  | { status: "error"; error: string; email: string; name: string }
  | { status: "check-email"; email: string }
  | undefined;

export type MemberLoginState = { error: string; email: string } | undefined;

// 로그인 실패 메시지는 한 가지로 통일 (이메일 존재 여부를 알아내는 데 악용되는 것을 막기 위해)
const INVALID_LOGIN = "이메일 또는 비밀번호가 올바르지 않습니다.";

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = validateSignup(formData);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error, email: parsed.email, name: parsed.name };
  }
  const { email, name, password } = parsed.value;

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // 가입 정보에 이름을 담아 보내면 DB 트리거가 profiles를 만들 때 읽어 갑니다. (role/status는 읽지 않으므로 보내도 소용없음)
      data: { name },
      // 인증 메일의 확인 링크가 돌아올 주소 (Supabase 대시보드의 Redirect URLs에 등록된 주소여야 함)
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    console.error("[auth] 회원가입 실패", error.code, error.message);
    return { status: "error", error: toSignupMessage(error.code), email, name };
  }

  // 이메일 인증을 끈 상태면 가입과 동시에 로그인(session)이 만들어집니다 → 바로 내 정보 화면으로
  if (data.session) {
    redirect("/me");
  }
  // 이메일 인증을 켠 상태면 메일의 링크를 눌러야 로그인됩니다.
  // (이미 가입된 이메일이어도 같은 안내를 보여줍니다. 가입 여부가 노출되지 않게 하기 위해)
  return { status: "check-email", email };
}

function toSignupMessage(code: string | undefined): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "weak_password":
      return "비밀번호가 너무 쉽습니다. 더 복잡하게 만들어 주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "email_address_invalid":
      return "사용할 수 없는 이메일입니다.";
    default:
      return "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export async function memberLogin(_prev: MemberLoginState, formData: FormData): Promise<MemberLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해 주세요.", email };
  }
  if (email.length > 254 || password.length > 128) {
    return { error: INVALID_LOGIN, email };
  }

  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 이메일 인증 전 계정은 별도 안내 (인증 안내는 비밀번호가 맞아야만 나오므로 정보 노출 위험이 낮음)
    if (error.code === "email_not_confirmed") {
      return { error: "이메일 인증이 아직 완료되지 않았습니다. 받은 메일의 링크를 눌러 주세요.", email };
    }
    return { error: INVALID_LOGIN, email };
  }
  // 일반회원은 홈, 관리자는 관리자 화면으로
  const landing = await landingPathAfterLogin(supabase, data.user.id);
  if (!landing) {
    await supabase.auth.signOut();
    return { error: "로그인 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", email };
  }
  redirect(landing);
}

export async function memberLogout(): Promise<void> {
  const supabase = await createAuthSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
