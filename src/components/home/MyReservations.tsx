// 홈 화면의 "내 예약" 한 줄 요약. 회원권이 유효한 일반회원이 앞으로 들을 예약(또는 대기)이 있을 때만 나타납니다.
// 예약이 없거나, 관리자이거나, 조회에 실패하면 아무것도 그리지 않아서 홈 화면은 그대로입니다.
import Link from "next/link";
import { connection } from "next/server";
import { classLabelsKo } from "@/data/timetable";
import { getMemberIfSignedIn, hasContentAccess } from "@/lib/auth/member";
import { addDaysToKey, parseDateKey, seoulTodayKey, weekdayLabels } from "@/lib/date";
import { getMyReservations, type MyReservation } from "@/lib/reservations/repository";

const SHOW_MAX = 3; // 홈에 보여 줄 최대 개수 (나머지는 "외 N건")

// "오늘", "내일", 그 밖에는 "10/31(토)"
function dayLabel(date: string, today: string): string {
  if (date === today) return "오늘";
  if (date === addDaysToKey(today, 1)) return "내일";
  const { year, month, day } = parseDateKey(date);
  return `${month + 1}/${day}(${weekdayLabels[new Date(year, month, day).getDay()]})`;
}

// 오늘 수업 중 시작한 지 1시간이 넘은 것은 이미 끝난 수업으로 보고 뺍니다. (종료 시각을 몰라도 대략 맞춤)
function isUpcoming(r: MyReservation, today: string): boolean {
  if (r.classDate !== today) return r.classDate > today;
  return new Date(`${r.classDate}T${r.startTime}:00+09:00`).getTime() + 60 * 60 * 1000 > Date.now();
}

export default async function MyReservations() {
  await connection(); // 로그인 정보와 현재 시각은 요청할 때마다 다름
  const member = await getMemberIfSignedIn();
  if (!member || member.role !== "member" || !(await hasContentAccess(member.userId))) {
    return null;
  }

  const today = seoulTodayKey();
  let list: MyReservation[] = [];
  try {
    list = (await getMyReservations(today)).filter((r) => isUpcoming(r, today));
  } catch (error) {
    console.error("[home] 내 예약 조회 실패 (홈 화면은 그대로 표시)", error);
    return null;
  }
  if (list.length === 0) {
    return null;
  }

  const shown = list.slice(0, SHOW_MAX);
  const rest = list.length - shown.length;

  return (
    <section aria-label="내 예약" className="mx-auto max-w-5xl px-4 pt-6">
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-xs font-bold text-muted">내 예약</p>
        <ul className="mt-1 divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id}>
              {/* 줄 전체가 링크: 누르면 그 날짜의 수업 예약 화면으로 */}
              <Link href={`/reserve?date=${r.classDate}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                <span className="min-w-0 truncate text-sm">
                  <span className={`font-bold ${r.classDate === today ? "text-accent" : ""}`}>{dayLabel(r.classDate, today)}</span>{" "}
                  {r.startTime} {classLabelsKo[r.classType as keyof typeof classLabelsKo] ?? r.classType}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {r.status === "waiting" ? (
                    <span className="rounded border border-line px-1.5 py-0.5 text-muted">대기</span>
                  ) : (
                    <span className="rounded bg-accent px-1.5 py-0.5 font-bold text-white">예약</span>
                  )}
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <Link href="/reserve" className="block pt-1 text-xs font-bold text-muted hover:text-accent">
            외 {rest}건 · 수업 예약 보기 →
          </Link>
        )}
      </div>
    </section>
  );
}
