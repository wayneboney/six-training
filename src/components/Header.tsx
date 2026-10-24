import Image from "next/image";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import { gym } from "@/data/gym";
import { navItems } from "@/data/navigation";

// Header = 모든 페이지 맨 위에 나오는 로고 + 메뉴
// 이 컴포넌트에는 "use client"가 없어서 서버에서 HTML로 만들어집니다.
// 클릭 동작이 필요한 모바일 메뉴만 MobileMenu(클라이언트 컴포넌트)로 분리했습니다.
export default function Header() {
  return (
    // sticky top-0 = 스크롤해도 화면 위에 고정, relative = 모바일 메뉴 위치의 기준점
    <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        {/* 로고: 누르면 홈("/")으로 이동 */}
        <Link href="/" aria-label={`${gym.name} 홈으로`}>
          {/* public/logo.png 파일은 "/logo.png" 주소로 접근합니다.
              width/height = 원본 비율(345x133). 실제 크기는 className의 h-8(32px)로 맞추고 너비는 비율대로 자동 계산
              preload = 화면 맨 위에 바로 보이는 이미지라 먼저 불러오도록 지정 (Next.js 16부터 priority 대신 사용) */}
          <Image
            src="/logo.png"
            alt={gym.name}
            width={345}
            height={133}
            preload
            className="h-8 w-auto"
          />
        </Link>

        {/* PC 메뉴: hidden = 기본 숨김, sm:flex = 640px 이상에서만 보임 */}
        <nav className="hidden gap-6 text-sm text-muted sm:flex">
          {navItems.map((item) => (
            // key = 반복으로 만든 항목마다 붙이는 고유값 (React가 항목을 구분하는 데 사용)
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 모바일 메뉴: 640px 미만에서만 보임 */}
        <MobileMenu />
      </div>
    </header>
  );
}
