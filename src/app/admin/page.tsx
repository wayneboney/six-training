import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth/admin";

// /admin = 관리자 첫 화면
// (WOD 목록은 다음 단계 6-4에서 이 화면에 추가합니다)
export default function AdminHomePage() {
  return (
    <Suspense fallback={<p className="text-muted">확인 중…</p>}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  // 관리자 화면은 로그인한 사람마다 내용이 달라서 미리 만들어 둘 수 없습니다.
  // connection() = "방문자가 요청했을 때만 실행"하라는 표시 (링크 미리 불러오기 단계에서는 실행하지 않음)
  await connection();

  // 관리자가 아니면 여기서 로그인 화면으로 이동하고, 아래 코드는 실행되지 않습니다.
  const admin = await requireAdmin();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-widest text-accent">ADMIN</p>
          <h1 className="mt-1 text-2xl font-black">{admin.name}님, 안녕하세요</h1>
          <p className="mt-1 text-sm text-muted">{admin.email}</p>
        </div>

        {/* 로그아웃: 폼 제출로 서버의 logout 함수를 실행합니다 (자바스크립트 없이도 동작) */}
        <form action={logout}>
          <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-bold hover:bg-surface">
            로그아웃
          </button>
        </form>
      </div>

      <div className="mt-10 rounded-lg bg-surface p-6 text-muted">WOD 관리 화면은 다음 단계에서 추가됩니다.</div>
    </div>
  );
}
