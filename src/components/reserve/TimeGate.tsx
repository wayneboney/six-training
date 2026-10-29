// 정해진 시각에 맞춰 안의 내용을 저절로 보이거나 숨기는 컴포넌트. (새로고침하지 않아도 6:45가 되는 순간 출석 버튼이 나타나게 하려고 만들었습니다)
//   showFrom: 이 시각(밀리초)이 되면 보임. 그 전에는 숨김
//   hideAt:   이 시각(밀리초)이 되면 숨김. 그 전에는 보임
// initial은 서버가 그린 시점의 판단(처음 화면과 같아야 해서 서버가 계산한 값을 그대로 씁니다). 이후에는 타이머가 바꿉니다.
"use client";

import { useEffect, useState, type ReactNode } from "react";

const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout이 지원하는 최대 대기 시간(약 24일)

export default function TimeGate({
  initial,
  showFrom,
  hideAt,
  children,
}: {
  initial: boolean;
  showFrom?: number;
  hideAt?: number;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(initial);

  useEffect(() => {
    // 다음에 상태가 바뀌어야 하는 시각: 숨겨져 있으면 showFrom, 보이고 있으면 hideAt
    const target = visible ? hideAt : showFrom;
    if (target === undefined) {
      return;
    }
    const wait = target - Date.now();
    if (wait > MAX_TIMEOUT_MS) {
      return; // 너무 먼 미래는 타이머를 걸지 않습니다. (그때쯤이면 화면을 다시 열게 됨)
    }
    const timer = setTimeout(() => setVisible(!visible), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [visible, showFrom, hideAt]);

  return visible ? <>{children}</> : null;
}
