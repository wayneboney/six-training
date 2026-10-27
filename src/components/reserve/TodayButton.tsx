// "오늘" 버튼: 오늘 날짜를 선택해서 이번 주 날짜 줄의 오늘 칸에 초점을 맞춥니다. (화면을 스크롤하지는 않음)
"use client";

import Link from "next/link";
import LinkPendingOverlay from "@/components/reserve/LinkPendingOverlay";

export default function TodayButton({ date }: { date: string }) {
  return (
    <Link
      href={`/reserve?date=${date}`}
      scroll={false} // 이동 후 화면 맨 위로 올라가지 않고 보고 있던 위치를 그대로 둡니다.
      className="relative cursor-pointer rounded-full border border-accent px-3 py-1 text-xs font-bold text-accent transition hover:bg-accent hover:text-white active:scale-95"
    >
      오늘로 이동
      <LinkPendingOverlay />
    </Link>
  );
}
