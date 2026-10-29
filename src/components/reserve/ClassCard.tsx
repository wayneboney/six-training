// 수업 한 칸(날짜별)의 카드: 시간, 종류, 정원 현황, 예약/취소 버튼. 관리자에게는 정원 선택과 예약자 목록도 보여줍니다.
// 서버에서 그려지는 컴포넌트이고, 버튼 폼(MemberActionForm)만 브라우저에서 실행됩니다.
import {
  adminAddGuestAction,
  adminCancelReservationAction,
  cancelReservationAction,
  markAttendanceAction,
  reserveAction,
  setCapacityAction,
} from "@/app/reserve/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import Avatar from "@/components/Avatar";
import TimeGate from "@/components/reserve/TimeGate";
import { medalOf } from "@/lib/mvp";
import { classLabelsKo } from "@/data/timetable";
import { GUEST_NAME_MAX } from "@/lib/members/validation";
import type { CodeOption } from "@/lib/members/repository";
import type { Attendee, ClassSession } from "@/lib/reservations/repository";

type ClassCardProps = {
  session: ClassSession;
  started: boolean; // 수업이 이미 시작했는지 (시작했으면 예약/취소 불가)
  startAt: number; // 수업 시작 시각(밀리초). 이 시각이 되면 출석 버튼이 저절로 나타남
  isAdmin: boolean;
  readOnly?: boolean; // 지난 날짜: 예약/취소/정원 변경 버튼 없이 예약자 목록만 볼 수 있음 (목록은 다른 날짜처럼 접어 둠. 출석 표시만 보이고 하루가 지나면 확정)
  attendees: Attendee[]; // 이 수업의 예약 + 대기 (신청 순서). 회원/관리자 모두에게 보임
  guestTypes?: CodeOption[]; // 드랍인/체험 구분 목록 (관리자의 게스트 추가 폼용)
};

// 예약자 이름 표시: 회원은 이름, 드랍인/체험은 "홍길동(드랍인)"
function displayName(a: Attendee): string {
  return a.guestLabel ? `${a.name}(${a.guestLabel})` : a.name;
}

// 수업 종류별 표시 색 (Tailwind는 클래스 이름을 통째로 써야 해서 완성된 이름으로 적습니다)
const typeBadge: Record<ClassSession["classType"], string> = {
  CROSSFIT: "bg-foreground text-background",
  HYROX: "bg-orange-600 text-white",
  OPEN_GYM: "bg-emerald-700 text-white",
  COACH_TRAINING: "bg-violet-700 text-white",
};

export default function ClassCard({
  session: s,
  started,
  startAt,
  isAdmin,
  readOnly = false,
  attendees,
  guestTypes = [],
}: ClassCardProps) {
  const full = s.confirmedCount >= s.capacity;
  const percent = Math.min(100, Math.round((s.confirmedCount / s.capacity) * 100));
  const confirmed = attendees.filter((a) => a.status === "confirmed");
  const waiting = attendees.filter((a) => a.status === "waiting");
  const myWaitingNo = waiting.find((a) => a.isMe)?.queueNo; // 내가 대기 중이면 몇 번째인지

  return (
    // id: 날짜 칸의 "내 예약" 이름표를 누르면 이 카드로 스크롤합니다. (이동 후 강조는 ScrollToTarget이 처리)
    <li
      id={`class-${s.slotId}-${s.classDate}`}
      className="scroll-mt-24 space-y-3 rounded-lg border border-line p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black">{s.endTime ? `${s.startTime} - ${s.endTime}` : s.startTime}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${typeBadge[s.classType]}`}>
            {classLabelsKo[s.classType]}
          </span>
        </div>
        <p className="text-sm">
          <span className="font-bold">
            {s.confirmedCount}/{s.capacity}명
          </span>
          {s.waitingCount > 0 && <span className="ml-2 text-accent">대기 {s.waitingCount}명</span>}
        </p>
      </div>

      {/* 정원 막대 */}
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={`h-full ${full ? "bg-accent" : "bg-foreground"}`} style={{ width: `${percent}%` }} />
      </div>

      {/* 회원 버튼 (관리자는 수업을 예약하지 않으므로 보이지 않음) */}
      {!isAdmin && !readOnly && (
      <div className="flex flex-wrap items-center gap-2">
        {started ? (
          <span className="rounded-md bg-surface px-3 py-2 text-sm text-muted">수업이 시작되었습니다</span>
        ) : s.myStatus && s.myReservationId !== null ? (
          <>
            <span className="rounded-md bg-surface px-3 py-2 text-sm font-bold">
              {s.myStatus === "confirmed" ? "✅ 예약됨" : `⏳ 대기 중${myWaitingNo ? ` (${myWaitingNo}번째)` : ""}`}
            </span>
            <MemberActionForm
              action={cancelReservationAction.bind(null, s.myReservationId)}
              submitLabel={s.myStatus === "confirmed" ? "예약 취소" : "대기 취소"}
              pendingLabel="취소 중…"
              confirmMessage={
                s.myStatus === "confirmed"
                  ? `${s.classDate} ${s.startTime} ${classLabelsKo[s.classType]} 예약을 취소할까요?`
                  : "대기를 취소할까요?"
              }
              layout="inline"
            />
          </>
        ) : (
          <MemberActionForm
            action={reserveAction.bind(null, s.slotId, s.classDate)}
            submitLabel={full ? "대기 신청" : "예약하기"}
            pendingLabel="처리 중…"
            confirmMessage={full ? "정원이 차서 대기로 등록됩니다. 자리가 나면 자동으로 예약됩니다. 대기할까요?" : undefined}
            layout="inline"
          />
        )}
      </div>
      )}

      {/* 관리자 전용: 정원 선택(20/30) */}
      {isAdmin && !started && !readOnly && (
        <div className="border-t border-line pt-3">
          <MemberActionForm
            action={setCapacityAction.bind(null, s.slotId, s.classDate)}
            submitLabel="정원 변경"
            pendingLabel="변경 중…"
            layout="inline"
          >
            <label htmlFor={`cap-${s.slotId}-${s.classDate}`} className="text-sm font-bold">
              정원
            </label>
            {/* key={s.capacity}: 정원이 바뀌면 선택 상자를 새로 만들어서 현재 정원이 선택된 상태로 보이게 합니다.
                (defaultValue는 처음 그릴 때만 적용되고, 폼이 저장 후 초기화되면 예전 값으로 돌아갈 수 있어서) */}
            <select
              key={s.capacity}
              id={`cap-${s.slotId}-${s.classDate}`}
              name="capacity"
              defaultValue={s.capacity === 30 ? "30" : "20"}
              className="rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            >
              <option value="20">20명</option>
              <option value="30">30명</option>
            </select>
          </MemberActionForm>
        </div>
      )}

      {/* 관리자 전용: 회원이 아닌 드랍인/체험 방문자를 예약자에 직접 넣기. 오늘 이후 수업에만 (이미 시작한 오늘 수업도 가능) */}
      {isAdmin && !readOnly && guestTypes.length > 0 && (
        // 모바일은 이름 칸/버튼 여백을 줄여서 "게스트 추가" 버튼이 같은 줄에 들어가게 합니다
        <div className="border-t border-line pt-3 [&_button]:px-3 sm:[&_button]:px-4 [&_form]:gap-1.5 sm:[&_form]:gap-2">
          <MemberActionForm
            action={adminAddGuestAction.bind(null, s.slotId, s.classDate)}
            submitLabel="게스트 추가"
            pendingLabel="추가 중…"
            layout="inline"
          >
            <label htmlFor={`guest-${s.slotId}-${s.classDate}`} className="text-sm font-bold">
              드랍인<span className="sm:hidden">·</span>
              <span className="hidden sm:inline"> · </span>체험
            </label>
            <input
              id={`guest-${s.slotId}-${s.classDate}`}
              name="guestName"
              type="text"
              required
              maxLength={GUEST_NAME_MAX}
              placeholder="이름"
              autoComplete="off"
              className="w-20 rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none sm:w-28"
            />
            <select
              name="guestType"
              defaultValue={guestTypes[0].code}
              aria-label="구분"
              className="rounded-md border border-line px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            >
              {guestTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </MemberActionForm>
        </div>
      )}

      {/* 예약자 목록 (회원/관리자 모두): 프로필 사진 + 이름. 관리자에게는 대신 취소 버튼도 보임 */}
      {attendees.length === 0 ? (
        // 예약한 사람이 없으면 펼칠 내용이 없으므로 "예약자 0명"만 보여줍니다.
        <p className="border-t border-line pt-3 text-sm font-bold">예약자 0명</p>
      ) : (
        <details data-attendees className="border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-bold">
            예약자 {confirmed.length}명{waiting.length > 0 && ` · 대기 ${waiting.length}명`}
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            {confirmed.length > 0 && <AttendeeList title="예약" list={confirmed} readOnly={readOnly} started={started} startAt={startAt} />}
            {waiting.length > 0 && <AttendeeList title="대기 (신청 순서)" list={waiting} numbered readOnly={readOnly} />}
          </div>
        </details>
      )}
    </li>
  );
}

function AttendeeList({
  title,
  list,
  numbered = false,
  readOnly = false,
  started = false,
  startAt,
}: {
  title: string;
  list: Attendee[];
  numbered?: boolean;
  readOnly?: boolean;
  started?: boolean; // 수업이 시작했는지 (시작한 뒤에 출석 버튼이 나옴)
  startAt?: number; // 시작 시각(밀리초): 이때 출석 버튼이 저절로 나타남 (새로고침 불필요)
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-muted">{title}</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {list.map((a) => (
          <li key={`${a.status}-${a.queueNo}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2">
              {numbered && <span className="w-5 text-center font-bold text-accent">{a.queueNo}</span>}
              {/* 프로필 사진이 없으면 기본 실루엣이 나옵니다 */}
              <Avatar url={a.avatarUrl} name={displayName(a)} size={28} mark={medalOf(a.mvpRank)} />
              <span className={a.isMe ? "font-bold" : ""}>{displayName(a)}</span>
              {a.isMe && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">나</span>}
            </span>
            {/* 관리자 버튼: 예약 번호가 관리자에게만 오므로 관리자에게만 보입니다. (출석은 회원만 대상: 대기자와 드랍인/체험은 출석 일수를 기록하지 않음)
                [출석]: 수업이 시작되면 나타납니다. 끝날 때까지 누르지 않으면 수업 종료 후 자동으로 출석 처리됩니다.
                [취소]: 예약 취소. 안 온 회원은 [취소]하면 결석으로 처리됩니다. 이미 출석으로 기록된 회원을 취소하면 출석 일수가 1일 줄어듭니다.
                버튼은 수업 당일에만 있습니다. 하루가 지나면 출석이 확정되어 사라집니다. */}
            {a.reservationId !== null && (
              <span className="flex flex-wrap items-center gap-2">
                {!numbered && !a.guestLabel && a.attended && <span className="text-xs font-bold text-accent">✔ 출석</span>}
                {!readOnly && !numbered && !a.guestLabel && !a.attended && (
                  <TimeGate initial={started} showFrom={startAt}>
                    <MemberActionForm
                      action={markAttendanceAction.bind(null, a.reservationId)}
                      submitLabel="출석"
                      pendingLabel="처리 중…"
                      layout="inline"
                    />
                  </TimeGate>
                )}
                {/* 지난 날짜에는 버튼이 없습니다. 출석은 수업 당일에만 정정할 수 있고, 하루가 지나면 확정됩니다 */}
                {!readOnly && (
                  <MemberActionForm
                    action={adminCancelReservationAction.bind(null, a.reservationId)}
                    submitLabel="취소"
                    pendingLabel="취소 중…"
                    confirmMessage={`${displayName(a)}님의 ${numbered ? "대기" : "예약"}를 취소할까요?${a.attended ? "\n이미 출석으로 기록되어 있어서 취소하면 출석 일수가 1일 줄어듭니다." : ""}`}
                    layout="inline"
                  />
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
