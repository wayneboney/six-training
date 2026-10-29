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
      className={`overflow-hidden transition-[height,opacity] duration-[700ms] ease-in-out ${open ? "opacity-100" : "opacity-0"}`}
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
                onClick={() => setOpenId(open ? null : item.id)}
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
