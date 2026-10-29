import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import WodCalendar from "@/components/wod/WodCalendar";
import { parseDateKey, seoulTodayKey, toDateKey } from "@/lib/date";
import { getAdminIfSignedIn } from "@/lib/auth/admin";
import { requireContentAccess } from "@/lib/auth/member";
import { getHolidays } from "@/lib/holidays/repository";
import { getWods } from "@/lib/wods/repository";

export const metadata: Metadata = {
  title: "Program",
};

// 몇 달치 Program을 가져올지 (오늘이 속한 달 기준)
const MONTHS_BEFORE = 6;
const MONTHS_AFTER = 3;

// /program 주소의 화면.
// 제목 부분은 빌드할 때 미리 만들어 두고, Program 달력 부분(WodSection)만 방문할 때마다 DB에서 새로 읽습니다.
// 그래서 코치가 DB에 Program을 올리면 다음 방문부터 바로 반영됩니다.
export default function WodPage() {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="text-sm font-bold tracking-widest text-accent">WORKOUT OF THE DAY</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">Program</h1>
          <p className="mt-4 text-muted">날짜를 누르면 그날의 Program을 볼 수 있습니다.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Suspense = 안쪽(WodSection)이 DB를 읽는 동안 fallback을 먼저 보여주고, 다 읽으면 바꿔 끼웁니다 */}
        <Suspense fallback={<p className="py-20 text-center text-muted">Program을 불러오는 중입니다…</p>}>
          <WodSection />
        </Suspense>
      </div>
    </>
  );
}

// DB에서 Program을 읽어 달력에 넘기는 부분 (Controller가 Service를 호출해 화면에 넘기는 역할)
async function WodSection() {
  // connection() = "여기부터는 빌드할 때가 아니라 방문자가 접속했을 때 실행"하라는 표시
  await connection();
  // 회원권이 유효한 회원(과 관리자)만 볼 수 있습니다. 로그인하지 않았으면 로그인 화면, 회원권이 없으면 내 정보로 보냅니다.
  // (proxy.ts가 먼저 막지만 여기서도 확인. DB 규칙도 같은 조건으로 막음)
  await requireContentAccess();

  // 조회 기간: 오늘이 속한 달 기준 6개월 전 1일 ~ 3개월 후 말일 (한국 시간 기준)
  const { year, month } = parseDateKey(seoulTodayKey());
  const fromDate = new Date(year, month - MONTHS_BEFORE, 1);
  const toDate = new Date(year, month + MONTHS_AFTER + 1, 0); // 다음 달 0일 = 이번 달 말일
  const from = toDateKey(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = toDateKey(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

  // try/catch는 "DB 조회"만 감쌉니다.
  // 화면(JSX)을 try 안에서 만들면, 화면을 그리다 난 에러는 이 catch로 잡히지 않는데도 잡히는 것처럼 보여서 헷갈립니다.
  // Program 조회와 관리자 확인을 동시에 시작합니다. (하나씩 기다리지 않아서 더 빠름)
  // 관리자 확인은 로그인 쿠키가 없으면 바로 끝나고, 실패해도 null이라 페이지가 깨지지 않습니다.
  const adminPromise = getAdminIfSignedIn();
  // 공휴일도 같이 가져옵니다. 조회 기간이 걸치는 모든 해(보통 1~2개)가 대상이고, 실패해도 달력은 그대로 나옵니다.
  const years = Array.from({ length: toDate.getFullYear() - fromDate.getFullYear() + 1 }, (_, i) => fromDate.getFullYear() + i);
  const holidaysPromise = getHolidays(years);

  let wods: Awaited<ReturnType<typeof getWods>> | null = null;
  try {
    wods = await getWods(from, to);
  } catch (error) {
    // 자세한 원인은 서버 로그에만 남기고, 방문자에게는 안내 문구만 보여줍니다. (DB 정보 노출 방지)
    console.error("[wod page] Program을 불러오지 못했습니다.", error);
  }
  const isAdmin = (await adminPromise) !== null;

  if (wods === null) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-bold">Program을 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
      </div>
    );
  }

  const holidays = await holidaysPromise;

  return <WodCalendar wods={wods} holidays={holidays} isAdmin={isAdmin} />;
}
