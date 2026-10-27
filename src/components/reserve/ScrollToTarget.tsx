// 주소 끝의 #class-... 가 가리키는 수업 카드로 부드럽게 스크롤하는 보이지 않는 컴포넌트.
// 날짜 칸의 "내 예약" 이름표를 누르면 그 날짜 화면으로 이동한 뒤 해당 수업 카드로 내려갑니다.
// 수업 카드는 서버에서 데이터를 받은 뒤에 그려지기 때문에, 브라우저가 알아서 스크롤하는 것만으로는 놓칠 수 있어서 직접 처리합니다.
"use client";

import { useEffect, useRef } from "react";

export default function ScrollToTarget() {
  // 마지막으로 처리한 주소(날짜+해시). 같은 주소에서 화면이 다시 그려질 때마다 스크롤이 반복되지 않게 합니다.
  const handled = useRef<string>("");

  // 의존성 배열이 없어서 화면이 다시 그려질 때마다 실행됩니다. (날짜 이동 후에도 한 번씩 확인)
  useEffect(() => {
    const key = `${window.location.search}${window.location.hash}`;
    if (!window.location.hash || handled.current === key) {
      return;
    }
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(id);
    if (target) {
      handled.current = key;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // 이동해 온 카드를 잠깐(2초) 테두리로 강조합니다. (CSS의 :target은 링크 이동 방식에서는 적용되지 않아서 직접 처리)
      const highlight = ["ring-2", "ring-accent/50", "border-accent"];
      target.classList.add(...highlight);
      window.setTimeout(() => target.classList.remove(...highlight), 2000);
    }
  });

  return null;
}
