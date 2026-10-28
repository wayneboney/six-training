// 로그인 직후 이동할 화면을 정합니다. 관리자는 관리자 첫 화면(회원 목록, /admin/members. /admin으로 보내면 주소가 바뀌지 않아 메뉴 선택 표시가 안 됨), 일반회원은 홈입니다.
// 관리자 로그인 화면(/admin/login)과 일반 로그인 화면(/login) 어디서 로그인하든 같은 규칙을 씁니다.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// 프로필을 읽지 못하면 null (호출한 쪽에서 로그인 실패로 처리)
export async function landingPathAfterLogin(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[auth] 로그인 후 역할 확인 실패", error);
    return null;
  }
  if (!data) {
    return null;
  }
  return data.role === "admin" ? "/admin/members" : "/";
}
