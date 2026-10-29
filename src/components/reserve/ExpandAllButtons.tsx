// 이 화면의 모든 수업 카드의 "예약자 N명" 목록을 한 번에 펼치거나 접는 버튼.
// 목록은 <details>(브라우저가 접힘 상태를 관리)라서, 버튼은 화면에 있는 목록의 열림 상태만 바꿉니다.
"use client";

function setAll(open: boolean) {
  for (const el of document.querySelectorAll<HTMLDetailsElement>("details[data-attendees]")) {
    el.open = open;
  }
}

const buttonClass = "rounded-md border border-line px-2.5 py-1 text-xs font-bold text-muted hover:bg-surface hover:text-foreground";

export default function ExpandAllButtons() {
  return (
    <div className="flex gap-1.5" role="group" aria-label="예약자 목록 펼치기/접기">
      <button type="button" onClick={() => setAll(true)} className={buttonClass}>
        모두 펼치기
      </button>
      <button type="button" onClick={() => setAll(false)} className={buttonClass}>
        모두 접기
      </button>
    </div>
  );
}
