// 메뉴 목록. PC 메뉴(Header)와 모바일 메뉴(MobileMenu)가 같이 씁니다.
// 메뉴를 추가하려면 이 배열에 한 줄만 추가하면 됩니다.
// 주의: 아직 만들지 않은 페이지를 넣으면 404가 나므로, 페이지를 만든 뒤에 추가합니다.
// memberOnly: true = 회원권이 유효한 회원(과 관리자)에게만 보이는 메뉴. (주소로 직접 들어와도 막습니다: proxy.ts, 각 페이지, DB 규칙)
export type NavItem = { href: string; label: string; memberOnly?: boolean };

export const navItems: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/about", label: "박스 소개" },
  { href: "/wod", label: "WOD", memberOnly: true },
  { href: "/reserve", label: "수업 예약", memberOnly: true },
];

// 누구나 볼 수 있는 메뉴
export const publicNavItems: NavItem[] = navItems.filter((item) => !item.memberOnly);
