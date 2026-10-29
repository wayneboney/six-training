import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { createWodAction } from "@/app/admin/programs/actions";
import WodForm from "@/components/admin/WodForm";
import { requireAdmin } from "@/lib/auth/admin";
import { seoulTodayKey } from "@/lib/date";
import { isValidDateKey } from "@/lib/wods/validation";

export const metadata: Metadata = {
  title: "프로그램 등록",
};

// /admin/programs/new = 프로그램 등록 화면
// /admin/programs/new?date=2026-10-28 처럼 날짜를 주면 그 날짜가 미리 채워집니다.
export default function NewWodPage(props: PageProps<"/admin/programs/new">) {
  return (
    <div>
      <h1 className="text-2xl font-black">프로그램 등록</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <NewWod searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function NewWod({ searchParams }: { searchParams: PageProps<"/admin/programs/new">["searchParams"] }) {
  await connection();
  await requireAdmin();

  // 주소의 날짜가 올바르면 그 날짜, 아니면 오늘(한국 시간)
  const { date } = await searchParams;
  const initialDate = typeof date === "string" && isValidDateKey(date) ? date : seoulTodayKey();

  return (
    <WodForm
      action={createWodAction}
      initialValues={{ date: initialDate, type: "CROSSFIT", title: "", format: "", movements: "", note: "" }}
      submitLabel="등록"
      cancelHref={`/admin/programs?month=${initialDate.slice(0, 7)}`}
    />
  );
}
