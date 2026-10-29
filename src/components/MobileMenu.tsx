// "use client" = 이 컴포넌트는 브라우저에서 실행됩니다. (버튼 클릭 같은 동작이 필요할 때만 붙입니다)
// 붙이지 않은 컴포넌트는 서버에서 HTML로 미리 만들어져서 더 가볍고 빠릅니다.
"use client";

import { useState } from "react";
import NavLink from "@/components/NavLink";
import type { NavItem } from "@/data/navigation";

// MobileMenu = 화면이 좁을 때(모바일) 보이는 ☰ 버튼과 펼침 메뉴
export default function MobileMenu({ items }: { items: NavItem[] }) {
  // useState = 화면이 기억하는 값(상태). 이 값이 바뀌면 React가 화면을 자동으로 다시 그립니다.
  // open: 현재 값 (처음엔 false = 닫힘), setOpen: 값을 바꾸는 함수
  const [open, setOpen] = useState(false);

  return (
    // sm:hidden = 화면이 640px 이상(PC)이면 숨김
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        // aria-* = 화면 낭독기(시각 장애인용) 사용자에게 버튼 상태를 알려주는 속성
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        className="rounded-md border border-line px-3 py-1 text-lg"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* open이 true일 때만 메뉴를 그립니다. (조건 && 화면) = Java의 if (조건) { 화면 } */}
      {open && (
        <nav
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-line bg-background"
        >
          <ul className="mx-auto flex max-w-5xl flex-col px-4 py-2">
            {items.map((item) => (
              <li key={item.href}>
                {/* 메뉴를 누르면 페이지 이동과 함께 메뉴를 닫습니다. 지금 보는 페이지의 메뉴는 강조됩니다. */}
                <NavLink href={item.href} label={item.label} variant="mobile" onClick={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
