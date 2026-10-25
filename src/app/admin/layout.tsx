import type { Metadata } from "next";

// 관리자 화면 공통 설정
export const metadata: Metadata = {
  title: {
    default: "관리자",
    template: "%s | 관리자",
  },
  // 검색 엔진(구글, 네이버)이 관리자 화면을 수집해서 검색 결과에 노출하지 않도록 막습니다.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-12">{children}</div>;
}
