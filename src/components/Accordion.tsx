// 아코디언: 제목 줄을 누르면 내용이 위아래로 부드럽게 펼쳐지고, 한 번에 하나만 열립니다. (다른 줄을 누르면 열려 있던 것은 접힘)
// 높이를 직접 계산하지 않고 grid의 행 높이를 0fr ↔ 1fr로 바꾸는 방식이라, 내용 길이가 달라도 자연스럽게 움직입니다.
// 접힌 내용은 inert로 막아서 키보드(Tab)로 접근하거나 화면 낭독기가 읽지 않게 합니다.
"use client";

import { useState, type ReactNode } from "react";

export type AccordionItem = {
  id: string;
  title: ReactNode; // 제목 줄 (눌러서 여닫음)
  content: ReactNode; // 펼쳐지는 내용
};

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
                  className={`h-2 w-3 shrink-0 text-muted transition-transform duration-300 motion-reduce:transition-none ${
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
            <div
              id={`accordion-panel-${item.id}`}
              role="region"
              aria-labelledby={`accordion-title-${item.id}`}
              inert={!open}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-line">{item.content}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
