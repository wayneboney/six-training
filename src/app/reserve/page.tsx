import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { cancelReservationAction } from "@/app/reserve/actions";
import MemberActionForm from "@/components/admin/MemberActionForm";
import ClassCard from "@/components/reserve/ClassCard";
import { classLabels } from "@/data/timetable";
import { requireMember } from "@/lib/auth/member";
import { addDaysToKey, parseDateKey, seoulTodayKey, weekdayLabels } from "@/lib/date";
import { getHolidays } from "@/lib/holidays/repository";
import {
  getAttendees,
  getMyReservations,
  getSchedule,
  type Attendee,
  type ClassSession,
  type MyReservation,
} from "@/lib/reservations/repository";

export const metadata = { title: "수업 예약" };


// /reserve  (로그인한 회원 전용)   주소의 ?date=YYYY-MM-DD 로 보고 싶은 날을 고릅니다.
export default function ReservePage(props: PageProps<"/reserve">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-black">수업 예약</h1>
      <p className="mt-2 text-sm text-muted">
        이번 주 수업을 예약할 수 있습니다. 정원이 차면 대기로 등록되고, 자리가 나면 자동으로 예약됩니다.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <ReserveContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

// 날짜(YYYY-MM-DD)의 요일: 0=일 ... 6=토
function weekdayOf(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(year, month, day).getDay();
}

// 수업 시작 시각(한국 시간)이 지났는지
function hasStarted(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00+09:00`).getTime() <= Date.now();
}

async function ReserveContent({ searchParams }: { searchParams: PageProps<"/reserve">["searchParams"] }) {
  await connection(); // 현재 시각과 로그인 정보는 요청할 때마다 다름
  const member = await requireMember(); // 로그인 안 했으면 /login 으로 이동
  const isAdmin = member.role === "admin";

  const today = seoulTodayKey();
  // 날짜 선택은 "월 화 수 목 금 토" 순서로 이번 주만 보여줍니다. (일요일은 휴무라서 뺌)
  // 이번 주 월요일: 오늘이 일요일이면 내일(다음 주 월요일), 아니면 오늘이 속한 주의 월요일
  const todayWeekday = weekdayOf(today); // 0=일 ... 6=토
  const firstMonday = todayWeekday === 0 ? addDaysToKey(today, 1) : addDaysToKey(today, -(todayWeekday - 1));
  const lastDay = addDaysToKey(firstMonday, 5); // 그 주 토요일
  const bookable = (d: string) => d >= today && d <= lastDay; // 예약할 수 있는 날짜 (오늘 ~ 이번 주 토요일)
  const weeks = [Array.from({ length: 6 }, (_, i) => addDaysToKey(firstMonday, i))];
  const weekDays = weeks.flat();

  const query = await searchParams;
  const picked = typeof query.date === "string" ? query.date : "";
  // 선택한 날: 주소의 날짜가 예약 가능한 날이면 그 날, 아니면 오늘(월~토일 때), 아니면 가장 가까운 예약 가능한 날
  const selected = weekDays.includes(picked) && bookable(picked)
    ? picked
    : weekDays.includes(today)
      ? today
      : (weekDays.find(bookable) ?? today);

  // DB 조회만 try/catch로 감쌉니다. (화면은 밖에서)
  let sessions: ClassSession[] | null = null;
  let mine: MyReservation[] = [];
  let attendees: Attendee[] = [];
  let holidays: Record<string, string> = {};
  try {
    const [schedule, myList, attendeeList, holidayMap] = await Promise.all([
      getSchedule(selected, selected),
      getMyReservations(today),
      getAttendees(selected, selected),
      getHolidays([...new Set(weekDays.map((d) => parseDateKey(d).year))]),
    ]);
    sessions = schedule;
    mine = myList;
    attendees = attendeeList;
    holidays = holidayMap;
  } catch (error) {
    console.error("[reserve] 예약 화면 조회 실패", error);
  }

  if (sessions === null) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-bold">수업 정보를 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
      </div>
    );
  }

  const canReserve = isAdmin || member.status === "active"; // 관리자는 예약하지 않으므로 안내 문구도 보이지 않음

  return (
    <div className="space-y-8">
      {!canReserve && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-accent">
          {member.status === "pending"
            ? "가입 승인 후 예약할 수 있습니다. 코치가 회원권을 등록하면 이용할 수 있어요."
            : "이용 중인 회원권이 없습니다. 코치에게 재등록을 문의해 주세요."}
        </p>
      )}

      {/* 내 예약 (관리자는 예약하지 않으므로 숨김) */}
      {!isAdmin && (
      <section>
        <h2 className="font-bold">내 예약 {mine.length > 0 && <span className="text-accent">{mine.length}</span>}</h2>
        {mine.length === 0 ? (
          <p className="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-muted">예약한 수업이 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {mine.map((r) => {
              const { month, day } = parseDateKey(r.classDate);
              const weekday = weekdayLabels[weekdayOf(r.classDate)];
              const started = hasStarted(r.classDate, r.startTime);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    <span className="font-bold">
                      {month + 1}/{day} ({weekday}) {r.startTime}
                    </span>
                    <span className="ml-2 text-muted">
                      {classLabels[r.classType as keyof typeof classLabels] ?? r.classType}
                    </span>
                    <span className={`ml-2 text-xs font-bold ${r.status === "waiting" ? "text-accent" : ""}`}>
                      {r.status === "waiting" ? "대기 중" : "예약됨"}
                    </span>
                  </span>
                  {!started && (
                    <MemberActionForm
                      action={cancelReservationAction.bind(null, r.id)}
                      submitLabel="취소"
                      pendingLabel="취소 중…"
                      confirmMessage="이 예약을 취소할까요?"
                      layout="inline"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {/* 날짜 선택: 월~토를 한 줄로, 이번 주 / 다음 주. 오늘은 테두리와 "오늘" 표시로 강조합니다. */}
      <div className="space-y-4">
        {weeks.map((week, weekIndex) => {
          const label = weekIndex === 0 && todayWeekday !== 0 ? "이번 주" : "다음 주";
          const first = parseDateKey(week[0]);
          const last = parseDateKey(week[5]);
          return (
            <div key={week[0]}>
              <p className="mb-1.5 text-xs font-bold text-muted">
                {label}{" "}
                <span className="font-normal">
                  {first.month + 1}/{first.day} ~ {last.month + 1}/{last.day}
                </span>
              </p>
              <nav aria-label={`${label} 날짜 선택`} className="grid grid-cols-6 gap-2">
                {week.map((d) => {
                  const { day } = parseDateKey(d);
                  const holiday = holidays[d];
                  const active = d === selected;
                  const isToday = d === today;
                  const enabled = bookable(d);
                  const red = holiday !== undefined;
                  const box = `flex flex-col items-center rounded-md border px-1 py-2 text-sm ${
                    active
                      ? "border-accent bg-accent text-white"
                      : isToday
                        ? "border-2 border-accent"
                        : "border-line"
                  }`;
                  const content = (
                    <>
                      <span className={`text-xs ${active ? "text-white" : red ? "text-accent" : "text-muted"}`}>
                        {weekdayLabels[weekdayOf(d)]}
                      </span>
                      <span className={`font-black ${!active && red ? "text-accent" : ""}`}>{day}</span>
                      {isToday ? (
                        <span className={`text-[10px] font-bold ${active ? "" : "text-accent"}`}>오늘</span>
                      ) : holiday ? (
                        <span className="w-full truncate text-center text-[10px]">{holiday}</span>
                      ) : (
                        <span className="text-[10px]">&nbsp;</span>
                      )}
                    </>
                  );
                  // 오늘보다 이전이거나 7일 뒤를 넘는 날은 눌러도 이동하지 않게 비활성으로 표시합니다.
                  return enabled ? (
                    <Link
                      key={d}
                      href={`/reserve?date=${d}`}
                      aria-current={active ? "date" : undefined}
                      className={`${box} ${active ? "" : "hover:bg-surface"}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={d} aria-disabled="true" className={`${box} opacity-35`}>
                      {content}
                    </div>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
      <p className="-mt-6 text-xs text-muted">
        오늘부터 {lastDay}(토)까지 예약할 수 있습니다. 일요일은 휴무입니다.
      </p>

      {/* 선택한 날의 수업 */}
      {sessions.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-center text-muted">이 날은 예약할 수 있는 수업이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <ClassCard
              key={`${s.slotId}-${s.classDate}`}
              session={s}
              started={hasStarted(s.classDate, s.startTime)}
              isAdmin={isAdmin}
              attendees={attendees.filter((a) => a.slotId === s.slotId && a.classDate === s.classDate)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
