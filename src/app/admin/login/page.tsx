import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LoginForm from "@/components/admin/LoginForm";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "로그인",
};

// /admin/login
export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-black">관리자 로그인</h1>
      <p className="mt-2 text-sm text-muted">코치 계정으로 로그인해 주세요.</p>
      <div className="mt-8">
        {/* 로그인 여부는 요청할 때마다 쿠키를 읽어야 알 수 있어서 Suspense로 감쌉니다 */}
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <LoginGate />
        </Suspense>
      </div>
    </div>
  );
}

// 이미 관리자로 로그인돼 있으면 로그인 폼 대신 관리자 화면으로 보냅니다.
async function LoginGate() {
  // 로그인 여부는 요청할 때마다 달라서 미리 만들어 둘 수 없으므로 요청 시점에만 실행
  await connection();
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/admin/wods");
  }
  return <LoginForm />;
}
