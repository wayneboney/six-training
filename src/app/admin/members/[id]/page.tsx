import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  adjustDaysAction,
  addHoldAction,
  cancelHoldAction,
  registerMembershipAction,
  updateMemberAction,
} from "@/app/admin/members/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { seoulTodayKey } from "@/lib/date";
import { formatDateTimeToKey } from "@/lib/members/format";
import {
  getActiveCodes,
  getActivePlans,
  getMemberDetail,
  type CodeOption,
  type MemberDetail,
  type MembershipRow,
  type PlanOption,
} from "@/lib/members/repository";
import { NOTE_MAX, parseUuid } from "@/lib/members/validation";

export const metadata = { title: "회원 상세" };

const inputClass = "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none";
const labelClass = "mb-1 block text-sm font-bold";

// /admin/members/<회원 id> = 회원 한 명의 상세, 승인, 회원권/홀딩 관리
export default function MemberDetailPage(props: PageProps<"/admin/members/[id]">) {
  return (
    <div>
      <Link href="/admin/members" className="text-sm text-muted hover:text-foreground">
        ‹ 회원 목록
      </Link>
      <div className="mt-4">
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <MemberDetailView params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function MemberDetailView({ params }: { params: PageProps<"/admin/members/[id]">["params"] }) {
  await connection();
  await requireAdmin();

  const { id } = await params;
  const userId = parseUuid(id);
  if (!userId) {
    notFound();
  }

  let member: MemberDetail | null = null;
  let roles: CodeOption[] = [];
  let statuses: CodeOption[] = [];
  let plans: PlanOption[] = [];
  let failed = false;
  try {
    member = await getMemberDetail(userId);
    roles = await getActiveCodes("ROLE");
    statuses = await getActiveCodes("STATUS");
    plans = await getActivePlans();
  } catch (error) {
    console.error("[admin] 회원 상세 조회 실패", error);
    failed = true;
  }

  if (failed) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-bold">회원 정보를 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
      </div>
    );
  }
  if (!member) {
    notFound();
  }

  const today = seoulTodayKey();
  // 이미 이용 중이거나 예정된 회원권이 있으면 새 회원권은 그 뒤에 이어서 시작합니다. (시작일 칸을 안내로 바꿈)
  const hasCurrentMembership = member.memberships.some((m) => m.endDate >= today);

  // 콤보박스에 현재 값이 없으면(예: 코드가 '사용 안 함'으로 바뀐 경우) 현재 값도 목록에 넣어서 값이 사라지지 않게 합니다.
  const withCurrent = (options: CodeOption[], current: string) =>
    options.some((o) => o.code === current) ? options : [...options, { code: current, name: `${current} (사용 중지됨)` }];
  const roleOptions = withCurrent(roles, member.role);
  const statusOptions = withCurrent(statuses, member.status);
  const statusLabel = statusOptions.find((s) => s.code === member.status)?.name ?? member.status;

  return (
    <div className="space-y-8">
      {/* 기본 정보 */}
      <section>
        <h1 className="text-2xl font-black">
          {member.name}
          <span className="ml-3 rounded border border-line px-2 py-0.5 align-middle text-sm font-bold text-muted">
            {statusLabel}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {member.email ?? "이메일 없음"} · 가입 {formatDateTimeToKey(member.createdAt)}
        </p>
      </section>

      {/* 승인 = 회원권 등록 */}
      <section className="rounded-lg border border-line p-5">
        <h2 className="font-bold">{member.status === "pending" ? "가입 승인 (회원권 등록)" : "회원권 등록"}</h2>
        <p className="mt-1 text-sm text-muted">
          회원권을 등록하면 상태가 &apos;활동&apos;으로 바뀝니다.
          {hasCurrentMembership && " 이미 이용 중인 회원권이 있어서, 끝나는 날 다음 날부터 이어서 시작합니다."}
        </p>
        <div className="mt-4 max-w-md">
          <MemberActionForm
            action={registerMembershipAction.bind(null, member.userId)}
            submitLabel="회원권 등록"
            pendingLabel="등록 중…"
          >
            <div>
              <label htmlFor="days" className={labelClass}>
                회원권 종류
              </label>
              <select id="days" name="days" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  선택해 주세요
                </option>
                {plans.map((plan) => (
                  <option key={plan.days} value={plan.days}>
                    {plan.name} (홀딩 {plan.holdMaxDays}일 / {plan.holdMaxCount}회)
                  </option>
                ))}
              </select>
            </div>
            {!hasCurrentMembership && (
              <div>
                <label htmlFor="startDate" className={labelClass}>
                  시작일
                </label>
                <input id="startDate" name="startDate" type="date" required defaultValue={today} className={inputClass} />
              </div>
            )}
            <div>
              <label htmlFor="reg-note" className={labelClass}>
                메모 <span className="font-normal text-muted">(선택)</span>
              </label>
              <input id="reg-note" name="note" type="text" maxLength={NOTE_MAX} className={inputClass} />
            </div>
          </MemberActionForm>
        </div>
      </section>

      {/* 회원권 목록 */}
      <section>
        <h2 className="font-bold">회원권 이력</h2>
        {member.memberships.length === 0 ? (
          <p className="mt-3 rounded-lg bg-surface p-6 text-center text-sm text-muted">등록된 회원권이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {member.memberships.map((m) => (
              <MembershipCard key={m.id} membership={m} userId={member.userId} today={today} />
            ))}
          </ul>
        )}
      </section>

      {/* 역할/상태 직접 수정 */}
      <section className="rounded-lg border border-line p-5">
        <h2 className="font-bold">역할 / 상태 수정</h2>
        <p className="mt-1 text-sm text-muted">
          일반회원을 &apos;활동&apos;으로 바꾸려면 유효한 회원권이 먼저 있어야 합니다. 회원권이 끝나면 매일 새벽에 자동으로
          &apos;비활동&apos;으로 바뀝니다.
        </p>
        <div className="mt-4 max-w-md">
          <MemberActionForm
            action={updateMemberAction.bind(null, member.userId)}
            submitLabel="저장"
            pendingLabel="저장 중…"
          >
            <div>
              <label htmlFor="role" className={labelClass}>
                역할
              </label>
              <select id="role" name="role" defaultValue={member.role} className={inputClass}>
                {roleOptions.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className={labelClass}>
                상태
              </label>
              <select id="status" name="status" defaultValue={member.status} className={inputClass}>
                {statusOptions.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </MemberActionForm>
        </div>
      </section>
    </div>
  );
}

// 회원권 한 건: 기간, 홀딩 사용 현황, 홀딩 목록(취소), 홀딩 추가, 일수 추가
function MembershipCard({ membership: m, userId, today }: { membership: MembershipRow; userId: string; today: string }) {
  const ended = m.endDate < today;
  const upcoming = m.startDate > today;
  const usedCount = m.holds.length; // 취소한 홀딩도 횟수에는 포함
  const usedDays = m.holds.reduce((sum, h) => sum + h.days, 0);
  const stateLabel = ended ? "종료" : upcoming ? "시작 예정" : "이용 중";

  return (
    <li className={`rounded-lg border border-line p-5 ${ended ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">
          {m.planName}
          <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs text-muted">{stateLabel}</span>
        </p>
        <p className="text-sm">
          {m.startDate} ~ <span className="font-bold">{m.endDate}</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        홀딩 사용 {usedDays}/{m.holdMaxDays}일 · {usedCount}/{m.holdMaxCount}회
        {m.bonusDays > 0 && ` · 서비스 +${m.bonusDays}일`}
        {m.note && ` · 메모: ${m.note}`}
      </p>

      {m.holds.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line text-sm">
          {m.holds.map((h) => {
            const cancelled = h.cancelledAt !== null;
            const canCancel = !cancelled && h.holdEnd >= today;
            const holdState = cancelled
              ? "취소됨"
              : h.holdEnd < today
                ? "종료"
                : h.holdStart <= today
                  ? "진행 중"
                  : "예정";
            return (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className={cancelled ? "text-muted line-through" : ""}>
                  홀딩 {h.holdStart} ~ {h.holdEnd} ({h.days}일)
                  {h.note && <span className="text-muted"> · {h.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{holdState}</span>
                  {canCancel && (
                    <MemberActionForm
                      action={cancelHoldAction.bind(null, userId, h.id)}
                      submitLabel="홀딩 취소"
                      pendingLabel="취소 중…"
                      confirmMessage="홀딩을 취소할까요? 취소해도 사용한 홀딩 횟수는 돌아오지 않습니다."
                      layout="inline"
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          {!ended && (
          <div>
            <h3 className="mb-2 text-sm font-bold">홀딩 추가</h3>
            <MemberActionForm
              action={addHoldAction.bind(null, userId, m.id)}
              submitLabel="홀딩 등록"
              pendingLabel="등록 중…"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`hs-${m.id}`} className="mb-1 block text-xs font-bold">
                    시작일
                  </label>
                  <input id={`hs-${m.id}`} name="holdStart" type="date" required min={today} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`he-${m.id}`} className="mb-1 block text-xs font-bold">
                    종료일
                  </label>
                  <input id={`he-${m.id}`} name="holdEnd" type="date" required min={today} className={inputClass} />
                </div>
              </div>
              <input name="note" type="text" maxLength={NOTE_MAX} placeholder="메모 (선택)" aria-label="홀딩 메모" className={inputClass} />
            </MemberActionForm>
          </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold">
              서비스 일수 조정{ended && <span className="ml-1 font-normal text-muted">(추가하면 다시 이용 가능해질 수 있음)</span>}
            </h3>
            <MemberActionForm
              action={adjustDaysAction.bind(null, userId, m.id)}
              submitLabel="일수 추가"
              pendingLabel="처리 중…"
              modes={[
                { value: "add", label: "추가" },
              { value: "remove", label: "차감", outline: true, confirmMessage: "서비스로 추가했던 일수를 차감할까요? 종료일이 줄어듭니다." },
            ]}
            >
              <input
                name="days"
                type="number"
                required
                min={1}
                max={1000}
                placeholder="일수"
                aria-label="조정할 일수"
                className={inputClass}
              />
              <input name="note" type="text" maxLength={NOTE_MAX} placeholder="메모 (선택)" aria-label="일수 조정 메모" className={inputClass} />
            </MemberActionForm>
          </div>
        </div>
    </li>
  );
}
