import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { memberLogout } from "@/app/auth/actions";
import { requireMember } from "@/lib/auth/member";
import { createAuthSupabase } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "내 정보",
  robots: { index: false, follow: false }, // 검색 결과에 나오지 않게
};

// /me  (로그인한 회원 전용)
export default function MePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-2xl font-black">내 정보</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <MyInfo />
        </Suspense>
      </div>
    </div>
  );
}

type MembershipRow = {
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  starts_in_days: number | null;
  hold_days_left: number | null;
  hold_count_left: number | null;
  holding_until: string | null;
};

async function MyInfo() {
  await connection(); // 로그인 정보는 요청할 때마다 다르므로 미리 만들어 둘 수 없음
  const member = await requireMember(); // 로그인 안 했으면 /login 으로 이동

  const supabase = await createAuthSupabase();

  // 상태 이름(승인대기/활동/비활동)은 공통코드에서 읽습니다. 이름을 바꿔도 코드 수정이 필요 없음
  const { data: codeRow } = await supabase
    .from("codes")
    .select("name")
    .eq("group_code", "STATUS")
    .eq("code", member.status)
    .maybeSingle();
  const statusName = (codeRow?.name as string | undefined) ?? member.status;

  // 내 회원권 요약 (뷰는 RLS가 적용되어 본인 것만 나옴)
  const { data: membership, error: membershipError } = await supabase
    .from("member_membership_status")
    .select("plan_name, start_date, end_date, days_left, starts_in_days, hold_days_left, hold_count_left, holding_until")
    .eq("user_id", member.userId)
    .maybeSingle()
    .overrideTypes<MembershipRow, { merge: false }>();
  if (membershipError) {
    console.error("[me] 회원권 조회 실패", membershipError);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line bg-surface p-5">
        <p className="text-lg font-bold">{member.name}님</p>
        <p className="mt-1 text-sm text-muted">{member.email}</p>
        <p className="mt-3 text-sm">
          상태: <span className="font-bold text-accent">{statusName}</span>
        </p>
        {member.status === "pending" && (
          <p className="mt-3 text-sm text-muted">
            코치가 가입을 확인하고 회원권을 등록하면 수업을 예약할 수 있습니다. 승인까지 잠시 기다려 주세요.
          </p>
        )}
        {member.status === "inactive" && (
          <p className="mt-3 text-sm text-muted">회원권이 종료되었습니다. 코치에게 재등록을 문의해 주세요.</p>
        )}
      </section>

      {membership?.plan_name && (
        <section className="rounded-md border border-line p-5">
          <h2 className="font-bold">내 회원권</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">종류</dt>
              <dd>{membership.plan_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">기간</dt>
              <dd>
                {membership.start_date} ~ {membership.end_date}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">남은 일수</dt>
              <dd className="font-bold">
                {membership.days_left !== null
                  ? `${membership.days_left}일`
                  : `${membership.starts_in_days}일 후 시작`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">남은 홀딩</dt>
              <dd>
                {membership.hold_days_left}일 / {membership.hold_count_left}회
              </dd>
            </div>
            {membership.holding_until && (
              <div className="flex justify-between">
                <dt className="text-muted">홀딩 중</dt>
                <dd>{membership.holding_until}까지</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          홈으로
        </Link>
        {/* 로그아웃은 데이터를 바꾸는 동작이므로 링크(GET)가 아니라 폼(POST)으로 보냅니다 */}
        <form action={memberLogout}>
          <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface">
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
