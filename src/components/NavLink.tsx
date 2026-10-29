// 메뉴 링크 하나. 지금 보고 있는 페이지의 메뉴는 굵은 글씨 + 포인트 색 + 밑줄로 눈에 띄게 보여줍니다.
// (현재 주소를 알아야 해서 브라우저에서 실행되는 컴포넌트)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type NavLinkProps = {
  href: string;
  label: string;
  variant?: "desktop" | "mobile";
  onClick?: () => void; // 모바일 메뉴에서 누르면 메뉴를 닫을 때 사용
};

// "/"는 정확히 "/"일 때만, 나머지는 그 아래 주소(예: /reserve?date=... , /about/...)도 같은 메뉴로 봅니다.
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function linkClass(variant: "desktop" | "mobile", active: boolean): string {
  return variant === "desktop"
    ? `border-b-2 pb-1 ${
        active
          ? "border-accent font-bold text-accent"
          : "border-transparent text-muted hover:border-line hover:text-foreground"
      }`
    : `block border-l-4 py-3 pl-3 ${
        active ? "border-accent font-bold text-accent" : "border-transparent hover:text-accent"
      }`;
}

function ActiveLink({ href, label, variant = "desktop", onClick }: NavLinkProps) {
  const active = isActive(usePathname(), href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} onClick={onClick} className={linkClass(variant, active)}>
      {label}
    </Link>
  );
}

// 현재 주소는 요청 시점에 정해지는 경우(예: /admin/members/[id])가 있어서 <Suspense>로 감쌉니다.
// 주소를 알기 전(fallback)에는 강조 없는 평범한 링크로 보여줍니다.
export default function NavLink(props: NavLinkProps) {
  const { href, label, variant = "desktop", onClick } = props;
  return (
    <Suspense
      fallback={
        <Link href={href} onClick={onClick} className={linkClass(variant, false)}>
          {label}
        </Link>
      }
    >
      <ActiveLink {...props} />
    </Suspense>
  );
}
