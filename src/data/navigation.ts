// 메뉴 목록. PC 메뉴(Header)와 모바일 메뉴(MobileMenu)가 같이 씁니다.
// 메뉴를 추가하려면 이 배열에 한 줄만 추가하면 됩니다.
// 주의: 아직 만들지 않은 페이지를 넣으면 404가 나므로, 페이지를 만든 뒤에 추가합니다.
// memberOnly: true = 로그인한 사람에게만 보이는 메뉴. (주소로 직접 들어와도 로그인 화면으로 보냅니다: proxy.ts, 각 페이지)
export type NavItem = { href: string; label: string; memberOnly?: boolean };

export const navItems: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/about", label: "체육관 소개" },
  { href: "/wod", label: "WOD", memberOnly: true },
  { href: "/reserve", label: "수업 예약", memberOnly: true },
];

// 로그인하지 않은 사람에게 보여줄 메뉴
export const publicNavItems: NavItem[] = navItems.filter((item) => !item.memberOnly);
