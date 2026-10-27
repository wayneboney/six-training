// "오늘" 버튼: 오늘 날짜를 선택하고, 그날의 수업 목록 위치로 화면을 부드럽게 내려 줍니다.
// 이미 오늘을 보고 있어도(주소가 같아도) 누르면 수업 목록으로 다시 이동하도록 클릭할 때 직접 스크롤합니다.
"use client";

import Link from "next/link";
import LinkPendingOverlay from "@/components/reserve/LinkPendingOverlay";

export default function TodayButton({ date }: { date: string }) {
  return (
    <Link
      href={`/reserve?date=${date}#day-classes`}
      onClick={() => document.getElementById("day-classes")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="relative cursor-pointer rounded-full border border-accent px-3 py-1 text-xs font-bold text-accent transition hover:bg-accent hover:text-white active:scale-95"
    >
      오늘로 이동
      <LinkPendingOverlay />
    </Link>
  );
}
