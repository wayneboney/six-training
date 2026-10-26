// 회원 관리의 작은 폼(회원권 등록, 홀딩, 일수 추가 등)이 같이 쓰는 공통 틀.
// 서버 함수(action)를 실행하고, 처리 중 표시와 성공/실패 메시지를 보여줍니다.
"use client";

import { useActionState, type ReactNode } from "react";
import type { MemberActionState } from "@/app/admin/members/actions";

type MemberActionFormProps = {
  // 서버 함수. 폼이 제출되면 (이전 상태, 입력값)을 받아 실행됩니다.
  action: (prev: MemberActionState, formData: FormData) => Promise<MemberActionState>;
  submitLabel: string;
  pendingLabel: string;
  // 값이 있으면 제출 전에 브라우저 확인창("정말 …할까요?")을 띄웁니다.
  confirmMessage?: string;
  // 버튼이 둘 이상일 때(예: 추가 / 차감). 누른 버튼의 value가 폼 값 "mode"로 서버에 전달됩니다.
  modes?: { value: string; label: string; confirmMessage?: string; outline?: boolean }[];
  // "inline": 입력칸 + 버튼을 한 줄에 (홀딩 취소처럼 입력칸이 없는 경우), 기본은 세로로 쌓임
  layout?: "stack" | "inline";
  children?: ReactNode; // 입력칸들
};

export default function MemberActionForm({
  action,
  submitLabel,
  pendingLabel,
  confirmMessage,
  modes,
  layout = "stack",
  children,
}: MemberActionFormProps) {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // 확인창에서 취소하면 제출을 막습니다. (버튼이 여러 개면 누른 버튼의 확인 문구를 씁니다)
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const message = modes ? modes.find((mode) => mode.value === submitter?.value)?.confirmMessage : confirmMessage;
        if (message && !window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className={layout === "inline" ? "flex flex-wrap items-center gap-2" : "space-y-3"}
    >
      {children}

      {modes ? (
        modes.map((mode) => (
          <button
            key={mode.value}
            type="submit"
            name="mode"
            value={mode.value}
            disabled={pending}
            className={`rounded-md px-4 py-2 text-sm font-bold disabled:opacity-50 ${
              mode.outline ? "border border-line hover:bg-surface" : "bg-accent text-white hover:opacity-90"
            }`}
          >
            {pending ? pendingLabel : mode.label}
          </button>
        ))
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      )}

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-md px-3 py-2 text-sm font-bold ${state.ok ? "bg-surface" : "bg-accent-soft text-accent"}`}
        >
          {state.ok ? "✅ " : ""}
          {state.message}
        </p>
      )}
    </form>
  );
}
