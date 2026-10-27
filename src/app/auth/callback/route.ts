// 인증 메일 링크 또는 카카오 로그인이 끝나고 돌아오는 주소: /auth/callback?code=...
// code를 로그인 세션으로 바꿔서 쿠키에 저장한 뒤, 역할에 맞는 화면으로 보냅니다. (Spring의 OAuth2 redirect URI 처리와 비슷)
//   관리자 → 관리자 화면 / 승인대기 회원 → 내 정보(승인 안내) / 그 밖의 회원 → 홈
import { NextResponse, type NextRequest } from "next/server";
import { createAuthSupabase } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // 카카오에서 "동의 취소" 등을 누르고 돌아오면 code 없이 error가 옵니다.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createAuthSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const path = profile?.role === "admin" ? "/admin" : profile?.status === "pending" ? "/me" : "/";
      return NextResponse.redirect(`${origin}${path}`);
    }
    console.error("[auth] 인증 코드 교환 실패", error?.code);
  }
  // 링크가 만료됐거나 이미 사용된 경우
  return NextResponse.redirect(`${origin}/login?error=link`);
}
