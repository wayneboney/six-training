import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import WodAdminList from "@/components/admin/WodAdminList";
import type { Wod } from "@/data/wods";
import { requireAdmin } from "@/lib/auth/admin";
import { monthDateRange, parseMonthKey, parseDateKey, seoulTodayKey, shiftMonth, toMonthKey } from "@/lib/date";
import { getWods } from "@/lib/wods/repository";

// /admin/wods = WOD 관리 (월별 WOD 목록). 관리자 첫 화면입니다.
// 보고 싶은 달은 주소로 받습니다. 예: /admin/wods?month=2026-10
// 주소에 달이 들어 있어서 새로고침하거나 북마크해도 같은 달이 열립니다.
export default function AdminHomePage(props: PageProps<"/admin/wods">) {
  return (
    <Suspense fallback={<p className="text-muted">확인 중…</p>}>
      <AdminHome searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AdminHome({ searchParams }: { searchParams: PageProps<"/admin/wods">["searchParams"] }) {
  // 관리자 화면은 로그인한 사람마다 내용이 달라서 미리 만들어 둘 수 없습니다.
  // connection() = "방문자가 요청했을 때만 실행"하라는 표시 (링크 미리 불러오기 단계에서는 실행하지 않음)
  await connection();

  // 관리자가 아니면 여기서 로그인 화면으로 이동하고, 아래 코드는 실행되지 않습니다.
  await requireAdmin();

  // 보고 싶은 달: 주소의 ?month= 값. 없거나 형식이 틀리면 이번 달(한국 시간)
  const { month: monthParam, saved, deleted } = await searchParams;
  const todayKey = seoulTodayKey();
  const today = parseDateKey(todayKey);
  const target = parseMonthKey(typeof monthParam === "string" ? monthParam : undefined) ?? {
    year: today.year,
    month: today.month,
  };
  const prev = shiftMonth(target.year, target.month, -1);
  const next = shiftMonth(target.year, target.month, 1);
  const { from, to } = monthDateRange(target.year, target.month);

  // "새 WOD 등록"을 누르면 채워 둘 날짜: 이번 달을 보고 있으면 오늘, 다른 달이면 그 달 1일
  const isCurrentMonth = target.year === today.year && target.month === today.month;
  const newWodDate = isCurrentMonth ? todayKey : from;

  // DB 조회만 try/catch로 감쌉니다. (화면 코드는 밖에서)
  let wods: Wod[] | null = null;
  try {
    wods = await getWods(from, to);
  } catch (error) {
    console.error("[admin] WOD 목록 조회 실패", error);
  }

  return (
    <div>
      <h1 className="text-2xl font-black">WOD 관리</h1>

      {/* 완료 안내: 등록/수정 후 ?saved=1, 삭제 후 ?deleted=1을 붙여서 이 화면으로 돌아옵니다 */}
      {saved === "1" && (
        <p role="status" className="mt-6 rounded-md bg-surface px-4 py-3 text-sm font-bold">
          ✅ 저장되었습니다.
        </p>
      )}
      {deleted === "1" && (
        <p role="status" className="mt-6 rounded-md bg-surface px-4 py-3 text-sm font-bold">
          🗑 삭제되었습니다.
        </p>
      )}

      {/* WOD 목록 */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          {/* 월 이동은 링크로: 주소의 ?month= 값만 바꿔서 같은 페이지를 다시 엽니다 */}
          <Link
            href={`/admin/wods?month=${toMonthKey(prev.year, prev.month)}`}
            aria-label="이전 달"
            className="rounded-md border border-line px-3 py-1 hover:bg-surface"
          >
            ‹
          </Link>
          <h2 className="text-xl font-black">
            {target.year}년 {target.month + 1}월 WOD
          </h2>
          <Link
            href={`/admin/wods?month=${toMonthKey(next.year, next.month)}`}
            aria-label="다음 달"
            className="rounded-md border border-line px-3 py-1 hover:bg-surface"
          >
            ›
          </Link>
        </div>

        {wods === null ? (
          <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
            <p className="font-bold">WOD 목록을 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">총 {wods.length}개</p>
              <Link
                href={`/admin/wods/new?date=${newWodDate}`}
                className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                + 새 WOD 등록
              </Link>
            </div>
            <WodAdminList wods={wods} />
          </>
        )}
      </section>
    </div>
  );
}
