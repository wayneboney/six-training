// WOD 삭제 버튼 + 확인 단계
// "삭제" → "정말 삭제할까요?" → "삭제하기"를 눌러야 실제로 지워집니다. (되돌릴 수 없는 작업이라 실수 방지)
"use client";

import { useActionState, useState } from "react";
import type { WodDeleteState } from "@/app/admin/wods/actions";

type DeleteWodButtonProps = {
  // 삭제 서버 함수 (deleteWodAction.bind(null, id))
  action: () => Promise<WodDeleteState>;
  wodLabel: string; // 확인 문구에 보여줄 이름 (예: "10월 27일 (화) HYROX · Station Practice")
};

export default function DeleteWodButton({ action, wodLabel }: DeleteWodButtonProps) {
  // 확인 단계를 보여주는 중인지 (화면 안에서만 쓰는 상태)
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <section className="mt-12 rounded-lg border border-accent/40 p-6">
      <h2 className="font-bold text-accent">WOD 삭제</h2>
      <p className="mt-1 text-sm text-muted">삭제한 WOD는 되돌릴 수 없습니다.</p>

      {state?.error && (
        <p role="alert" className="mt-4 rounded-md bg-accent-soft px-4 py-3 text-sm font-bold text-accent">
          {state.error}
        </p>
      )}

      {!confirming ? (
        // 1단계: 삭제 버튼 (아직 지우지 않음, 확인 단계만 보여줌)
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-soft"
        >
          삭제
        </button>
      ) : (
        // 2단계: 확인. 여기서 "삭제하기"를 눌러야 서버에서 실제로 지웁니다.
        <form action={formAction} className="mt-4 rounded-md bg-accent-soft p-4">
          <p className="text-sm font-bold">정말 삭제할까요?</p>
          <p className="mt-1 text-sm">{wodLabel}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "삭제 중…" : "삭제하기"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line bg-background px-4 py-2 text-sm font-bold hover:bg-surface"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
