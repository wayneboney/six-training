"use client";

import { useActionState } from "react";
import { updatePassword, type ResetState } from "@/app/auth/password-actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/validation";

const inputClass = "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none";

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(updatePassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-bold">
          새 비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">{PASSWORD_MIN}자 이상</p>
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-bold">
          새 비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
