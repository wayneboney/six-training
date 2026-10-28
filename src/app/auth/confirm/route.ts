// 비밀번호 재설정 메일의 링크: /auth/confirm?token_hash=...&type=recovery
// token_hash를 확인해서 "비밀번호를 바꿀 수 있는 임시 로그인"을 만들고 /reset-password로 보냅니다.
// (메일을 요청한 브라우저와 링크를 누른 브라우저가 달라도 동작합니다)
import { NextResponse, type NextRequest } from "next/server";
import { PASSWORD_RESET_ENABLED } from "@/lib/auth/features";
import { createAuthSupabase } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // 비밀번호 찾기를 쓰지 않는 동안에는 처리하지 않습니다. (src/lib/auth/features.ts)
  if (!PASSWORD_RESET_ENABLED) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // 이 주소는 비밀번호 재설정(recovery)만 처리합니다. 다른 종류는 받지 않습니다.
  if (tokenHash && type === "recovery") {
    const supabase = await createAuthSupabase();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    console.error("[auth] 재설정 링크 확인 실패", error.code);
  }
  return NextResponse.redirect(`${origin}/forgot-password?error=link`);
}
