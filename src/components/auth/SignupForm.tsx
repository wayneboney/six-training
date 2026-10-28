// 입력 중 상태(제출 중, 에러 메시지)를 바로 보여줘야 해서 브라우저에서 실행되는 컴포넌트
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type SignupState } from "@/app/auth/actions";
import ContactFields from "@/components/auth/ContactFields";
import { formatPhone } from "@/lib/profile/contact";
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/validation";

const inputClass = "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none";

export default function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signup, undefined);

  // 인증 메일을 보낸 경우: 폼 대신 안내만 보여줍니다.
  if (state?.status === "check-email") {
    return (
      <div role="status" className="rounded-md border border-line bg-surface p-5">
        <p className="font-bold">인증 메일을 보냈습니다.</p>
        <p className="mt-2 text-sm text-muted">
          {state.email} 로 보낸 메일의 링크를 누르면 가입이 완료됩니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.
        </p>
      </div>
    );
  }

  const values = state?.status === "error" ? state : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-bold">
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={NAME_MAX}
          autoComplete="name"
          defaultValue={values?.name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-bold">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={values?.email}
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
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">{PASSWORD_MIN}자 이상</p>
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-bold">
          비밀번호 확인
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

      <ContactFields idPrefix="signup" birthDate={values?.birthDate} gender={values?.gender} phone={formatPhone(values?.phone ?? null) || values?.phone} />

      {/* 개인정보 수집·이용 동의 (개인정보 보호법): 항목, 목적, 보유기간을 알려야 합니다. */}
      <div className="rounded-md border border-line p-3 text-xs text-muted">
        <p className="font-bold text-foreground">개인정보 수집·이용 안내</p>
        <p className="mt-1">
          수집 항목: 이름, 이메일, 생년월일, 성별, 전화번호, (선택) 프로필 사진 / 목적: 회원 확인, 수업 예약·회원권 관리,
          공지 연락 / 보유 기간: 회원 탈퇴 시까지. 본인과 관리자(코치)만 볼 수 있으며, 동의하지 않으면 가입할 수 없습니다.{" "}
          <Link href="/privacy" target="_blank" className="font-bold text-accent underline">
            자세히 보기
          </Link>
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="consent" required />
          위 내용에 동의합니다.
        </label>
      </div>

      {values && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          {values.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "가입 중…" : "회원가입"}
      </button>

      <p className="text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-accent">
          로그인
        </Link>
      </p>
    </form>
  );
}
