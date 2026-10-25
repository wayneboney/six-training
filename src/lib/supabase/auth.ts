// 로그인한 사용자 권한으로 Supabase에 접속하는 도구.
// 로그인 정보(세션)는 브라우저 쿠키에 저장되고, 요청마다 그 쿠키를 읽어서 "누가 요청했는지" Supabase에 알려 줍니다.
// 그래서 DB의 RLS 규칙(관리자만 쓰기)이 이 사용자 기준으로 적용됩니다.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/lib/supabase/server";

export async function createAuthSupabase() {
  // 쿠키를 먼저 읽습니다. cookies()를 만나는 순간 Next.js는 "여기부터는 방문자가 요청했을 때 실행"으로 판단해서
  // 빌드할 때(미리 만들어 두는 단계)는 아래 코드를 실행하지 않습니다.
  const cookieStore = await cookies();
  const { url, key } = readSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      // 요청에 들어 있는 쿠키를 Supabase에 넘겨줍니다.
      getAll() {
        return cookieStore.getAll();
      },
      // 로그인/로그아웃/토큰 갱신 때 Supabase가 쿠키를 새로 쓰라고 요청하면 저장합니다.
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 화면을 그리는 중(Server Component)에는 쿠키를 쓸 수 없어서 에러가 납니다.
          // 이때는 proxy.ts가 다음 요청에서 쿠키를 갱신하므로 무시해도 됩니다.
          // (로그인/로그아웃 같은 Server Action에서는 정상적으로 저장됩니다)
        }
      },
    },
  });
}
