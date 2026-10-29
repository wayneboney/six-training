// 프로그램 삭제 버튼 + 확인 단계
// "삭제" → "정말 삭제할까요?" → "삭제하기"를 눌러야 실제로 지워집니다. (되돌릴 수 없는 작업이라 실수 방지)
// 수정 화면(panel: 큰 상자)과 목록(inline: 한 줄 안의 작은 버튼)에서 같이 씁니다.
// 화면 모양만 다르고, 확인 단계와 서버 삭제 함수는 같습니다.
"use client";

import { useActionState, useState } from "react";
import type { WodDeleteState } from "@/app/admin/programs/actions";

type DeleteWodButtonProps = {
  // 삭제 서버 함수 (deleteWodAction.bind(null, id))
  action: () => Promise<WodDeleteState>;
  wodLabel: string; // 확인 문구에 보여줄 이름 (예: "10월 27일 (화) HYROX · Station Practice")
  variant?: "panel" | "inline";
};

export default function DeleteWodButton({ action, wodLabel, variant = "panel" }: DeleteWodButtonProps) {
  // 확인 단계를 보여주는 중인지 (화면 안에서만 쓰는 상태)
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);

  // 확인 단계의 버튼 두 개 (두 모양이 같이 씀)
  const confirmButtons = (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "삭제하기"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-md border border-line bg-background px-3 py-1.5 text-sm font-bold hover:bg-surface"
      >
        취소
      </button>
    </div>
  );

  const errorMessage = state?.error && (
    <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm font-bold text-accent">
      {state.error}
    </p>
  );

  // ---------- 목록용: 한 줄 안의 작은 버튼 ----------
  if (variant === "inline") {
    if (!confirming) {
      return (
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`${wodLabel} 삭제`}
            className="rounded-md border border-line px-3 py-1 text-sm font-bold text-accent hover:bg-accent-soft"
          >
            삭제
          </button>
          {errorMessage}
        </div>
      );
    }
    return (
      <form action={formAction} className="flex shrink-0 flex-col gap-2 rounded-md bg-accent-soft p-3 sm:items-end">
        {/* 목록에서는 이름이 이미 같은 줄에 보이므로 짧게 묻습니다. 화면 낭독기용으로는 전체 이름을 함께 읽어 줍니다. */}
        <p className="text-sm font-bold">
          정말 삭제할까요?<span className="sr-only"> {wodLabel}</span>
        </p>
        {confirmButtons}
        {errorMessage}
      </form>
    );
  }

  // ---------- 수정 화면용: 큰 상자 ----------
  return (
    <section className="mt-12 space-y-4 rounded-lg border border-accent/40 p-6">
      <div>
        <h2 className="font-bold text-accent">프로그램 삭제</h2>
        <p className="mt-1 text-sm text-muted">삭제한 프로그램은 되돌릴 수 없습니다.</p>
      </div>

      {errorMessage}

      {!confirming ? (
        // 1단계: 삭제 버튼 (아직 지우지 않음, 확인 단계만 보여줌)
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-soft"
        >
          삭제
        </button>
      ) : (
        // 2단계: 확인. 여기서 "삭제하기"를 눌러야 서버에서 실제로 지웁니다.
        <form action={formAction} className="space-y-3 rounded-md bg-accent-soft p-4">
          <div>
            <p className="text-sm font-bold">정말 삭제할까요?</p>
            <p className="mt-1 text-sm">{wodLabel}</p>
          </div>
          {confirmButtons}
        </form>
      )}
    </section>
  );
}
