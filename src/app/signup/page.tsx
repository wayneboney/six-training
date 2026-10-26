import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import SignupForm from "@/components/auth/SignupForm";
import { getMemberIfSignedIn } from "@/lib/auth/member";

export const metadata: Metadata = {
  title: "회원가입",
};

// /signup
export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-black">회원가입</h1>
      <p className="mt-2 text-sm text-muted">가입 후 코치가 승인하면 수업 예약을 할 수 있습니다.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <SignupGate />
        </Suspense>
      </div>
    </div>
  );
}

// 이미 로그인한 사람이 들어오면 가입 폼 대신 내 정보로 보냅니다.
async function SignupGate() {
  await connection();
  if (await getMemberIfSignedIn()) {
    redirect("/me");
  }
  return <SignupForm />;
}
