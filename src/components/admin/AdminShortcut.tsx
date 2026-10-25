import Link from "next/link";
import { connection } from "next/server";
import { getAdminIfSignedIn } from "@/lib/auth/admin";

// 헤더의 "관리자" 버튼. 관리자로 로그인한 사람에게만 보입니다. (일반 방문자에게는 아무것도 그리지 않음)
// 로그인 여부는 요청마다 다르므로, Header에서 <Suspense>로 감싸서 이 부분만 요청 시점에 채워 넣습니다.
// 나머지 헤더(로고, 메뉴)는 미리 만들어 둔 그대로 빠르게 나갑니다.
export default async function AdminShortcut() {
  // 요청 시점에만 실행 (링크 미리 불러오기 단계에서는 실행하지 않음)
  await connection();

  const admin = await getAdminIfSignedIn();
  if (!admin) {
    return null;
  }
  return (
    <Link
      href="/admin"
      className="rounded-md bg-accent px-3 py-1 text-sm font-bold text-white hover:opacity-90"
    >
      관리자
    </Link>
  );
}
