import Link from "next/link";
import { connection } from "next/server";
import { getMemberIfSignedIn } from "@/lib/auth/member";

// 헤더 오른쪽의 계정 링크. 로그인 여부는 요청마다 다르므로 Header에서 <Suspense>로 감싸 이 부분만 요청 시점에 채웁니다.
//   로그인 안 함 → [로그인]   /  일반회원 → [내 정보]   /  관리자 → [관리자] [내 정보]
export default async function AccountLinks() {
  await connection();
  const member = await getMemberIfSignedIn();

  if (!member) {
    return (
      <Link href="/login" className="text-sm text-muted hover:text-foreground">
        로그인
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {member.role === "admin" && (
        <Link
          href="/admin"
          className="rounded-md bg-accent px-3 py-1 text-sm font-bold text-white hover:opacity-90"
        >
          관리자
        </Link>
      )}
      <Link href="/me" className="text-sm text-muted hover:text-foreground">
        내 정보
      </Link>
    </div>
  );
}
