// 일반회원(및 관리자) 로그인 정보 확인. 관리자 전용 확인은 admin.ts를 씁니다.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type Member = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null; // 프로필 사진 주소 (없으면 null)
  phone: string | null; // 숫자만 (예: 01012345678). 예전 가입자는 null
  birthDate: string | null; // YYYY-MM-DD
  gender: string | null; // 공통코드 GENDER (M / F)
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
    .select("name, avatar_url, phone, birth_date, gender, role, status")
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
    phone: (profile.phone as string | null) ?? null,
    birthDate: (profile.birth_date as string | null) ?? null,
    gender: (profile.gender as string | null) ?? null,
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

// WOD와 수업 예약을 볼 수 있는지: 관리자, 또는 상태가 '활동'이고 유효한 회원권이 있는 회원. (승인 대기, 회원권 종료 회원은 볼 수 없음)
// 판단은 DB 함수 can_view_member_content()가 합니다. DB 규칙(RLS)도 같은 함수를 써서, 화면을 거치지 않아도 막힙니다.
// cache() = 같은 요청 안에서 같은 값으로 여러 번 불러도 DB에는 한 번만 묻습니다. (헤더, 페이지가 각각 확인해도 부담 없음)
// 확인에 실패하면 안전하게 "볼 수 없음"으로 처리합니다.
export const hasContentAccess = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("can_view_member_content");
  if (error) {
    console.error("[auth] 열람 권한 확인 실패", userId, error);
    return false;
  }
  return data === true;
});

// WOD/수업 예약 같은 회원 전용 화면 맨 앞에서 호출합니다.
//   로그인 안 함 → 로그인 화면 / 로그인했지만 회원권이 유효하지 않음 → 내 정보(안내가 있는 화면)
export async function requireContentAccess(): Promise<Member> {
  const member = await requireMember();
  if (!(await hasContentAccess(member.userId))) {
    redirect("/me");
  }
  return member;
}
