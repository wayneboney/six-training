import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { adjustDaysAction, cancelHoldAction, registerMembershipAction } from "@/app/admin/members/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { seoulTodayKey } from "@/lib/date";
import Avatar from "@/components/Avatar";
import Pagination from "@/components/Pagination";
import { sortMembersByName } from "@/lib/members/sort";
import { formatPhone } from "@/lib/profile/contact";
import { formatDateTimeToKey } from "@/lib/members/format";
import {
  getActiveCodes,
  getActivePlans,
  listMembers,
  MEMBER_LIST_LIMIT,
  type CodeOption,
  type MemberRow,
  type PlanOption,
} from "@/lib/members/repository";

export const metadata = { title: "회원 관리" };

// 남은 일수가 이 값 이하면 "만료 임박"으로 표시합니다.
const EXPIRING_DAYS = 7;
const EXPIRING_TAB = "expiring"; // 상태 코드와 겹치지 않는 특별한 탭 값
const PAGE_SIZE = 20; // 한 페이지에 보여줄 회원 수

// /admin/members = 관리자 첫 화면. 회원 목록
// 주소로 받는 값: ?status=pending (상태 코드 또는 expiring), ?q=홍길동 (검색어), ?page=2 (페이지)
export default function MembersPage(props: PageProps<"/admin/members">) {
  return (
    <div>
      <h1 className="text-2xl font-black">회원 관리</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <MemberList searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

// 이용 현황: 목록에서 한눈에 보이도록 회원권 상태를 하나의 분류로 정리합니다.
type Presence = "pending" | "active" | "expiring" | "upcoming" | "ended" | "none";

function presenceOf(m: MemberRow): Presence {
  if (m.status === "pending") return "pending";
  if (m.planName) {
    if (m.daysLeft === null) return "upcoming"; // 아직 시작 전
    return m.daysLeft <= EXPIRING_DAYS ? "expiring" : "active";
  }
  return m.lastEndDate ? "ended" : "none";
}

// 정렬: 관리자 계정이 맨 위, 그 아래로 일반 회원을 이름순 (한글 가나다순 → 영어 ABC순). src/lib/members/sort.ts

const smallInput = "rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

async function MemberList({ searchParams }: { searchParams: PageProps<"/admin/members">["searchParams"] }) {
  await connection();
  await requireAdmin();

  const query = await searchParams;
  const statusParam = typeof query.status === "string" ? query.status : "";
  const deleted = query.deleted === "1"; // 회원 삭제 후 이 화면으로 돌아왔을 때
  const q = (typeof query.q === "string" ? query.q : "").trim().slice(0, 50);
  const today = seoulTodayKey();

  // DB 조회만 try/catch로 감쌉니다. (화면 코드는 밖에서)
  let members: MemberRow[] | null = null;
  let truncated = false;
  let statuses: CodeOption[] = [];
  let plans: PlanOption[] = [];
  try {
    const result = await listMembers(today);
    members = result.members;
    truncated = result.truncated;
    statuses = await getActiveCodes("STATUS");
    plans = await getActivePlans();
  } catch (error) {
    console.error("[admin] 회원 목록 조회 실패", error);
  }

  if (members === null) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-bold">회원 목록을 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
      </div>
    );
  }

  const statusName = new Map(statuses.map((s) => [s.code, s.name]));
  // 주소에 이상한 값이 와도 무시하고 전체를 보여줍니다.
  const tab = statusName.has(statusParam) || statusParam === EXPIRING_TAB ? statusParam : "";

  const isExpiring = (m: MemberRow) => presenceOf(m) === "expiring";
  const matchesTab = (m: MemberRow) => (tab === "" ? true : tab === EXPIRING_TAB ? isExpiring(m) : m.status === tab);

  // 검색/필터는 서버에서 메모리로 처리합니다. (회원 수가 수백 명 수준이라 충분. 1000명을 넘기면 DB 검색으로 바꿔야 함)
  const needle = q.toLowerCase();
  const needleDigits = q.replace(/[^0-9]/g, ""); // 전화번호 검색: 하이픈 없이 숫자만 비교
  const visible = sortMembersByName(
    members.filter(
      (m) =>
        matchesTab(m) &&
        (needle === "" || m.name.toLowerCase().includes(needle) || (m.email ?? "").toLowerCase().includes(needle) ||
          (needleDigits.length >= 3 && (m.phone ?? "").includes(needleDigits))),
    ),
  );

  const tabs = [
    { code: "", name: "전체", count: members.length },
    ...statuses.map((s) => ({ code: s.code, name: s.name, count: members.filter((m) => m.status === s.code).length })),
    { code: EXPIRING_TAB, name: `만료 임박(${EXPIRING_DAYS}일 이내)`, count: members.filter(isExpiring).length },
  ];
  // 페이지: 주소의 ?page= 값. 잘못된 값이거나 범위를 벗어나면 가장 가까운 페이지로 맞춥니다.
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageParam = Number(typeof query.page === "string" ? query.page : "1");
  const page = Number.isInteger(pageParam) ? Math.min(Math.max(pageParam, 1), totalPages) : 1;
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (tab) params.set("status", tab);
    if (q) params.set("q", q);
    if (n > 1) params.set("page", String(n));
    const text = params.toString();
    return text ? `/admin/members?${text}` : "/admin/members";
  };

  const tabHref = (code: string) => {
    const params = new URLSearchParams();
    if (code) params.set("status", code);
    if (q) params.set("q", q);
    const text = params.toString();
    return text ? `/admin/members?${text}` : "/admin/members";
  };

  return (
    <div className="space-y-6">
      {deleted && (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm font-bold">
          🗑 회원을 삭제했습니다.
        </p>
      )}

      {/* 상태 탭: 링크로 만들어서 주소(?status=)만 바꿉니다 */}
      <nav aria-label="회원 상태" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.code || "all"}
            href={tabHref(t.code)}
            aria-current={tab === t.code ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
              tab === t.code ? "border-accent bg-accent text-white" : "border-line hover:bg-surface"
            }`}
          >
            {t.name} {t.count}
          </Link>
        ))}
      </nav>

      {/* 검색: GET 폼이라 제출하면 주소에 ?q=가 붙어서 이 화면이 다시 열립니다 */}
      <form action="/admin/members" className="flex gap-2">
        {tab && <input type="hidden" name="status" value={tab} />}
        <input
          name="q"
          type="search"
          defaultValue={q}
          maxLength={50}
          placeholder="이름, 이메일, 전화번호 검색"
          aria-label="이름, 이메일, 전화번호 검색"
          className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
        />
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-bold hover:bg-surface">
          검색
        </button>
      </form>

      {truncated && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          회원이 {MEMBER_LIST_LIMIT}명을 넘어 일부만 표시됩니다. 검색 기능 개선이 필요합니다.
        </p>
      )}

      {/* 총 인원은 목록 맨 위에. 지금 보고 있는 조건(탭, 검색) 기준입니다. */}
      <p className="text-sm font-bold">
        총 {visible.length}명
        {totalPages > 1 && <span className="ml-2 font-normal text-muted">{page} / {totalPages} 페이지</span>}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-center text-muted">조건에 맞는 회원이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {pageRows.map((m) => (
            <MemberItem key={m.userId} member={m} presence={presenceOf(m)} statusLabel={statusName.get(m.status) ?? m.status} plans={plans} today={today} />
          ))}
        </ul>
      )}

      {/* 페이지 번호는 회원이 20명 이하여도 보입니다 */}
      <Pagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </div>
  );
}

// 회원 한 줄: 이름/상태, 회원권 이용 현황, 관리 링크 + 빠른 처리(승인, 일수 추가)
function MemberItem({
  member: m,
  presence,
  statusLabel,
  plans,
  today,
}: {
  member: MemberRow;
  presence: Presence;
  statusLabel: string;
  plans: PlanOption[];
  today: string;
}) {
  const isMember = m.role === "member";
  return (
    <li className={`space-y-3 p-4 ${presence === "pending" ? "bg-accent-soft/40" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* 프로필 사진 (없으면 기본 실루엣) + 이름/연락처 */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar url={m.avatarUrl} name={m.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {m.name}
              {m.role === "admin" && (
                <span className="ml-2 rounded bg-foreground px-1.5 py-0.5 text-xs font-bold text-background">관리자</span>
              )}
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${
                  presence === "pending" ? "bg-accent text-white" : "border border-line text-muted"
                }`}
              >
                {statusLabel}
              </span>
            </p>
            <p className="truncate text-sm text-muted">
              {m.email ?? "이메일 없음"}
              {m.phone && <span className="ml-3">{formatPhone(m.phone)}</span>}
              <span className="ml-3">가입 {formatDateTimeToKey(m.createdAt)}</span>
            </p>
          </div>
          {/* 모바일: 프로필 줄 오른쪽 빈자리에 상세 버튼 */}
          <Link
            href={`/admin/members/${m.userId}`}
            className="shrink-0 rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface sm:hidden"
          >
            상세
          </Link>
        </div>

        {/* 회원권 이용 현황 */}
        <div className="shrink-0 text-sm sm:w-60 sm:text-right">
          <MembershipSummary member={m} presence={presence} />
        </div>

        {/* PC: 오른쪽 끝. (모바일은 위 프로필 줄 오른쪽에 같은 버튼이 있어서 여기서는 숨김) */}
        <Link
          href={`/admin/members/${m.userId}`}
          className="hidden w-fit shrink-0 rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface sm:block"
        >
          상세
        </Link>
      </div>

      {/* 홀딩 현황: 홀딩은 회원이 직접 등록하고, 관리자는 확인과 해제만 합니다 */}
      {m.hold && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface px-3 py-2">
          <span className="text-sm font-bold">
            {m.hold.start <= today ? "🧘 홀딩 중" : "🗓 홀딩 예정"}
            <span className="ml-2 font-normal">
              {m.hold.start} ~ {m.hold.end}
            </span>
          </span>
          <MemberActionForm
            action={cancelHoldAction.bind(null, m.userId, m.hold.id)}
            submitLabel="홀딩 해제"
            pendingLabel="해제 중…"
            confirmMessage={`${m.name}님의 홀딩을 해제할까요? 해제해도 사용한 홀딩 횟수는 돌아오지 않습니다.`}
            layout="inline"
          />
        </div>
      )}

      {/* 빠른 처리 */}
      {isMember && presence === "pending" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">가입 승인:</span>
          <MemberActionForm
            action={registerMembershipAction.bind(null, m.userId)}
            submitLabel="승인"
            pendingLabel="승인 중…"
            confirmMessage={`${m.name}님의 가입을 승인하고 회원권을 등록할까요? (오늘부터 시작)`}
            layout="inline"
          >
            <select name="days" required defaultValue="" aria-label="회원권 종류" className={smallInput}>
              <option value="" disabled>
                회원권 선택
              </option>
              {plans.map((plan) => (
                <option key={plan.days} value={plan.days}>
                  {plan.name}
                </option>
              ))}
            </select>
          </MemberActionForm>
        </div>
      )}
      {isMember && m.targetMembershipId !== null && presence !== "pending" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">일수 조정:</span>
          <MemberActionForm
            action={adjustDaysAction.bind(null, m.userId, m.targetMembershipId)}
            submitLabel="추가"
            pendingLabel="처리 중…"
            modes={[
              { value: "add", label: "추가" },
              { value: "remove", label: "차감", outline: true, confirmMessage: "서비스로 추가했던 일수를 차감할까요? 종료일이 줄어듭니다." },
            ]}
            layout="inline"
          >
            <input
              name="days"
              type="number"
              required
              min={1}
              max={1000}
              placeholder="일수"
              aria-label={`${m.name} 추가할 일수`}
              className={`${smallInput} w-24`}
            />
          </MemberActionForm>
        </div>
      )}
    </li>
  );
}

// 회원권 이용 현황. 남은 일수를 가장 크게 보여주고, 종류와 종료일은 아래에 작게 보여줍니다.
function MembershipSummary({ member: m, presence }: { member: MemberRow; presence: Presence }) {
  switch (presence) {
    case "pending":
      return <span className="text-lg font-black text-accent">승인 대기 중</span>;
    case "active":
    case "expiring":
      return (
        <>
          <span className={`block text-lg font-black ${presence === "expiring" ? "text-accent" : ""}`}>
            {m.daysLeft}일 남음{presence === "expiring" && " ⚠️"}
          </span>
          <span className="block text-muted">
            {m.planName} ~ {m.endDate}
            {presence === "expiring" && <span className="ml-2 font-bold text-accent">만료 임박</span>}
          </span>
        </>
      );
    case "upcoming":
      return (
        <>
          <span className="block text-lg font-black">{m.startsInDays}일 후 시작</span>
          <span className="block text-muted">
            {m.planName} ~ {m.endDate}
          </span>
        </>
      );
    case "ended":
      return (
        <>
          <span className="block text-lg font-black text-muted">회원권 만료</span>
          <span className="block text-muted">{m.lastEndDate} 종료</span>
        </>
      );
    case "none":
      // 관리자(코치) 계정은 회원권을 쓰지 않으므로 "없음" 대신 해당 없음으로 표시
      return <span className="text-muted">{m.role === "admin" ? "회원권 해당 없음" : "회원권 없음"}</span>;
  }
}
