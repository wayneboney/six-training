"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";
import PowerIcon from "@/components/PowerIcon";

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
        {adminMenus.map((menu) => {
          // 현재 화면이 이 메뉴 아래에 있으면 선택된 메뉴로 표시 (예: /admin/members/123 → 회원 관리)
          const active = pathname === menu.href || pathname.startsWith(`${menu.href}/`);
          return (
            <Link
              key={menu.href}
              href={menu.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 text-sm font-bold ${
                active ? "bg-accent text-white" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {menu.label}
            </Link>
          );
        })}
      </div>
      {/* 로그아웃: 폼 제출로 서버의 logout 함수를 실행합니다. 헤더와 같은 전원 버튼 모양 */}
      <form action={logout}>
        <button
          type="submit"
          title="로그아웃"
          aria-label="로그아웃"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
        >
          <PowerIcon />
        </button>
      </form>
    </nav>
  );
}
