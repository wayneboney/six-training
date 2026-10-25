// 입력 중 상태(제출 중, 에러 메시지)를 화면에 바로 보여줘야 해서 브라우저에서 실행되는 컴포넌트
"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions";

export default function LoginForm() {
  // useActionState = 폼 제출 → 서버의 login 실행 → 결과(state)를 받아 화면에 반영
  //   state: login이 돌려준 값 (에러 메시지 등), formAction: 폼에 연결할 함수, pending: 처리 중 여부
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, undefined);

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
          className="w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
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
          className="w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>

      {/* 에러 메시지. role="alert" = 화면 낭독기가 바로 읽어 줌 */}
      {state?.error && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.error}
        </p>
      )}

      {/* 처리 중에는 버튼을 막아서 두 번 제출되지 않게 합니다 */}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
