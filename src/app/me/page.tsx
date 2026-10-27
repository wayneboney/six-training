import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { memberLogout } from "@/app/auth/actions";
import { addMyHoldAction, cancelMyHoldAction } from "@/app/me/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import ProfileForm from "@/components/auth/ProfileForm";
import { requireMember } from "@/lib/auth/member";
import { addDaysToKey, diffDays, seoulTodayKey } from "@/lib/date";
import { formatHoldRange } from "@/lib/members/format";
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

type HoldItem = { id: number; hold_start: string; hold_end: string; days: number; cancelled_at: string | null };

type MembershipRow = {
  membership_id: number | null;
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
    .select(
      "membership_id, plan_name, start_date, end_date, days_left, starts_in_days, hold_days_left, hold_count_left, holding_until",
    )
    .eq("user_id", member.userId)
    .maybeSingle()
    .overrideTypes<MembershipRow, { merge: false }>();
  if (membershipError) {
    console.error("[me] 회원권 조회 실패", membershipError);
  }

  // 이 회원권의 홀딩 기록 (본인 것만 RLS로 조회됨)
  let holds: HoldItem[] = [];
  if (membership?.membership_id) {
    const { data: holdRows, error: holdError } = await supabase
      .from("membership_holds")
      .select("id, hold_start, hold_end, days, cancelled_at")
      .eq("membership_id", membership.membership_id)
      .order("hold_start", { ascending: true })
      .overrideTypes<HoldItem[], { merge: false }>();
    if (holdError) {
      console.error("[me] 홀딩 조회 실패", holdError);
    } else {
      holds = holdRows;
    }
  }
  const today = seoulTodayKey();
  const tomorrow = addDaysToKey(today, 1);
  // 신청 가능 여부: 이용 중인 일반회원이고 남은 홀딩 일수와 횟수가 있어야 함 (최종 판단은 DB)
  const canHold =
    member.role === "member" &&
    member.status === "active" &&
    !!membership?.plan_name &&
    (membership.hold_days_left ?? 0) > 0 &&
    (membership.hold_count_left ?? 0) > 0;

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

      {membership?.plan_name && member.status === "active" && (
        <section className="rounded-md border border-line p-5">
          <h2 className="font-bold">홀딩 (일시정지)</h2>
          <p className="mt-1 text-sm text-muted">
            홀딩한 일수만큼 종료일이 늘어납니다. 내일부터 시작하는 날짜만 신청할 수 있습니다.
            홀딩 중에 해제하면 쉰 일수만큼만 늘어나고, 해제하지 않아도 기간이 끝나면 저절로 풀립니다.
            단, 해제해도 사용한 홀딩 횟수는 돌아오지 않습니다.
          </p>

          {holds.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line text-sm">
              {holds.map((h) => {
                const cancelled = h.cancelled_at !== null;
                const canCancel = !cancelled && h.hold_end >= today;
                const started = h.hold_start <= today;
                // 해제하면 오늘 전날까지 쉰 일수만 남습니다. (확인창 안내용 계산)
                const usedDays = started ? diffDays(h.hold_start, today) : 0;
                return (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className={cancelled ? "text-muted line-through" : ""}>
                      {formatHoldRange(h.hold_start, h.hold_end, h.days)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {cancelled ? "해제됨" : h.hold_end < today ? "종료" : started ? "홀딩 중" : "예정"}
                      </span>
                      {canCancel && (
                        <MemberActionForm
                          action={cancelMyHoldAction.bind(null, h.id)}
                          submitLabel="해제"
                          pendingLabel="해제 중…"
                          confirmMessage={
                            started
                              ? `오늘부터 홀딩을 해제할까요? 어제까지 쉰 ${usedDays}일만 사용한 것으로 처리되고, 종료일은 ${usedDays}일만 늘어난 상태가 됩니다. 사용한 홀딩 횟수는 돌아오지 않습니다.`
                              : "아직 시작하지 않은 홀딩을 해제할까요? 늘어났던 종료일이 원래대로 돌아오지만, 사용한 홀딩 횟수는 돌아오지 않습니다."
                          }
                          layout="inline"
                        />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {canHold ? (
            <div className="mt-4">
              <MemberActionForm
                action={addMyHoldAction}
                submitLabel="홀딩 신청"
                pendingLabel="신청 중…"
                confirmMessage="홀딩을 신청할까요? 해제하더라도 사용한 홀딩 횟수는 돌아오지 않습니다."
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="holdStart" className="mb-1 block text-sm font-bold">
                      시작일
                    </label>
                    <input
                      id="holdStart"
                      name="holdStart"
                      type="date"
                      required
                      min={tomorrow}
                      className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="holdEnd" className="mb-1 block text-sm font-bold">
                      종료일
                    </label>
                    <input
                      id="holdEnd"
                      name="holdEnd"
                      type="date"
                      required
                      min={tomorrow}
                      className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </MemberActionForm>
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm text-muted">
              사용할 수 있는 홀딩이 남아 있지 않습니다.
            </p>
          )}
        </section>
      )}

      {/* 내 정보 수정: 이름, 프로필 사진 */}
      <section className="rounded-md border border-line p-5">
        <h2 className="font-bold">내 정보 수정</h2>
        <div className="mt-4">
          <ProfileForm name={member.name} avatarUrl={member.avatarUrl} />
        </div>
      </section>

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
