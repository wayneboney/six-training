// 아코디언: 제목 줄을 누르면 내용이 위아래로 부드럽게 펼쳐지고, 한 번에 하나만 열립니다. (다른 줄을 누르면 열려 있던 것은 접힘)
// 내용의 실제 높이를 재서 높이(height)를 0 ↔ 그 높이로 부드럽게 바꾸는 방식이라 브라우저 종류와 상관없이 슬라이드됩니다.
// (내용이 바뀌어 높이가 달라져도 ResizeObserver가 다시 재서 맞춥니다)
// 속도: duration-[700ms]. 더 느리게/빠르게 하려면 이 숫자(밀리초)를 바꿉니다. (이 파일에서 2곳: 내용 상자, 화살표)
// 접힌 내용은 inert로 막아서 키보드(Tab)로 접근하거나 화면 낭독기가 읽지 않게 합니다.
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type AccordionItem = {
  id: string;
  title: ReactNode; // 제목 줄 (눌러서 여닫음)
  content: ReactNode; // 펼쳐지는 내용
};

const SLIDE_MS = 700; // 펼침/접힘 애니메이션 시간 (아래 Panel의 duration-[700ms]와 같게 유지)

// 펼친 제목이 화면 위쪽(고정된 헤더 바로 아래)에 오도록 스크롤을 따라 움직입니다.
// 다른 칸이 접히면서 펼친 칸의 위치가 계속 바뀌기 때문에, 애니메이션 시간 동안 매 프레임 목표 위치를 다시 계산해서 부드럽게 따라갑니다.
// 사용자가 직접 스크롤하면(휠, 터치, 키보드) 바로 멈춥니다.
function followToTop(target: HTMLElement) {
  const header = document.querySelector("header");
  const offset = (header ? header.getBoundingClientRect().height : 0) + 12; // 헤더 높이 + 여백
  const startedAt = performance.now();
  let stopped = false;

  const stop = () => {
    stopped = true;
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);

  const step = () => {
    if (stopped) {
      return;
    }
    const elapsed = performance.now() - startedAt;
    const wanted = target.getBoundingClientRect().top + window.scrollY - offset; // 제목이 헤더 바로 아래에 오는 스크롤 위치
    const distance = wanted - window.scrollY;
    // 남은 거리의 18%씩 다가가서 처음에는 빠르고 끝에는 부드럽게 멈춥니다. 시간이 끝나면 정확히 맞춥니다.
    window.scrollTo(0, elapsed >= SLIDE_MS + 100 ? wanted : window.scrollY + distance * 0.18);
    if (elapsed < SLIDE_MS + 100) {
      requestAnimationFrame(step);
    } else {
      stop();
    }
  };
  requestAnimationFrame(step);
}

// 펼쳐지는 부분. 안쪽 내용의 높이를 재서 바깥 상자의 높이를 그 값으로 바꿉니다.
function Panel({ id, labelledBy, open, children }: { id: string; labelledBy: string; open: boolean; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = inner.current;
    if (!el) {
      return;
    }
    setHeight(el.scrollHeight);
    const observer = new ResizeObserver(() => setHeight(el.scrollHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      inert={!open}
      style={{ height: open ? height : 0 }}
      // relative: 접힌 안쪽의 화면 낭독기용 숨김 요소(position:absolute)가 이 상자 안에서 잘리도록 기준으로 삼습니다. (없으면 접어 둔 내용만큼 페이지 아래에 빈 공간이 생김)
      className={`relative overflow-hidden transition-[height,opacity] duration-[700ms] ease-in-out ${open ? "opacity-100" : "opacity-0"}`}
    >
      <div ref={inner} className="border-t border-line">
        {children}
      </div>
    </div>
  );
}

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const open = item.id === openId;
        return (
          <section key={item.id} className="overflow-hidden rounded-lg border border-line">
            <h2>
              <button
                type="button"
                id={`accordion-title-${item.id}`}
                aria-expanded={open}
                aria-controls={`accordion-panel-${item.id}`}
                onClick={(event) => {
                  setOpenId(open ? null : item.id);
                  if (!open) {
                    // 펼치는 경우에만, 그 칸이 화면 위쪽에 오도록 스크롤을 맞춥니다.
                    followToTop(event.currentTarget.closest("section") as HTMLElement);
                  }
                }}
                className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-3 text-left"
              >
                <span>{item.title}</span>
                {/* 펼치면 화살표가 뒤집힙니다 */}
                <svg
                  viewBox="0 0 12 8"
                  aria-hidden="true"
                  className={`h-2 w-3 shrink-0 text-muted transition-transform duration-[700ms] ease-in-out ${
                    open ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 1.5l5 5 5-5" />
                </svg>
              </button>
            </h2>
            <Panel id={`accordion-panel-${item.id}`} labelledBy={`accordion-title-${item.id}`} open={open}>
              {item.content}
            </Panel>
          </section>
        );
      })}
    </div>
  );
}
