// 서버에서만 쓰는 Supabase 접속 도구.
// "server-only" = 이 파일을 실수로 브라우저용 코드에서 불러오면 빌드 에러를 내서 막아 줍니다.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 접속 정보는 코드에 직접 쓰지 않고 환경변수(.env.local)에서 읽습니다.
// (Spring의 application.properties에 DB 주소를 두는 것과 같은 역할)
// NEXT_PUBLIC_ 이 붙은 값은 브라우저에 노출돼도 되는 값입니다. 공개 키는 RLS 규칙이 허용한 것만 할 수 있어서 안전합니다.
function readEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    // 어떤 값이 빠졌는지 알려 주는 에러. 값 자체는 로그에 남기지 않습니다.
    throw new Error(
      "Supabase 접속 정보가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정해 주세요.",
    );
  }
  return { url, key };
}

export function createServerSupabase(): SupabaseClient {
  const { url, key } = readEnv();
  return createClient(url, key, {
    // 서버에서 데이터만 읽으므로 로그인 세션은 저장하지 않습니다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
