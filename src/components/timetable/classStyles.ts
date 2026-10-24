import type { ClassType } from "@/data/timetable";

// 수업 종류별 칸 색상. PC 표와 모바일 목록이 같이 씁니다.
export const classStyles: Record<ClassType, string> = {
  CROSSFIT: "bg-background font-black",
  HYROX: "bg-accent-soft font-black",
  OPEN_GYM: "bg-surface font-black text-accent",
  BREAK: "bg-surface font-bold text-muted",
  CLOSE: "bg-surface text-sm text-muted",
};
