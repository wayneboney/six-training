import Link from "next/link";

// 메뉴 목록. 메뉴를 추가하려면 이 배열에 한 줄만 추가하면 됩니다.
// (화면 코드를 고치지 않고 데이터만 바꾸는 구조)
const navItems = [
  { href: "/", label: "홈" },
  { href: "/about", label: "체육관 소개" },
];

// Header = 모든 페이지 맨 위에 나오는 로고 + 메뉴
export default function Header() {
  return (
    <header className="border-b border-gray-200">
      {/* max-w-5xl = 최대 너비 제한, mx-auto = 가운데 정렬 */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        {/* 로고: 누르면 홈("/")으로 이동 */}
        <Link href="/" className="text-xl font-black">
          SIX Training
        </Link>

        {/* 메뉴: navItems 배열을 돌면서 링크를 하나씩 만듭니다 (Java의 for-each와 같음) */}
        <nav className="flex gap-6 text-sm">
          {navItems.map((item) => (
            // key = 반복으로 만든 항목마다 붙이는 고유값 (React가 항목을 구분하는 데 사용)
            <Link key={item.href} href={item.href} className="hover:text-red-500">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
