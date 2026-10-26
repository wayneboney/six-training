import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import MemberLoginForm from "@/components/auth/MemberLoginForm";
import { getMemberIfSignedIn } from "@/lib/auth/member";

export const metadata: Metadata = {
  title: "로그인",
};

// /login  (?error=link → 인증 메일 링크가 만료/사용된 경우)
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-black">로그인</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">확인 중…</p>}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginGate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  // searchParams(주소의 ?뒤 값)와 로그인 쿠키는 요청할 때마다 달라서 요청 시점에만 읽을 수 있습니다.
  const query = await searchParams;
  // 이미 로그인한 사람이 들어오면 로그인 폼 대신 홈으로 보냅니다.
  if (await getMemberIfSignedIn()) {
    redirect("/");
  }
  return (
    <>
      {query.error === "link" && (
        <p role="alert" className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          인증 링크가 만료되었거나 이미 사용되었습니다. 로그인해 보시고, 안 되면 다시 가입해 주세요.
        </p>
      )}
      <MemberLoginForm />
    </>
  );
}
