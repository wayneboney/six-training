import type { WodType } from "@/data/wods";

// WOD 종류별 화면 표시 설정. 달력 표시, 범례, 상세 카드가 모두 여기 값을 씁니다.
// 종류가 늘어나면 여기에 한 줄만 추가하면 화면 전체에 반영됩니다.
// Record<WodType, ...> 이라서 종류를 하나라도 빠뜨리면 컴파일 에러가 나서 놓칠 일이 없습니다.
export const wodTypeStyles: Record<WodType, { short: string; color: string }> = {
  CROSSFIT: { short: "CF", color: "bg-foreground" }, // 검정
  HYROX: { short: "HX", color: "bg-accent" }, // 와인색
  COACH_TRAINING: { short: "CT", color: "bg-muted" }, // 회색
};
