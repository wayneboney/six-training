// 회원 관리의 작은 폼(회원권 등록, 홀딩, 일수 추가 등)이 같이 쓰는 공통 틀.
// 서버 함수(action)를 실행하고, 처리 중 표시와 성공/실패 메시지를 보여줍니다.
"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { MemberActionState } from "@/app/admin/members/actions";
import ConfirmDialog from "@/components/ConfirmDialog";

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
  // "contents": 폼 자체는 모양이 없고 안의 요소들이 바깥 상자(flex)에 바로 놓임. 서로 다른 폼의 버튼을 한 줄에 나란히 놓을 때 (시간표 수업 줄)
  layout?: "stack" | "inline" | "contents";
  children?: ReactNode; // 입력칸들
};

const TOAST_MILLIS = 5000;

export default function MemberActionForm({
  action,
  submitLabel,
  pendingLabel,
  confirmMessage,
  modes,
  layout = "stack",
  children,
}: MemberActionFormProps) {
  // 마지막으로 제출한 입력값. React는 제출이 끝나면 입력칸을 비우는데, 실패했을 때는 사용자가 다시 입력하지 않도록 아래에서 되돌려 놓습니다.
  const lastSubmitted = useRef<FormData | null>(null);
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(async (prev, formData) => {
    lastSubmitted.current = formData;
    return action(prev, formData);
  }, undefined);

  // 성공 메시지는 화면 아래에 잠깐 떴다가 5초 뒤 저절로 사라지는 알림(toast)으로 보여줍니다.
  // 처리 결과(state)는 제출할 때마다 새 객체라서, "이미 닫은 결과"를 기억해 두고 그것과 같으면 숨깁니다.
  // 오류 메시지는 다시 확인할 수 있도록 폼 아래에 계속 남겨 둡니다.
  const [dismissed, setDismissed] = useState<MemberActionState>(undefined);
  // 확인 팝업: 확인이 필요한 버튼을 누르면 제출을 잠시 멈추고 팝업을 띄웁니다. "확인"을 누르면 같은 버튼을 누른 것처럼 다시 제출합니다.
  const formRef = useRef<HTMLFormElement>(null);
  const pendingSubmitter = useRef<HTMLButtonElement | null>(null); // 팝업이 뜨기 전에 누른 버튼
  const confirmed = useRef(false); // 확인을 마친 제출이면 팝업을 다시 띄우지 않음
  const [asking, setAsking] = useState<{ message: string; label: string } | null>(null);

  // 실패하면 입력했던 값을 입력칸에 다시 채웁니다. (글자, 시간, 숫자, 날짜, 선택 상자. 체크/라디오는 제외)
  useEffect(() => {
    const form = formRef.current;
    if (!state || state.ok || !form || !lastSubmitted.current) {
      return;
    }
    for (const [name, value] of lastSubmitted.current.entries()) {
      const field = form.elements.namedItem(name);
      if (typeof value !== "string") {
        continue;
      }
      if (field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        field.value = value;
      } else if (field instanceof HTMLInputElement && !["checkbox", "radio", "file", "hidden", "password"].includes(field.type)) {
        field.value = value;
      }
    }
  }, [state]);

  const toastVisible = state?.ok === true && dismissed !== state;
  useEffect(() => {
    if (state?.ok !== true) {
      return;
    }
    const timer = setTimeout(() => setDismissed(state), TOAST_MILLIS);
    return () => clearTimeout(timer); // 5초 전에 새로 제출하면 이전 타이머는 취소
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        if (confirmed.current) {
          confirmed.current = false; // 확인 팝업을 거친 제출 → 그대로 진행
          return;
        }
        // 확인이 필요하면 제출을 막고 팝업을 띄웁니다. (버튼이 여러 개면 누른 버튼의 확인 문구를 씁니다)
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const mode = modes?.find((m) => m.value === submitter?.value);
        const message = modes ? mode?.confirmMessage : confirmMessage;
        if (message) {
          event.preventDefault();
          pendingSubmitter.current = submitter;
          setAsking({ message, label: mode?.label ?? submitLabel });
        }
      }}
      className={layout === "inline" ? "flex flex-wrap items-center gap-2" : layout === "contents" ? "contents" : "space-y-3"}
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

      {/* 실패: 폼 아래에 계속 표시 */}
      {state && !state.ok && (
        <p role="alert" className="w-full rounded-md bg-accent-soft px-3 py-2 text-sm font-bold text-accent">
          {state.message}
        </p>
      )}

      {/* 성공: 화면 아래 가운데에 5초 동안 표시. role="status" = 화면 낭독기가 읽어 줌 */}
      {toastVisible && state && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-3 text-sm font-bold text-background shadow-lg"
        >
          <span>✅ {state.message}</span>
          <button
            type="button"
            onClick={() => setDismissed(state)}
            aria-label="알림 닫기"
            className="shrink-0 text-background/70 hover:text-background"
          >
            ✕
          </button>
        </div>
      )}

      <ConfirmDialog
        open={asking !== null}
        title={asking?.label ?? "확인"}
        message={asking?.message ?? ""}
        confirmLabel={asking?.label ?? "확인"}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          setAsking(null);
          confirmed.current = true;
          formRef.current?.requestSubmit(pendingSubmitter.current ?? undefined);
        }}
      />
    </form>
  );
}
