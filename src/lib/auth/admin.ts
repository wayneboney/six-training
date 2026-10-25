// 관리자 인증/권한 확인 (Spring Security의 SecurityContext + hasRole('ADMIN') 역할)
// 관리자 페이지와 Server Action은 모두 여기 함수로 권한을 확인합니다.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type Admin = {
  userId: string;
  email: string;
  name: string;
};

// 지금 로그인한 사람이 관리자면 정보를, 아니면 null을 돌려줍니다.
export async function getCurrentAdmin(): Promise<Admin | null> {
  const supabase = await createAuthSupabase();

  // getUser() = 쿠키의 토큰을 Supabase 서버에 보내서 "진짜 유효한 로그인인지" 확인합니다.
  // (쿠키 내용만 믿지 않고 서버에서 검증하는 방식이라 위조된 쿠키를 막을 수 있습니다)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }

  // admins 테이블에 등록된 계정인지 확인. RLS 규칙상 "본인 줄"만 읽을 수 있습니다.
  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle(); // 0줄이면 null, 1줄이면 그 줄 (Java의 Optional과 비슷)

  if (adminError) {
    console.error("[auth] 관리자 정보 조회 실패", adminError);
    return null;
  }
  if (!adminRow) {
    return null;
  }

  return { userId: user.id, email: user.email ?? "", name: adminRow.name as string };
}

// 일반 방문자 화면(헤더, WOD 달력)에서 "관리자에게만 버튼 보여주기"용으로 쓰는 가벼운 확인.
// - 로그인 쿠키가 아예 없으면 Supabase에 묻지 않고 바로 null (일반 방문자는 추가 비용 없음)
// - 확인 중 문제가 생겨도 일반 화면이 깨지지 않도록 null로 처리하고 로그만 남김
export async function getAdminIfSignedIn(): Promise<Admin | null> {
  const cookieStore = await cookies();
  // Supabase 로그인 쿠키 이름: sb-<프로젝트ID>-auth-token (길면 .0, .1로 나뉘어 저장됨)
  const hasAuthCookie = cookieStore.getAll().some((cookie) => /^sb-.+-auth-token/.test(cookie.name));
  if (!hasAuthCookie) {
    return null;
  }
  try {
    return await getCurrentAdmin();
  } catch (error) {
    console.error("[auth] 관리자 확인 실패 (일반 화면은 그대로 표시)", error);
    return null;
  }
}

// 관리자가 아니면 로그인 화면으로 보내고, 관리자면 정보를 돌려줍니다.
// 관리자 페이지 맨 앞에서 호출합니다. (Spring의 @PreAuthorize("hasRole('ADMIN')")와 같은 역할)
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}
