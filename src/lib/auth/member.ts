// 일반회원(및 관리자) 로그인 정보 확인. 관리자 전용 확인은 admin.ts를 씁니다.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type Member = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null; // 프로필 사진 주소 (없으면 null)
  role: string; // 공통코드 ROLE (member / admin)
  status: string; // 공통코드 STATUS (pending / active / inactive)
};

// 지금 로그인한 사람의 정보. 로그인하지 않았거나 프로필이 없으면 null
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createAuthSupabase();

  // getUser() = 쿠키의 토큰을 Supabase 서버에 보내서 진짜 유효한 로그인인지 확인 (쿠키 내용만 믿지 않음)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }

  // RLS 규칙상 본인 프로필 한 줄만 읽을 수 있습니다.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("name, avatar_url, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] 프로필 조회 실패", profileError);
    return null;
  }
  if (!profile) {
    return null;
  }
  return {
    userId: user.id,
    email: user.email ?? "",
    name: profile.name as string,
    avatarUrl: (profile.avatar_url as string | null) ?? null,
    role: profile.role as string,
    status: profile.status as string,
  };
}

// 헤더처럼 모든 페이지에 있는 곳에서 쓰는 가벼운 확인.
// 로그인 쿠키가 없으면 Supabase에 묻지 않고 바로 null, 문제가 생겨도 일반 화면은 깨지지 않게 합니다.
export async function getMemberIfSignedIn(): Promise<Member | null> {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => /^sb-.+-auth-token/.test(cookie.name));
  if (!hasAuthCookie) {
    return null;
  }
  try {
    return await getCurrentMember();
  } catch (error) {
    console.error("[auth] 회원 확인 실패 (일반 화면은 그대로 표시)", error);
    return null;
  }
}

// 로그인하지 않았으면 로그인 화면으로 보냅니다. 회원 전용 페이지 맨 앞에서 호출합니다.
export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) {
    redirect("/login");
  }
  return member;
}
