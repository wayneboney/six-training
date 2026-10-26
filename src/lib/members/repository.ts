// 관리자 회원 관리용 DB 조회. 로그인한 관리자 권한으로 조회하므로 DB의 RLS 규칙(관리자만 전체 읽기)이 그대로 적용됩니다.
// 화면(페이지)에서 호출하기 전에 requireAdmin()으로 관리자인지 먼저 확인하세요.
import "server-only";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type MemberRow = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  // 현재(또는 다음) 회원권 요약. 없으면 planName이 null
  planName: string | null;
  endDate: string | null;
  daysLeft: number | null; // 이미 시작한 회원권의 남은 일수
  startsInDays: number | null; // 아직 시작 전이면 시작까지 남은 일수
  // 일수 추가 대상 회원권: 이용 중/예정이면 그 회원권, 모두 끝났으면 가장 마지막 회원권. 회원권이 한 번도 없으면 null
  targetMembershipId: number | null;
  lastEndDate: string | null; // 지금까지 등록된 회원권 중 가장 늦은 종료일 (만료된 회원 표시용)
  // 진행 중이거나 예정된 홀딩 (회원이 직접 등록한 것). 없으면 null
  hold: { id: number; start: string; end: string } | null;
};

export type CodeOption = { code: string; name: string };
export type PlanOption = { days: number; name: string; holdMaxDays: number; holdMaxCount: number };

export type HoldRow = {
  id: number;
  holdStart: string;
  holdEnd: string;
  days: number;
  cancelledAt: string | null;
  note: string | null;
};

export type MembershipRow = {
  id: number;
  planName: string;
  startDate: string;
  endDate: string;
  bonusDays: number;
  holdMaxDays: number;
  holdMaxCount: number;
  note: string | null;
  holds: HoldRow[];
};

export type MemberDetail = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  memberships: MembershipRow[]; // 최근 시작일 순
};

// 목록에 한 번에 가져올 최대 인원 (이 이상이 되면 검색/페이지 기능을 추가해야 합니다)
export const MEMBER_LIST_LIMIT = 1000;

export async function listMembers(today: string): Promise<{ members: MemberRow[]; truncated: boolean }> {
  const supabase = await createAuthSupabase();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, name, email, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(MEMBER_LIST_LIMIT)
    .overrideTypes<
      { user_id: string; name: string; email: string | null; role: string; status: string; created_at: string }[],
      { merge: false }
    >();
  if (error) {
    throw error;
  }

  const { data: summaries, error: summaryError } = await supabase
    .from("member_membership_status")
    .select("user_id, plan_name, end_date, days_left, starts_in_days")
    .limit(MEMBER_LIST_LIMIT)
    .overrideTypes<
      {
        user_id: string;
        plan_name: string | null;
        end_date: string | null;
        days_left: number | null;
        starts_in_days: number | null;
      }[],
      { merge: false }
    >();
  if (summaryError) {
    throw summaryError;
  }

  // 회원권 전체(회원별 마지막 종료일, 일수 추가 대상 찾기용). 회원 수 × 회원권 수가 작아서 한 번에 가져옵니다.
  const { data: allMemberships, error: allError } = await supabase
    .from("memberships")
    .select("id, user_id, start_date, end_date")
    .order("start_date", { ascending: true })
    .limit(MEMBER_LIST_LIMIT * 10)
    .overrideTypes<{ id: number; user_id: string; start_date: string; end_date: string }[], { merge: false }>();
  if (allError) {
    throw allError;
  }
  // 회원별 대상 회원권: 아직 안 끝난 것 중 가장 먼저 시작하는 것, 없으면 가장 늦게 끝난 것
  const targetByUser = new Map<string, { id: number; endDate: string; ended: boolean }>();
  const lastEndByUser = new Map<string, string>();
  for (const ms of allMemberships) {
    const prevLast = lastEndByUser.get(ms.user_id);
    if (!prevLast || ms.end_date > prevLast) {
      lastEndByUser.set(ms.user_id, ms.end_date);
    }
    const ended = ms.end_date < today;
    const current = targetByUser.get(ms.user_id);
    if (!current) {
      targetByUser.set(ms.user_id, { id: ms.id, endDate: ms.end_date, ended });
    } else if (current.ended && !ended) {
      targetByUser.set(ms.user_id, { id: ms.id, endDate: ms.end_date, ended }); // 안 끝난 회원권이 우선
    } else if (current.ended && ended && ms.end_date > current.endDate) {
      targetByUser.set(ms.user_id, { id: ms.id, endDate: ms.end_date, ended }); // 둘 다 끝났으면 더 늦은 것
    }
    // 안 끝난 회원권이 여러 개면 먼저 시작하는 것(이미 등록된 것)을 유지
  }

  // 해제되지 않았고 아직 끝나지 않은 홀딩(진행 중 + 예정). 회원별로 가장 빠른 것 하나만 목록에 보여줍니다.
  const { data: activeHolds, error: holdError } = await supabase
    .from("membership_holds")
    .select("id, membership_id, hold_start, hold_end")
    .is("cancelled_at", null)
    .gte("hold_end", today)
    .order("hold_start", { ascending: true })
    .limit(MEMBER_LIST_LIMIT * 2)
    .overrideTypes<{ id: number; membership_id: number; hold_start: string; hold_end: string }[], { merge: false }>();
  if (holdError) {
    throw holdError;
  }
  const userByMembership = new Map(allMemberships.map((ms) => [ms.id, ms.user_id]));
  const holdByUser = new Map<string, { id: number; start: string; end: string }>();
  for (const h of activeHolds) {
    const userId = userByMembership.get(h.membership_id);
    if (userId && !holdByUser.has(userId)) {
      holdByUser.set(userId, { id: h.id, start: h.hold_start, end: h.hold_end });
    }
  }

  const summaryByUser = new Map(summaries.map((row) => [row.user_id, row]));
  const members = profiles.map((p): MemberRow => {
    const s = summaryByUser.get(p.user_id);
    return {
      userId: p.user_id,
      name: p.name,
      email: p.email,
      role: p.role,
      status: p.status,
      createdAt: p.created_at,
      planName: s?.plan_name ?? null,
      endDate: s?.end_date ?? null,
      daysLeft: s?.days_left ?? null,
      startsInDays: s?.starts_in_days ?? null,
      targetMembershipId: targetByUser.get(p.user_id)?.id ?? null,
      lastEndDate: lastEndByUser.get(p.user_id) ?? null,
      hold: holdByUser.get(p.user_id) ?? null,
    };
  });
  return { members, truncated: profiles.length >= MEMBER_LIST_LIMIT };
}

// 한 회원의 정보 + 회원권/홀딩 이력. 없는 회원이면 null
export async function getMemberDetail(userId: string): Promise<MemberDetail | null> {
  const supabase = await createAuthSupabase();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, name, email, role, status, created_at")
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<
      { user_id: string; name: string; email: string | null; role: string; status: string; created_at: string },
      { merge: false }
    >();
  if (error) {
    throw error;
  }
  if (!profile) {
    return null;
  }

  // 회원권 + (연결된) 요금제 이름 + 홀딩 목록을 한 번에 조회
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, start_date, end_date, bonus_days, hold_max_days, hold_max_count, note, membership_plans(name), membership_holds(id, hold_start, hold_end, days, cancelled_at, note)",
    )
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .order("hold_start", { ascending: true, referencedTable: "membership_holds" })
    .overrideTypes<
      {
        id: number;
        start_date: string;
        end_date: string;
        bonus_days: number;
        hold_max_days: number;
        hold_max_count: number;
        note: string | null;
        membership_plans: { name: string } | null;
        membership_holds: {
          id: number;
          hold_start: string;
          hold_end: string;
          days: number;
          cancelled_at: string | null;
          note: string | null;
        }[];
      }[],
      { merge: false }
    >();
  if (membershipError) {
    throw membershipError;
  }

  return {
    userId: profile.user_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    createdAt: profile.created_at,
    memberships: memberships.map(
      (m): MembershipRow => ({
        id: m.id,
        planName: m.membership_plans?.name ?? "-",
        startDate: m.start_date,
        endDate: m.end_date,
        bonusDays: m.bonus_days,
        holdMaxDays: m.hold_max_days,
        holdMaxCount: m.hold_max_count,
        note: m.note,
        holds: m.membership_holds.map((h) => ({
          id: h.id,
          holdStart: h.hold_start,
          holdEnd: h.hold_end,
          days: h.days,
          cancelledAt: h.cancelled_at,
          note: h.note,
        })),
      }),
    ),
  };
}

// 공통코드(콤보박스 목록). 사용 중(is_active)인 것만, 정렬 순서대로
export async function getActiveCodes(group: "ROLE" | "STATUS"): Promise<CodeOption[]> {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase
    .from("codes")
    .select("code, name")
    .eq("group_code", group)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .overrideTypes<CodeOption[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
}

// 새로 등록할 수 있는 회원권 종류 (30일 / 90일 / 180일)
export async function getActivePlans(): Promise<PlanOption[]> {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase
    .from("membership_plans")
    .select("days, name, hold_max_days, hold_max_count")
    .eq("is_active", true)
    .order("days", { ascending: true })
    .overrideTypes<{ days: number; name: string; hold_max_days: number; hold_max_count: number }[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data.map((p) => ({
    days: p.days,
    name: p.name,
    holdMaxDays: p.hold_max_days,
    holdMaxCount: p.hold_max_count,
  }));
}
