import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import WodDetail from "@/components/wod/WodDetail";
import { gym } from "@/data/gym";
import type { Wod } from "@/data/wods";
import { getAdminIfSignedIn } from "@/lib/auth/admin";
import { getMemberIfSignedIn, hasContentAccess } from "@/lib/auth/member";
import { seoulTodayKey } from "@/lib/date";
import { getWods } from "@/lib/wods/repository";

// page.tsx = "/" 주소에 보여줄 화면 (메인 페이지)
// 위쪽 소개 문구는 미리 만들어 두고, "오늘의 WOD"만 방문할 때마다 DB에서 새로 읽습니다.
export default function Home() {
  return (
    <>
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-20 sm:py-28">
        <p className="text-sm font-bold uppercase tracking-widest text-accent">CrossFit · HYROX</p>

        {/* sm:text-6xl = 화면이 640px 이상일 때만 글자를 더 크게 (모바일 우선 설계) */}
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">{gym.slogan}</h1>

        {/* 대표 소개 문구 (src/data/gym.ts의 highlights) */}
        <ul className="space-y-2 text-lg text-muted">
          {gym.highlights.map((text) => (
            <li key={text} className="flex items-start gap-2">
              <span aria-hidden="true" className="font-bold text-accent">
                ✓
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          {/* 사이트 안의 페이지로 이동할 때는 <Link> */}
          <Link
            href="/about"
            className="rounded-md bg-accent px-6 py-3 font-bold text-white hover:opacity-90"
          >
            체육관 둘러보기
          </Link>
        </div>
      </div>

      {/* 오늘의 WOD: 회원권이 유효한 회원(과 관리자)에게만 보입니다. 확인이 끝날 때까지는 아무것도 보여주지 않습니다. */}
      <Suspense fallback={null}>
        <TodayWodSection />
      </Suspense>
    </>
  );
}

// "오늘의 WOD" 영역 전체. 볼 수 없는 사람에게는 영역 자체를 그리지 않습니다.
async function TodayWodSection() {
  await connection();
  const member = await getMemberIfSignedIn();
  if (!member || !(await hasContentAccess(member.userId))) {
    return null;
  }
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-accent">TODAY</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">오늘의 WOD</h2>
          </div>
          <Link href="/wod" className="shrink-0 text-sm font-bold text-muted hover:text-accent">
            WOD 달력 보기 →
          </Link>
        </div>

        {/* DB를 읽는 동안 안내 문구를 먼저 보여주고, 다 읽으면 바꿔 끼웁니다 */}
        <Suspense fallback={<p className="text-muted">오늘의 WOD를 불러오는 중입니다…</p>}>
          <TodayWod />
        </Suspense>
      </div>
    </section>
  );
}

// 오늘(한국 시간) WOD를 DB에서 읽어서 보여주는 부분
async function TodayWod() {
  // 오늘 날짜는 방문할 때마다 달라지므로, 빌드할 때가 아니라 요청 시점에만 실행
  await connection();

  const today = seoulTodayKey();

  // WOD 조회와 관리자 확인을 동시에 시작 (관리자면 수정·등록 버튼을 보여주기 위해)
  const adminPromise = getAdminIfSignedIn();

  let wods: Wod[] | null = null;
  try {
    wods = await getWods(today, today);
  } catch (error) {
    // 조회에 실패해도 홈 화면은 그대로 보여주고, 원인은 서버 로그에만 남깁니다.
    console.error("[home] 오늘의 WOD를 불러오지 못했습니다.", error);
  }
  const isAdmin = (await adminPromise) !== null;

  if (wods === null) {
    return (
      <p role="alert" className="rounded-lg bg-background p-6 text-muted">
        오늘의 WOD를 불러오지 못했습니다. <Link href="/wod" className="font-bold underline">WOD 달력</Link>에서
        다시 확인해 주세요.
      </p>
    );
  }

  // 달력의 상세 카드를 그대로 재사용합니다. (날짜 제목, WOD 카드, 휴무/없음 안내, 관리자 버튼까지 같음)
  return <WodDetail date={today} wods={wods} isAdmin={isAdmin} />;
}
