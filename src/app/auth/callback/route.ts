// 인증 메일(또는 소셜 로그인)의 링크를 눌렀을 때 돌아오는 주소: /auth/callback?code=...
// code를 로그인 세션으로 바꿔서 쿠키에 저장한 뒤 내 정보 화면으로 보냅니다. (Spring의 OAuth2 redirect URI 처리와 비슷)
import { NextResponse, type NextRequest } from "next/server";
import { createAuthSupabase } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createAuthSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/me`);
    }
    console.error("[auth] 인증 코드 교환 실패", error.code);
  }
  // 링크가 만료됐거나 이미 사용된 경우
  return NextResponse.redirect(`${origin}/login?error=link`);
}
