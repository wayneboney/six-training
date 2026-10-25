import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { deleteWodAction, updateWodAction } from "@/app/admin/wods/actions";
import DeleteWodButton from "@/components/admin/DeleteWodButton";
import WodForm from "@/components/admin/WodForm";
import { wodTypeLabels } from "@/data/wods";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateKey } from "@/lib/date";
import { getWodById } from "@/lib/wods/admin-repository";
import { parseWodId, wodToFormValues } from "@/lib/wods/validation";

export const metadata: Metadata = {
  title: "WOD 수정",
};

// /admin/wods/123 = id가 123인 WOD 수정 화면
// [id] 폴더 이름의 대괄호 = 주소의 그 자리 값을 params.id로 받는다는 뜻 (Spring의 @PathVariable)
export default function EditWodPage(props: PageProps<"/admin/wods/[id]">) {
  return (
    <div>
      <h1 className="text-2xl font-black">WOD 수정</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <EditWod params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function EditWod({ params }: { params: PageProps<"/admin/wods/[id]">["params"] }) {
  await connection();
  await requireAdmin();

  // 주소의 id가 숫자가 아니면 404
  const { id } = await params;
  const wodId = parseWodId(id);
  if (wodId === null) {
    notFound();
  }

  // 없는 WOD(이미 삭제됨 등)도 404
  const wod = await getWodById(wodId);
  if (!wod) {
    notFound();
  }

  return (
    <>
      <WodForm
        // bind = 함수에 첫 번째 인자(id)를 미리 붙여 둔 새 함수를 만듭니다. 폼이 제출되면 updateWodAction(id, ...)이 실행됩니다.
        action={updateWodAction.bind(null, wod.id)}
        initialValues={wodToFormValues(wod)}
        submitLabel="수정 저장"
        cancelHref={`/admin?month=${wod.date.slice(0, 7)}`}
      />

      {/* 삭제는 실수로 누르지 않도록 목록이 아니라 수정 화면 맨 아래에만 둡니다 */}
      <DeleteWodButton
        action={deleteWodAction.bind(null, wod.id)}
        wodLabel={`${formatDateKey(wod.date)} ${wodTypeLabels[wod.type]} · ${wod.title}`}
      />
    </>
  );
}
