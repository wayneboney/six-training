// "use server" = 이 파일의 함수는 브라우저가 아니라 서버에서만 실행됩니다. (Server Action)
// 브라우저는 폼을 제출하기만 하고, 비밀번호 확인 같은 처리는 전부 서버에서 합니다. (Spring의 @PostMapping 컨트롤러 역할)
"use server";

import { redirect } from "next/navigation";
import { landingPathAfterLogin } from "@/lib/auth/landing";
import { createAuthSupabase } from "@/lib/supabase/auth";

// 로그인 폼에 돌려줄 결과. 에러가 있으면 메시지와 입력했던 이메일을 돌려줘서 다시 입력하지 않게 합니다.
export type LoginState = { error: string; email: string } | undefined;

// 로그인 실패 시 공통 메시지. "이메일이 없음"과 "비밀번호 틀림"을 구분해서 알려주면
// 어떤 이메일이 가입돼 있는지 알아내는 데 악용될 수 있어서 한 가지 메시지로 통일합니다.
const INVALID_LOGIN = "이메일 또는 비밀번호가 올바르지 않습니다.";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // 1) 입력값 검증 (브라우저 검사는 우회할 수 있으므로 서버에서 반드시 다시 검사)
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해 주세요.", email };
  }
  if (email.length > 254 || password.length > 128) {
    return { error: INVALID_LOGIN, email };
  }

  // 2) 로그인 시도. 성공하면 Supabase가 로그인 쿠키를 저장합니다.
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: INVALID_LOGIN, email };
  }

  // 3) 역할에 따라 이동할 화면 결정: 관리자는 관리자 화면, 일반회원은 홈
  //    (일반회원이 이 화면으로 로그인해도 로그아웃시키지 않고 홈으로 보냅니다. 관리자 화면은 각 페이지에서 따로 막습니다.)
  const landing = await landingPathAfterLogin(supabase, data.user.id);
  if (!landing) {
    await supabase.auth.signOut();
    return { error: "로그인 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", email };
  }

  // 4) 성공: 이동
  // redirect는 내부적으로 특별한 에러를 던져서 이동시키는 방식이라 try/catch 밖에서 호출해야 합니다.
  redirect(landing);
}
