"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";

// 관리자 화면 위쪽 메뉴 + 로그아웃. (현재 주소를 알아야 해서 브라우저에서 실행되는 컴포넌트)
// 메뉴가 늘어나면 배열에 한 줄만 추가합니다.
const adminMenus = [
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/wods", label: "WOD 관리" },
];

export default function AdminNav() {
  // 로그인 화면에는 메뉴와 로그아웃 버튼이 필요 없으므로 숨깁니다.
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return null;
  }

  return (
    <nav aria-label="관리자 메뉴" className="mb-8 flex items-center justify-between gap-2 border-b border-line pb-3">
      <div className="flex gap-2">
        {adminMenus.map((menu) => (
          <Link key={menu.href} href={menu.href} className="rounded-md px-3 py-1.5 text-sm font-bold hover:bg-surface">
            {menu.label}
          </Link>
        ))}
      </div>
      {/* 로그아웃: 폼 제출로 서버의 logout 함수를 실행합니다 */}
      <form action={logout}>
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm font-bold hover:bg-surface">
          로그아웃
        </button>
      </form>
    </nav>
  );
}
