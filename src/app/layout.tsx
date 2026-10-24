import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { gym } from "@/data/gym";
import "./globals.css";

// 한글 폰트. 빌드할 때 폰트 파일을 내려받아 사이트에 함께 넣기 때문에
// 방문자 브라우저가 구글 서버에 따로 요청하지 않습니다. (속도, 개인정보 측면에서 유리)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

// metadata = 브라우저 탭 제목, 검색 엔진에 보여줄 정보
export const metadata: Metadata = {
  title: {
    // 메인 페이지 탭 제목
    default: gym.name,
    // 하위 페이지 탭 제목 규칙. %s 자리에 각 페이지 제목이 들어갑니다.
    // 예: 소개 페이지 → "체육관 소개 | SIX Training"
    template: `%s | ${gym.name}`,
  },
  description: `${gym.name} - ${gym.slogan}`,
};

// RootLayout = 모든 페이지를 감싸는 최상위 틀 (JSP의 공통 템플릿 역할)
// children = 현재 주소에 해당하는 page.tsx의 내용
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="ko": 이 페이지가 한국어라고 브라우저와 검색 엔진에 알려줍니다.
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
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
