import type { WodType } from "@/data/wods";

// 프로그램 종류별 화면 표시 설정. 달력 표시, 범례, 상세 카드, 관리자 폼이 모두 여기 값을 씁니다.
// 종류가 늘어나면 여기에 한 줄만 추가하면 화면 전체에 반영됩니다.
// Record<WodType, ...> 이라서 종류를 하나라도 빠뜨리면 컴파일 에러가 나서 놓칠 일이 없습니다.
//
// ⚠️ 클래스 이름은 반드시 전체를 그대로 적어야 합니다.
//    Tailwind는 소스 코드에서 클래스 이름 글자를 찾아 CSS를 만들기 때문에,
//    `peer-checked:${color}`처럼 조합해서 만든 이름은 찾지 못해 스타일이 적용되지 않습니다.
export const wodTypeStyles: Record<WodType, { short: string; color: string; checked: string }> = {
  // 검정
  CROSSFIT: { short: "CF", color: "bg-foreground", checked: "peer-checked:bg-foreground" },
  // 와인색
  HYROX: { short: "HX", color: "bg-accent", checked: "peer-checked:bg-accent" },
  // 회색
  COACH_TRAINING: { short: "CT", color: "bg-muted", checked: "peer-checked:bg-muted" },
};
