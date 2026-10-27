// 스크롤할 때 오른쪽 아래에 나타나는 "up(맨 위로) / down(맨 아래로)" 버튼.
// - 스크롤하면 나타나고, 2.5초 동안 스크롤이 없으면 사라집니다. (마우스를 올려 두면 계속 보임)
// - 이미 맨 위면 up 버튼은, 맨 아래면 down 버튼은 보이지 않습니다.
"use client";

import { useEffect, useRef, useState } from "react";

const HIDE_AFTER_MS = 2500;
const EDGE_PX = 40; // 맨 위/맨 아래로 보는 여유 거리

export default function ScrollButtons() {
  const [visible, setVisible] = useState(false);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const hovering = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let frame = 0;

    function scheduleHide() {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (!hovering.current) {
          setVisible(false);
        }
      }, HIDE_AFTER_MS);
    }

    function onScroll() {
      // 스크롤 이벤트는 아주 자주 오므로 화면 갱신 주기(프레임)마다 한 번만 처리합니다.
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const top = window.scrollY;
        const bottom = document.documentElement.scrollHeight - window.innerHeight - top;
        setCanUp(top > EDGE_PX);
        setCanDown(bottom > EDGE_PX);
        setVisible(true);
        scheduleHide();
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // 밝은 톤: 흰 바탕에 얇은 테두리와 그림자. 글자는 "up" / "down"
  const buttonClass =
    "flex h-9 w-14 items-center justify-center rounded-full border border-line bg-white/95 text-xs font-bold tracking-wide text-foreground shadow-md transition hover:border-accent hover:bg-accent-soft hover:text-accent active:scale-95";

  return (
    <div
      onPointerEnter={() => {
        hovering.current = true;
      }}
      onPointerLeave={() => {
        hovering.current = false;
        window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
      }}
      // z-40: 알림(토스트, z-50)보다는 아래, 헤더(z-10)보다는 위
      className={`fixed bottom-5 right-4 z-40 flex flex-col gap-2 transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {canUp && (
        <button
          type="button"
          aria-label="맨 위로"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={buttonClass}
        >
          up
        </button>
      )}
      {canDown && (
        <button
          type="button"
          aria-label="맨 아래로"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
          className={buttonClass}
        >
          down
        </button>
      )}
    </div>
  );
}
