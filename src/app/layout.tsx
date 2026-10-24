import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

// 폰트 설정 (영문용). 한글 폰트는 다음 단계에서 추가합니다.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// metadata = 브라우저 탭 제목, 검색 엔진에 보여줄 정보
export const metadata: Metadata = {
  title: {
    // 메인 페이지 탭 제목
    default: "SIX Training",
    // 하위 페이지 탭 제목 규칙. %s 자리에 각 페이지 제목이 들어갑니다.
    // 예: 소개 페이지 → "체육관 소개 | SIX Training"
    template: "%s | SIX Training",
  },
  description: "SIX Training - 어제보다 강한 오늘",
};

// RootLayout = 모든 페이지를 감싸는 최상위 틀 (JSP의 공통 템플릿 역할)
// children = 현재 주소에 해당하는 page.tsx의 내용
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="ko": 이 페이지가 한국어라고 브라우저와 검색 엔진에 알려줍니다.
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 헤더는 모든 페이지 맨 위에 공통으로 나옵니다 */}
        <Header />
        {/* flex-1 = 남는 높이를 본문이 차지해서, 내용이 짧아도 푸터가 화면 맨 아래에 붙습니다 */}
        <main className="flex-1">{children}</main>
        {/* 푸터는 모든 페이지 맨 아래에 공통으로 나옵니다 */}
        <Footer />
      </body>
    </html>
  );
}
