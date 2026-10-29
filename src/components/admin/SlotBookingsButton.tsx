// 시간표 관리의 "예약 N건" 옆 "≡"(줄 3개) 버튼. 누르면 이 수업의 오늘 이후 예약 인원(이름, 날짜)이 작은 팝업으로 나옵니다.
// PC, 모바일 모두 보입니다. 모바일에서는 "예약 N건"과 함께 저장/삭제 버튼 아래 줄에 나오므로 줄이 더 늘어나지 않습니다.
// 목록은 눌렀을 때 서버에서 불러옵니다. 팝업은 접힌 아코디언(overflow 숨김) 안에서도 잘리지 않도록 화면 기준(fixed)으로 위치를 잡습니다.
"use client";

import Avatar from "@/components/Avatar";
import { useEffect, useRef, useState } from "react";
import { listSlotBookingsAction, type SlotBooking } from "@/app/admin/schedule/actions";
import { formatDateKey } from "@/lib/date";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; bookings: SlotBooking[] };

export default function SlotBookingsButton({ slotId, label }: { slotId: number; label: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null); // null = 닫힘
  const [state, setState] = useState<State>({ status: "idle" });

  const open = position !== null;

  // 닫기: 바깥을 누르거나, Esc, 스크롤/창 크기 변경(위치가 어긋나므로)
  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setPosition(null);
    // 팝업 안의 목록을 스크롤할 때는 닫지 않고, 페이지가 스크롤될 때만 닫습니다.
    const onScroll = (event: Event) => {
      if (document.getElementById(`slot-bookings-${slotId}`)?.contains(event.target as Node)) {
        return;
      }
      close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (button.current?.contains(target) || document.getElementById(`slot-bookings-${slotId}`)?.contains(target)) {
        return;
      }
      close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, slotId]);

  async function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    // 버튼 아래에 띄우되, 화면 오른쪽 끝을 넘지 않게 맞춥니다. (팝업 너비 288px. 화면이 288px보다 좁으면 왼쪽 8px)
    // 화면 아래쪽에 가까워서 아래 공간이 부족하면 버튼 위로 띄웁니다. (팝업 최대 높이 288px)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 288 - 8));
    const showBelow = window.innerHeight - rect.bottom >= 296 || rect.top < 296;
    setPosition(showBelow ? { top: rect.bottom + 6, left } : { bottom: window.innerHeight - rect.top + 6, left });
    setState({ status: "loading" });
    try {
      const result = await listSlotBookingsAction(slotId);
      setState(result.ok ? { status: "ready", bookings: result.bookings } : { status: "error", message: result.message });
    } catch (error) {
      console.error("[admin] 수업 예약 인원 조회 실패", error);
      setState({ status: "error", message: "예약 인원을 불러오지 못했습니다." });
    }
  }

  // 날짜별로 묶기 (이미 날짜순으로 옴)
  const groups: { date: string; items: SlotBooking[] }[] = [];
  if (state.status === "ready") {
    for (const booking of state.bookings) {
      const last = groups[groups.length - 1];
      if (last && last.date === booking.classDate) {
        last.items.push(booking);
      } else {
        groups.push({ date: booking.classDate, items: [booking] });
      }
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={`${label} 예약 인원 보기`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-6 w-7 items-center justify-center rounded-md border border-muted px-0! text-muted hover:border-accent hover:text-accent"
      >
        {/* 줄 3개(≡) 모양 아이콘 */}
        <svg viewBox="0 0 16 12" aria-hidden="true" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M2 2h12M2 6h12M2 10h12" />
        </svg>
      </button>
      {open && position && (
        <div
          id={`slot-bookings-${slotId}`}
          role="dialog"
          aria-label={`${label} 예약 인원`}
          style={{ top: position.top, bottom: position.bottom, left: position.left }}
          className="fixed z-40 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-background p-3 text-sm shadow-lg"
        >
          <p className="mb-2 font-bold">{label} 예약 인원</p>
          {state.status === "loading" && <p className="text-muted">불러오는 중…</p>}
          {state.status === "error" && <p className="font-bold text-accent">{state.message}</p>}
          {state.status === "ready" && groups.length === 0 && <p className="text-muted">오늘 이후 예약이 없습니다.</p>}
          {state.status === "ready" &&
            groups.map((group) => (
              <div key={group.date} className="mt-2 first:mt-0">
                <p className="text-xs font-bold text-muted">{formatDateKey(group.date)}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {group.items.map((item, index) => (
                    <li key={`${index}-${item.name}`} className="flex items-center gap-1.5">
                      <Avatar url={item.avatarUrl} name={item.name} size={24} />
                      <span>{item.name}</span>
                      {item.guestLabel && <span className="rounded bg-accent-soft px-1 text-xs font-bold text-accent">{item.guestLabel}</span>}
                      {item.status === "waiting" && <span className="rounded border border-line px-1 text-xs text-muted">대기</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
