// 관리자 화면 맨 위 제목 배너. 지금 보고 있는 화면(주소)에 맞춰 제목과 설명이 바뀝니다. (다른 페이지의 배너와 같은 모양)
// 현재 주소를 알아야 해서 브라우저에서 실행되는 컴포넌트입니다. 화면이 늘어나면 아래 목록에 한 줄만 추가합니다.
"use client";

import { usePathname } from "next/navigation";
import PageBanner from "@/components/PageBanner";

// 위에서부터 먼저 맞는 항목을 씁니다. (더 구체적인 주소를 위에)
const banners: { match: (path: string) => boolean; title: string; description: string }[] = [
  { match: (p) => p === "/admin/login", title: "관리자 로그인", description: "코치 계정으로 로그인해 주세요." },
  { match: (p) => p === "/admin/programs/new", title: "Program 등록", description: "날짜와 수업 종류별로 오늘의 Program을 등록합니다." },
  { match: (p) => p.startsWith("/admin/programs/"), title: "Program 수정", description: "등록한 Program의 내용을 고치거나 삭제합니다." },
  { match: (p) => p.startsWith("/admin/programs"), title: "Program 관리", description: "날짜별 Program을 등록하고 관리합니다." },
  { match: (p) => p.startsWith("/admin/members/"), title: "회원 상세", description: "회원 정보, 회원권, 홀딩, 출석을 확인하고 관리합니다." },
  { match: (p) => p.startsWith("/admin/members"), title: "회원 관리", description: "회원 가입 승인, 회원권과 출석 현황을 관리합니다." },
  { match: (p) => p.startsWith("/admin/schedule"), title: "시간표 관리", description: "수업 시간을 정하면 회원이 그 시간으로 예약합니다." },
];

export default function AdminBanner() {
  const pathname = usePathname();
  const found = banners.find((b) => b.match(pathname));
  return <PageBanner eyebrow="ADMIN" title={found?.title ?? "관리자"} description={found?.description ?? "Program, 회원, 시간표를 관리합니다."} />;
}
