import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PASSWORD_RESET_ENABLED } from "@/lib/auth/features";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  robots: { index: false, follow: false },
};

// /forgot-password  (?error=link → 재설정 링크가 만료/사용된 경우)
export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  // 비밀번호 찾기를 쓰지 않는 동안에는 없는 페이지로 처리합니다. (src/lib/auth/features.ts)
  if (!PASSWORD_RESET_ENABLED) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-black">비밀번호 찾기</h1>
      <p className="mt-2 text-sm text-muted">가입한 이메일로 비밀번호를 바꿀 수 있는 링크를 보내 드립니다.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <Notice searchParams={searchParams} />
        </Suspense>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

// searchParams는 요청할 때만 알 수 있어서 Suspense 안에서 읽습니다.
async function Notice({ searchParams }: { searchParams: PageProps<"/forgot-password">["searchParams"] }) {
  const query = await searchParams;
  if (query.error !== "link") {
    return null;
  }
  return (
    <p role="alert" className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
      링크가 만료되었거나 이미 사용되었습니다. 메일을 다시 받아 주세요.
    </p>
  );
}
