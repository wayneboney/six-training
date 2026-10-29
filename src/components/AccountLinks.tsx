import Link from "next/link";
import Avatar from "@/components/Avatar";
import LogoutButton from "@/components/LogoutButton";
import PowerIcon from "@/components/PowerIcon";
import { connection } from "next/server";
import { getMemberIfSignedIn } from "@/lib/auth/member";

// 헤더 오른쪽의 계정 링크. 로그인 여부는 요청마다 다르므로 Header에서 <Suspense>로 감싸 이 부분만 요청 시점에 채웁니다.
//   로그인 안 함 → 전원 버튼 모양 [로그인]
//   로그인 함   → [프로필 사진] "OOO님 환영합니다" (누르면 내 정보) + 전원 버튼 모양 [로그아웃]. 관리자는 [관리자] 버튼도
export default async function AccountLinks() {
  await connection();
  const member = await getMemberIfSignedIn();

  if (!member) {
    return (
      // 전원 버튼 모양. 눌러서 로그인 화면으로 이동합니다.
      <Link
        href="/login"
        title="로그인"
        aria-label="로그인"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-accent text-accent hover:bg-accent hover:text-white"
      >
        <PowerIcon />
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {member.role === "admin" && (
        <Link
          href="/admin/programs"
          className="rounded-md bg-accent px-3 py-1 text-sm font-bold text-white hover:opacity-90"
        >
          관리자
        </Link>
      )}
      {/* 프로필 사진 + 이름. 누르면 내 정보(/me)로 이동합니다. 이름이 길면 …으로 줄이고, 좁은 화면(모바일)에서는 "님"까지만 보여줍니다. */}
      <Link
        href="/me"
        title="내 정보"
        aria-label={`${member.name}님, 내 정보로 이동`}
        className="flex items-center gap-2 hover:opacity-80 sm:border-l sm:border-line sm:pl-4"
      >
        <Avatar url={member.avatarUrl} name={member.name} size={32} />
        <span className="max-w-[5rem] truncate text-sm font-bold sm:max-w-[12rem]">
          {member.name}님<span className="hidden font-normal text-muted sm:inline"> 환영합니다</span>
        </span>
      </Link>
      {/* 로그아웃 전원 버튼: 누르면 확인 팝업이 먼저 뜹니다 */}
      <LogoutButton />
    </div>
  );
}
