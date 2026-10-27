// 수업 한 칸(날짜별)의 카드: 시간, 종류, 정원 현황, 예약/취소 버튼. 관리자에게는 정원 선택과 예약자 목록도 보여줍니다.
// 서버에서 그려지는 컴포넌트이고, 버튼 폼(MemberActionForm)만 브라우저에서 실행됩니다.
import {
  adminCancelReservationAction,
  cancelReservationAction,
  reserveAction,
  setCapacityAction,
} from "@/app/reserve/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import Avatar from "@/components/Avatar";
import { classLabelsKo } from "@/data/timetable";
import type { Attendee, ClassSession } from "@/lib/reservations/repository";

type ClassCardProps = {
  session: ClassSession;
  started: boolean; // 수업이 이미 시작했는지 (시작했으면 예약/취소 불가)
  isAdmin: boolean;
  readOnly?: boolean; // 지난 날짜: 예약/취소/정원 변경 버튼 없이 예약자 목록만 보여줌
  attendees: Attendee[]; // 이 수업의 예약 + 대기 (신청 순서). 회원/관리자 모두에게 보임
};

// 수업 종류별 표시 색 (Tailwind는 클래스 이름을 통째로 써야 해서 완성된 이름으로 적습니다)
const typeBadge: Record<ClassSession["classType"], string> = {
  CROSSFIT: "bg-foreground text-background",
  HYROX: "bg-accent text-white",
  OPEN_GYM: "bg-emerald-700 text-white",
  COACH_TRAINING: "bg-violet-700 text-white",
};

export default function ClassCard({ session: s, started, isAdmin, readOnly = false, attendees }: ClassCardProps) {
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
          <span className="text-xl font-black">{s.startTime}</span>
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

      {/* 예약자 목록 (회원/관리자 모두): 프로필 사진 + 이름. 관리자에게는 대신 취소 버튼도 보임 */}
      {attendees.length === 0 ? (
        // 예약한 사람이 없으면 펼칠 내용이 없으므로 "예약자 0명"만 보여줍니다.
        <p className="border-t border-line pt-3 text-sm font-bold">예약자 0명</p>
      ) : (
        <details open={readOnly} className="border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-bold">
            예약자 {confirmed.length}명{waiting.length > 0 && ` · 대기 ${waiting.length}명`}
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            {confirmed.length > 0 && <AttendeeList title="예약" list={confirmed} readOnly={readOnly} />}
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
}: {
  title: string;
  list: Attendee[];
  numbered?: boolean;
  readOnly?: boolean;
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
              <Avatar url={a.avatarUrl} name={a.name} size={28} />
              <span className={a.isMe ? "font-bold" : ""}>{a.name}</span>
              {a.isMe && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">나</span>}
            </span>
            {/* 대신 취소는 관리자에게만 예약 번호가 와서 관리자에게만 보입니다 */}
            {a.reservationId !== null && !readOnly && (
              <MemberActionForm
                action={adminCancelReservationAction.bind(null, a.reservationId)}
                submitLabel="취소"
                pendingLabel="취소 중…"
                confirmMessage={`${a.name}님의 ${numbered ? "대기" : "예약"}를 취소할까요?`}
                layout="inline"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
