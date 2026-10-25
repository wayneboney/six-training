// proxy = 요청이 페이지에 도착하기 전에 먼저 실행되는 코드 (Next.js 15까지는 middleware라고 불렀습니다)
// Java의 Servlet Filter와 비슷한 역할입니다.
//
// 여기서는 관리자 화면(/admin) 요청마다 로그인 쿠키(토큰)가 만료되기 전에 갱신만 합니다.
// ⚠️ 권한 검사는 여기서 하지 않습니다. 실제 검사는 각 페이지와 Server Action의 requireAdmin()에서 합니다.
//    (Next.js 문서 권장: proxy는 빠른 사전 처리용이고, 인증/권한의 최종 판단 장소가 아님)
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // 접속 정보가 없으면 갱신할 수 없으므로 그냥 통과시킵니다. (페이지에서 에러로 안내)
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 갱신된 쿠키를 ① 이번 요청(페이지가 읽을 값)과 ② 응답(브라우저에 저장할 값) 양쪽에 반영
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // 로그인 쿠키가 담긴 응답이 중간 서버(CDN)에 캐시되어 다른 사람에게 가지 않도록 하는 헤더
        for (const [headerName, headerValue] of Object.entries(headers)) {
          response.headers.set(headerName, headerValue);
        }
      },
    },
  });

  // 이 호출이 토큰을 확인하고, 만료가 가까우면 갱신해서 위 setAll로 쿠키를 다시 씁니다.
  await supabase.auth.getUser();

  return response;
}

// /admin으로 시작하는 주소에서만 실행 (일반 방문자 페이지에는 영향 없음)
export const config = {
  matcher: ["/admin/:path*"],
};
