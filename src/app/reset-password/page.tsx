import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PASSWORD_RESET_ENABLED } from "@/lib/auth/features";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { createAuthSupabase } from "@/lib/supabase/auth";
import PageBanner from "@/components/PageBanner";

export const metadata: Metadata = {
  title: "새 비밀번호 설정",
  robots: { index: false, follow: false },
};

// /reset-password  (메일 링크를 눌러 임시 로그인이 된 사람만 사용)
export default function ResetPasswordPage() {
  // 비밀번호 찾기를 쓰지 않는 동안에는 없는 페이지로 처리합니다. (src/lib/auth/features.ts)
  if (!PASSWORD_RESET_ENABLED) {
    notFound();
  }
  return (
    <>
      <PageBanner eyebrow="PASSWORD" title="새 비밀번호 설정" />
      <div className="mx-auto w-full max-w-sm px-4 py-12">
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <ResetGate />
        </Suspense>
      </div>
    </>
  );
}

async function ResetGate() {
  await connection();
  const supabase = await createAuthSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?error=link");
  }
  return <ResetPasswordForm />;
}
