// 비밀번호 재설정 메일 보내기 (회원 본인의 "비밀번호 찾기"와 관리자의 "재설정 메일 보내기"가 같이 씁니다)
//
// 왜 로그인 쿠키를 쓰는 일반 클라이언트가 아니라 createServerSupabase()를 쓰나요?
//   Supabase 기본 방식(PKCE)은 "메일을 요청한 브라우저"에 확인용 값(code verifier)을 쿠키로 저장해 두고,
//   메일 링크를 눌렀을 때 그 값과 맞춰 봅니다. 관리자가 대신 요청하면 값이 관리자 브라우저에 남아서
//   회원이 링크를 눌렀을 때 실패합니다. 그래서 쿠키를 쓰지 않는 클라이언트로 보내고,
//   메일 템플릿은 token_hash 방식(/auth/confirm)을 씁니다. (Supabase 대시보드 설정은 안내 참고)
import "server-only";
import { getSiteUrl } from "@/lib/auth/site-url";
import { createServerSupabase } from "@/lib/supabase/server";

export type ResetMailResult = { ok: true } | { ok: false; reason: "rate-limit" | "failed" };

export async function sendPasswordResetMail(email: string): Promise<ResetMailResult> {
  const { error } = await createServerSupabase().auth.resetPasswordForEmail(email, {
    // 기본 템플릿을 쓰는 경우를 위한 돌아올 주소 (token_hash 템플릿에서는 쓰이지 않음)
    redirectTo: `${getSiteUrl()}/auth/confirm`,
  });
  if (!error) {
    return { ok: true };
  }
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return { ok: false, reason: "rate-limit" };
  }
  console.error("[auth] 비밀번호 재설정 메일 발송 실패", error.code, error.message);
  return { ok: false, reason: "failed" };
}
