// proxy = 요청이 페이지에 도착하기 전에 먼저 실행되는 코드 (Next.js 15까지는 middleware라고 불렀습니다)
// Java의 Servlet Filter와 비슷한 역할입니다.
//
// 여기서는 로그인한 사람의 요청마다(모든 페이지) 로그인 쿠키(토큰)가 만료되기 전에 갱신합니다. 이 갱신이 있어야 한 번 로그인하면 계속 로그인이 유지됩니다.
//   (토큰은 1시간마다 새로 받아야 하는데, 화면을 그리는 코드(Server Component)는 쿠키를 저장할 수 없어서 여기서만 저장할 수 있습니다.
//    홈 같은 일반 페이지에서 갱신이 빠지면, 새 토큰이 저장되지 않아 이후 요청에서 로그인이 풀릴 수 있습니다.)
// 로그인 쿠키가 없는 방문자는 Supabase를 부르지 않고 바로 통과시킵니다. (일반 방문자에게는 부담 없음)
// 로그인 여부만 보고 Program, 수업 예약 주소를 로그인 화면으로 보냅니다. (로그인 확인만 하고, 관리자 같은 권한 검사는 하지 않음)
// ⚠️ 권한 검사는 여기서 하지 않습니다. 실제 검사는 각 페이지와 Server Action의 requireAdmin()에서 합니다.
//    (Next.js 문서 권장: proxy는 빠른 사전 처리용이고, 인증/권한의 최종 판단 장소가 아님)
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 로그인해야 볼 수 있는 주소
const MEMBER_ONLY_PATHS = ["/program", "/reserve"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // 접속 정보가 없으면 갱신할 수 없으므로 그냥 통과시킵니다. (페이지에서 에러로 안내)
    return response;
  }

  // 로그인 쿠키가 없으면 갱신할 것이 없습니다. 로그인이 필요한 주소만 로그인 화면으로 보냅니다.
  const hasAuthCookie = request.cookies.getAll().some((cookie) => /^sb-.+-auth-token/.test(cookie.name));
  const isMemberOnly = MEMBER_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!hasAuthCookie) {
    return isMemberOnly ? NextResponse.redirect(new URL("/login", request.url)) : response;
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

  // 이 호출이 토큰을 확인하고, 만료됐으면 새 토큰으로 갱신해서 위 setAll로 쿠키를 다시 씁니다.
  // getClaims = 토큰의 서명을 이 서버에서 직접 검사합니다. (getUser는 매번 Supabase 서버에 물어봐서 모든 페이지에 쓰기엔 느림)
  //   페이지와 Server Action은 중요한 판단에 getUser()를 따로 씁니다. 여기서는 "로그인했는가"만 봅니다.
  const { data } = await supabase.auth.getClaims();
  const signedIn = data?.claims != null;

  // 회원권이 유효한 회원(과 관리자)만 볼 수 있는 화면(Program, 수업 예약)을 서버가 화면을 만들기 전에 막는 1차 관문입니다.
  //   로그인 안 함 → 로그인 화면 / 로그인했지만 회원권이 유효하지 않음 → 내 정보 화면
  // 각 페이지(requireContentAccess)와 DB 규칙도 같은 조건으로 한 번씩 더 확인합니다.
  if (isMemberOnly) {
    if (!signedIn) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: allowed, error } = await supabase.rpc("can_view_member_content");
    if (error || allowed !== true) {
      return NextResponse.redirect(new URL("/me", request.url));
    }
  }

  return response;
}

// 모든 페이지에서 실행. 단, 파일(이미지, 아이콘, 빌드 결과물)은 제외합니다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
