"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "@/app/auth/password-actions";

const inputClass = "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);

  if (state?.status === "sent") {
    return (
      <div role="status" className="rounded-md border border-line bg-surface p-5">
        <p className="font-bold">재설정 메일을 보냈습니다.</p>
        <p className="mt-2 text-sm text-muted">
          {state.email}로 가입된 계정이 있으면 비밀번호를 바꿀 수 있는 링크가 담긴 메일이 도착합니다. 메일이 보이지
          않으면 스팸함도 확인해 주세요. 링크는 한 번만, 잠시 동안만 사용할 수 있습니다.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-bold text-accent">
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-bold">
          가입한 이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state?.email}
          className={inputClass}
        />
      </div>

      {state?.status === "error" && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "보내는 중…" : "재설정 메일 받기"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-bold text-accent">
          로그인으로 돌아가기
        </Link>
      </p>
    </form>
  );
}
