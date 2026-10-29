import { Suspense } from "react";
import { connection } from "next/server";
import AccountLinks from "@/components/AccountLinks";
import MobileMenu from "@/components/MobileMenu";
import NavLink from "@/components/NavLink";
import { navItems, publicNavItems, type NavItem } from "@/data/navigation";
import { getMemberIfSignedIn, hasContentAccess } from "@/lib/auth/member";

// 헤더 오른쪽 전체(PC 메뉴 + 계정 링크 + 모바일 메뉴).
// 로그인 여부에 따라 메뉴가 달라지므로 요청 시점에 채웁니다. Header에서 <Suspense>로 감싸서 쓰세요.
// 채우는 동안(fallback)에는 로그인 없이도 볼 수 있는 메뉴만 보여줘서, 로그인 전용 메뉴가 잠깐 보였다 사라지는 일이 없습니다.

function DesktopNav({ items }: { items: NavItem[] }) {
  // hidden = 기본 숨김, sm:flex = 640px 이상에서만 보임
  return (
    <nav className="hidden items-center gap-6 text-sm sm:flex">
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  );
}

export function HeaderMenusFallback() {
  return (
    <>
      <DesktopNav items={publicNavItems} />
      <MobileMenu items={publicNavItems} />
    </>
  );
}

export default async function HeaderMenus() {
  await connection();
  // Program, 수업 예약 메뉴는 회원권이 유효한 회원(과 관리자)에게만 보입니다.
  const member = await getMemberIfSignedIn();
  const canView = member !== null && (await hasContentAccess(member.userId));
  const items = canView ? navItems : publicNavItems;

  return (
    <>
      <DesktopNav items={items} />
      {/* 계정 링크: 로그인 전 [로그인], 로그인 후 [내 정보] (관리자는 [관리자]도) */}
      <Suspense fallback={null}>
        <AccountLinks />
      </Suspense>
      <MobileMenu items={items} />
    </>
  );
}
