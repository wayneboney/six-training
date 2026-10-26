import Link from "next/link";
import { connection } from "next/server";
import { getMemberIfSignedIn } from "@/lib/auth/member";

// 헤더 오른쪽의 계정 링크. 로그인 여부는 요청마다 다르므로 Header에서 <Suspense>로 감싸 이 부분만 요청 시점에 채웁니다.
//   로그인 안 함 → [로그인]
//   로그인 함   → "OOO님 환영합니다" + [내 정보] (관리자는 [관리자]도)
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
      {/* 누가 로그인했는지 표시. 이름이 길면 …으로 줄이고, 좁은 화면(모바일)에서는 "님"까지만 보여줍니다. */}
      <span className="max-w-[7rem] truncate text-sm font-bold sm:max-w-[12rem] sm:border-l sm:border-line sm:pl-4" title={`${member.name}님`}>
        {member.name}님<span className="hidden font-normal text-muted sm:inline"> 환영합니다</span>
      </span>
    </div>
  );
}
