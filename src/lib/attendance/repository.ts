// 출석 일수 조회. 출석은 "출석한 날" 기준(하루에 수업을 여러 번 들어도 1일)이고, 수업/예약 기록을 지워도 줄어들지 않습니다. (DB의 attendances 표)
// 출석 조회가 실패해도 화면 전체가 막히면 안 되므로, 실패하면 값 없이(null 또는 빈 목록) 돌려주고 로그만 남깁니다.
import "server-only";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type AttendanceCount = { thisMonth: number; lastMonth: number; total: number };

// 로그인한 회원 본인의 출석 일수
export async function getMyAttendance(): Promise<AttendanceCount | null> {
  try {
    const supabase = await createAuthSupabase();
    const { data, error } = await supabase.rpc("get_my_attendance");
    if (error) {
      console.error("[me] 출석 조회 실패", error);
      return null;
    }
    const row = ((data ?? []) as { this_month: number; last_month: number; total: number }[])[0];
    return row ? { thisMonth: row.this_month, lastMonth: row.last_month, total: row.total } : { thisMonth: 0, lastMonth: 0, total: 0 };
  } catch (error) {
    console.error("[me] 출석 조회 실패", error);
    return null;
  }
}

// 관리자: 모든 회원의 출석 일수 (회원 번호 → 일수). 출석이 한 번도 없는 회원은 목록에 없음
export async function getAttendanceSummary(): Promise<Map<string, AttendanceCount>> {
  try {
    const supabase = await createAuthSupabase();
    const { data, error } = await supabase.rpc("admin_attendance_summary");
    if (error) {
      console.error("[admin] 출석 요약 조회 실패", error);
      return new Map();
    }
    const rows = (data ?? []) as { user_id: string; this_month: number; last_month: number; total: number }[];
    return new Map(rows.map((row) => [row.user_id, { thisMonth: row.this_month, lastMonth: row.last_month, total: row.total }]));
  } catch (error) {
    console.error("[admin] 출석 요약 조회 실패", error);
    return new Map();
  }
}

// 관리자: 회원 한 명이 출석한 날짜 목록 (최근순, "YYYY-MM-DD"). 조회 실패 시 빈 목록
export async function getMemberAttendanceDates(userId: string, limit = 120): Promise<string[]> {
  try {
    const supabase = await createAuthSupabase();
    const { data, error } = await supabase.rpc("admin_member_attendance_dates", { p_user_id: userId, p_limit: limit });
    if (error) {
      console.error("[admin] 회원 출석 날짜 조회 실패", error);
      return [];
    }
    return ((data ?? []) as { attend_date: string }[]).map((row) => row.attend_date);
  } catch (error) {
    console.error("[admin] 회원 출석 날짜 조회 실패", error);
    return [];
  }
}
