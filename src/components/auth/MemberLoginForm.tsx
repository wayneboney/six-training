"use client";

import Link from "next/link";
import { useActionState } from "react";
import { memberLogin, type MemberLoginState } from "@/app/auth/actions";

const inputClass = "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none";

export default function MemberLoginForm() {
  const [state, formAction, pending] = useActionState<MemberLoginState, FormData>(memberLogin, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-bold">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state?.email}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-bold">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
        {pending ? "로그인 중…" : "로그인"}
      </button>

      <p className="text-center text-sm text-muted">
        아직 회원이 아니신가요?{" "}
        <Link href="/signup" className="font-bold text-accent">
          회원가입
        </Link>
      </p>
    </form>
  );
}
