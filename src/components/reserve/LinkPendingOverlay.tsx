// 날짜 칸을 눌렀을 때, 새 화면이 준비될 때까지 그 칸이 반짝이게 해서 "눌렸다"는 것을 바로 보여줍니다.
// <Link> 안에 넣어 두면 그 링크의 이동이 진행 중일 때만(pending) 나타납니다. (useLinkStatus)
"use client";

import { useLinkStatus } from "next/link";

export default function LinkPendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) {
    return null;
  }
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-accent/25" />;
}
