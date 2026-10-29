// Program 삭제 버튼 + 확인 팝업
// "삭제"를 누르면 화면 가운데에 "삭제할까요?" 팝업이 뜨고, 팝업에서 "삭제"를 눌러야 실제로 지워집니다. (되돌릴 수 없는 작업이라 실수 방지)
// 수정 화면(panel: 큰 상자)과 목록(inline: 한 줄 안의 작은 버튼)에서 같이 씁니다.
// 화면 모양만 다르고, 확인 팝업(ConfirmDialog)과 서버 삭제 함수는 같습니다.
"use client";

import { useActionState, useRef, useState } from "react";
import type { WodDeleteState } from "@/app/admin/programs/actions";
import ConfirmDialog from "@/components/ConfirmDialog";

type DeleteWodButtonProps = {
  // 삭제 서버 함수 (deleteWodAction.bind(null, id))
  action: () => Promise<WodDeleteState>;
  wodLabel: string; // 확인 문구에 보여줄 이름 (예: "10월 27일 (화) HYROX · Station Practice")
  variant?: "panel" | "inline";
};

export default function DeleteWodButton({ action, wodLabel, variant = "panel" }: DeleteWodButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // 확인 팝업을 보여주는 중인지 (화면 안에서만 쓰는 상태)
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);

  const errorMessage = state?.error && (
    <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm font-bold text-accent">
      {state.error}
    </p>
  );

  // 눈에 보이지 않는 폼. 팝업에서 "삭제"를 누르면 이 폼을 제출해서 서버 함수를 실행합니다.
  const hiddenForm = <form ref={formRef} action={formAction} />;

  const dialog = (
    <ConfirmDialog
      open={asking}
      title="Program 삭제"
      message={`${wodLabel}\n이 Program을 삭제할까요? 삭제한 Program은 되돌릴 수 없습니다.`}
      confirmLabel="삭제"
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        formRef.current?.requestSubmit();
      }}
    />
  );

  // ---------- 목록용: 한 줄 안의 작은 버튼 ----------
  if (variant === "inline") {
    return (
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(true)}
          aria-label={`${wodLabel} 삭제`}
          className="rounded-md border border-line px-3 py-1 text-sm font-bold text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          {pending ? "삭제 중…" : "삭제"}
        </button>
        {errorMessage}
        {hiddenForm}
        {dialog}
      </div>
    );
  }

  // ---------- 수정 화면용: 큰 상자 ----------
  return (
    <section className="mt-12 space-y-4 rounded-lg border border-accent/40 p-6">
      <div>
        <h2 className="font-bold text-accent">Program 삭제</h2>
        <p className="mt-1 text-sm text-muted">삭제한 Program은 되돌릴 수 없습니다.</p>
      </div>

      {errorMessage}

      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className="rounded-md border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-soft disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {hiddenForm}
      {dialog}
    </section>
  );
}
