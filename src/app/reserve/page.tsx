import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import ClassCard from "@/components/reserve/ClassCard";
import ExpandAllButtons from "@/components/reserve/ExpandAllButtons";
import LinkPendingOverlay from "@/components/reserve/LinkPendingOverlay";
import ScrollToTarget from "@/components/reserve/ScrollToTarget";
import TodayButton from "@/components/reserve/TodayButton";
import { classLabelsKo } from "@/data/timetable";
import { requireContentAccess } from "@/lib/auth/member";
import { addDaysToKey, lastMonthStartKey, parseDateKey, seoulTodayKey, weekdayLabels } from "@/lib/date";
import { getHolidays } from "@/lib/holidays/repository";
import { getActiveCodes, type CodeOption } from "@/lib/members/repository";
import {
  getAttendees,
  getMonthlyMvp,
  getMyReservations,
  getSchedule,
  type Attendee,
  type ClassSession,
  type MonthlyMvp,
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
  const member = await requireContentAccess(); // 로그인 안 했으면 /login, 회원권이 유효하지 않으면 /me 로 이동
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
  // 선택한 날: 주소의 날짜가 이번 주 안이면 그 날(지난 날도 가능), 아니면 오늘(월~토일 때), 아니면 가장 가까운 예약 가능한 날
  const selected = weekDays.includes(picked)
    ? picked
    : weekDays.includes(today)
      ? today
      : (weekDays.find(bookable) ?? today);
  const selectedParts = parseDateKey(selected);
  const selectedLabel = `${selectedParts.month + 1}월 ${selectedParts.day}일 (${weekdayLabels[weekdayOf(selected)]})`;
  const isPastDay = selected < today; // 지난 날짜를 보는 중이면 예약 버튼 없이 예약자 목록만 보여줍니다.

  // DB 조회만 try/catch로 감쌉니다. (화면은 밖에서)
  let sessions: ClassSession[] | null = null;
  let mine: MyReservation[] = [];
  let attendees: Attendee[] = [];
  let holidays: Record<string, string> = {};
  let guestTypes: CodeOption[] = [];
  let mvps: MonthlyMvp[] = []; // 지난달 MVP (조회에 실패해도 예약 화면은 그대로 보여줌)
  try {
    const [schedule, myList, attendeeList, holidayMap, guestTypeList] = await Promise.all([
      getSchedule(selected, selected),
      isAdmin ? Promise.resolve([] as MyReservation[]) : getMyReservations(firstMonday),
      getAttendees(selected, selected),
      getHolidays([...new Set(weekDays.map((d) => parseDateKey(d).year))]),
      // 드랍인/체험 구분 목록 (관리자의 "게스트 추가"에서만 필요)
      isAdmin ? getActiveCodes("GUEST_TYPE") : Promise.resolve([] as CodeOption[]),
    ]);
    sessions = schedule;
    mine = myList;
    attendees = attendeeList;
    holidays = holidayMap;
    guestTypes = guestTypeList;
  } catch (error) {
    console.error("[reserve] 예약 화면 조회 실패", error);
  }

  try {
    mvps = await getMonthlyMvp(lastMonthStartKey(today));
  } catch (error) {
    console.error("[reserve] 지난달 MVP 조회 실패", error);
  }

  if (sessions === null) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-bold">수업 정보를 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
      </div>
    );
  }

  // 내 예약을 날짜별로 묶어서 날짜 선택 줄(월~토)의 각 칸 아래에 표시합니다.
  const mineByDate = new Map<string, MyReservation[]>();
  for (const r of mine) {
    mineByDate.set(r.classDate, [...(mineByDate.get(r.classDate) ?? []), r]);
  }

  const canReserve = isAdmin || member.status === "active"; // 관리자는 예약하지 않으므로 안내 문구도 보이지 않음

  return (
    <div className="space-y-8">
      <ScrollToTarget />
      {!canReserve && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-accent">
          {member.status === "pending"
            ? "가입 승인 후 예약할 수 있습니다. 코치가 회원권을 등록하면 이용할 수 있어요."
            : "이용 중인 회원권이 없습니다. 코치에게 재등록을 문의해 주세요."}
        </p>
      )}

      {/* 지난달 MVP: 지난달 출석 일수가 가장 많은 회원 (동점이면 모두). 매달 1일부터 그 달 내내 보입니다 */}
      {mvps.length > 0 && (
        <section aria-label="지난달 MVP" className="rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-xs font-bold text-muted">
            🏆 {parseDateKey(lastMonthStartKey(today)).month + 1}월 MVP · 출석 {mvps[0].attendDays}일
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {mvps.map((m, i) => (
              <li key={`${m.name}-${i}`} className="flex items-center gap-2">
                <Avatar url={m.avatarUrl} name={m.name} size={32} />
                <span className="font-bold">{m.name}</span>
              </li>
            ))}
          </ul>
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
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-muted">
                  {label}{" "}
                  <span className="font-normal">
                    {first.month + 1}/{first.day} ~ {last.month + 1}/{last.day}
                  </span>
                </p>
                {/* 오늘이 이 주에 있을 때만 (일요일에는 오늘이 달력에 없어서 숨김) */}
                {week.includes(today) && <TodayButton date={today} />}
              </div>
              <nav aria-label={`${label} 날짜 선택`} className="grid grid-cols-6 gap-2">
                {week.map((d) => {
                  const { day } = parseDateKey(d);
                  const holiday = holidays[d];
                  const active = d === selected;
                  const isToday = d === today;
                  const past = d < today; // 지난 날: 눌러서 예약자 목록은 볼 수 있지만 예약은 못 함
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
                      <span className={`font-black ${!active && red ? "text-accent" : ""} ${!active && past ? "text-muted" : ""}`}>{day}</span>
                      {isToday ? (
                        <span className={`text-[10px] font-bold ${active ? "" : "text-accent"}`}>오늘</span>
                      ) : holiday ? (
                        <span className="w-full truncate text-center text-[10px]">{holiday}</span>
                      ) : (
                        <span className="text-[10px]">&nbsp;</span>
                      )}
                    </>
                  );
                  const mineToday = mineByDate.get(d) ?? [];
                  return (
                    // 칸 전체는 div로 감싸고, 날짜 부분과 "내 예약" 이름표를 각각 링크로 둡니다. (링크 안에 링크를 넣을 수 없어서)
                    // relative: 날짜 링크가 칸 전체를 눌리게 만들기 위한 기준 / cursor-pointer + hover + active: 누를 수 있다는 표시
                    <div
                      key={d}
                      className={`${box} relative cursor-pointer transition duration-150 active:scale-95 ${
                        active
                          ? "hover:brightness-110"
                          : `hover:border-accent hover:bg-surface ${past ? "bg-surface/60" : ""}`
                      }`}
                    >
                      {/* after:absolute after:inset-0 = 링크의 클릭 영역을 칸 전체로 넓힘. 이름표는 뒤에 오는 relative 요소라 그 위에 그려져서 따로 눌립니다 (z-index를 주면 헤더 위로 올라와 가리므로 주지 않음) */}
                      <Link
                        href={`/reserve?date=${d}`}
                        aria-current={active ? "date" : undefined}
                        className="flex w-full flex-col items-center after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
                      >
                        {content}
                        <LinkPendingOverlay />
                      </Link>
                      {mineToday.length > 0 && (
                        <div className="relative mt-1.5 flex w-full flex-col gap-1">
                          {mineToday.map((r) => (
                            <MyChip key={r.id} reservation={r} date={d} selected={active} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
      <p className="-mt-6 text-xs text-muted">
        오늘부터 {lastDay}(토)까지 예약할 수 있습니다. 지난 날짜를 누르면 예약자 목록만 볼 수 있습니다. 일요일은 휴무입니다.
      </p>

      {/* 선택한 날의 수업: 제목과 카드 목록을 한 묶음으로 두고, 묶음 안에서만 간격을 줍니다. (제목이 카드와 겹치지 않게) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-black leading-tight">
            <span>{selectedLabel} 수업</span>
            {selected === today && (
              <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-white">오늘</span>
            )}
            {isPastDay && <span className="text-xs font-normal text-muted">지난 수업 (예약자만 볼 수 있음)</span>}
          </h2>
          {/* 수업이 여러 개일 때 예약자 목록을 한꺼번에 펼치거나 접기 */}
          {sessions.length > 1 && <ExpandAllButtons />}
        </div>
        {sessions.length === 0 ? (
          <p className="rounded-lg bg-surface p-8 text-center text-muted">이 날은 예약할 수 있는 수업이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <ClassCard
                key={`${s.slotId}-${s.classDate}`}
                session={s}
                started={hasStarted(s.classDate, s.startTime)}
                readOnly={isPastDay}
                isAdmin={isAdmin}
                guestTypes={guestTypes}
                attendees={attendees.filter((a) => a.slotId === s.slotId && a.classDate === s.classDate)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// 날짜 칸 안의 "내 예약" 이름표. 누르면 그 날짜의 해당 수업 카드로 이동(스크롤)합니다.
//   첫 줄: 수업 종류(크로스핏/하이록스/오픈짐), 둘째 줄: 예약 또는 대기 + 시작 시각
//   왼쪽 굵은 선의 색으로 종류를 구분하고(검정/붉은색/회색), 대기는 점선으로 구분합니다.
// 종류마다 선과 글자색을 다르게: 크로스핏 검정, 하이록스 주황, 오픈짐 초록, 코치트레이닝 보라 (사이트 포인트색(붉은색)은 선택/대기 표시에 쓰므로 종류 색에서는 뺌)
const chipAccent: Record<string, string> = {
  CROSSFIT: "border-l-foreground",
  HYROX: "border-l-orange-500",
  OPEN_GYM: "border-l-emerald-600",
  COACH_TRAINING: "border-l-violet-600",
};
const chipText: Record<string, string> = {
  CROSSFIT: "text-foreground",
  HYROX: "text-orange-700",
  OPEN_GYM: "text-emerald-700",
  COACH_TRAINING: "text-violet-700",
};

function MyChip({ reservation: r, date, selected }: { reservation: MyReservation; date: string; selected: boolean }) {
  const label = classLabelsKo[r.classType as keyof typeof classLabelsKo] ?? r.classType;
  // 이름표 칸이 좁아서 "코치트레이닝"은 "코치" / "트레이닝" 두 줄로 나뉘도록 중간에 줄바꿈 가능 표시(보이지 않는 글자)를 넣습니다.
  const chipLabel = r.classType === "COACH_TRAINING" ? "코치\u200b트레이닝" : label;
  const waiting = r.status === "waiting";
  return (
    <Link
      href={`/reserve?date=${date}#class-${r.slotId}-${date}`}
      title={`${label} ${waiting ? "대기" : "예약"} ${r.startTime} (누르면 해당 수업으로 이동)`}
      className={`block w-full rounded-md border-l-4 px-1.5 py-1 text-left leading-tight shadow-sm hover:brightness-95 ${
        chipAccent[r.classType] ?? "border-l-muted"
      } ${selected ? "bg-white" : "bg-surface"} ${waiting ? "border-y border-r border-dashed border-y-line border-r-line" : ""}`}
    >
      <span className={`block text-[11px] font-black ${chipText[r.classType] ?? "text-foreground"}`}>{chipLabel}</span>
      <span className={`block text-[10px] ${waiting ? "font-bold text-accent" : "text-muted"}`}>
        {waiting ? "대기" : "예약"} {r.startTime}
      </span>
    </Link>
  );
}
