// 브라우저 기본 확인창(window.confirm) 대신 쓰는 확인 팝업. 화면 가운데에 뜨고 배경이 어두워집니다.
// <dialog>의 showModal()을 쓰면 Esc 키 닫기와 포커스 가두기를 브라우저가 처리해 줍니다.
// 사용법: open(열림 여부)을 부모가 들고 있다가, 확인/취소 때 바꿉니다. (MemberActionForm, LogoutButton 참고)
"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string; // 줄바꿈(\n)은 그대로 보입니다.
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "확인",
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // open 값에 맞춰 팝업을 열고 닫습니다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      // Esc 키로 닫힐 때도 부모의 취소 처리를 부릅니다.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // 어두운 배경(dialog 자신)을 누르면 취소. 안쪽 내용을 눌렀을 때는 target이 안쪽 요소라서 닫히지 않음
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-black">
          {title}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{message}</p>
        {/* 취소를 앞에 두어서 처음 포커스가 취소 버튼에 갑니다. (Enter 키로 실수로 확인되는 것을 방지) */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-sm font-bold hover:bg-surface"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
