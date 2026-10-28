import type { Metadata } from "next";
import PrivacyPolicy from "@/components/PrivacyPolicy";

export const metadata: Metadata = {
  title: "개인정보처리방침",
};

// 정적 페이지: 로그인 정보를 쓰지 않아 미리 만들어 둡니다.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-black">개인정보처리방침</h1>
      <PrivacyPolicy />
    </div>
  );
}
