// Program(Workout Of the Day)의 모양(타입)과 종류 정의.
// 실제 Program 데이터는 Supabase DB의 wods 테이블에 있고, src/lib/wods/repository.ts가 읽어 옵니다.
// DB 테이블 정의: supabase/migrations/20261025000000_create_wods.sql

// Program 종류 목록. 종류를 추가하려면 여기와 아래 wodTypeLabels,
// 그리고 화면 색상(src/components/wod/wodTypeStyles.ts)에 한 줄씩 추가합니다.
// DB 테이블의 check 제약(wod_type in (...))에도 같은 값을 넣어야 합니다.
export const wodTypes = ["CROSSFIT", "HYROX", "COACH_TRAINING"] as const;

// "CROSSFIT" | "HYROX" | "COACH_TRAINING" (위 목록에서 자동으로 만들어지는 타입)
export type WodType = (typeof wodTypes)[number];

export type Wod = {
  id: number; // DB의 PK. 관리자 화면에서 수정/삭제할 Program을 가리킬 때 씁니다.
  date: string; // "YYYY-MM-DD" 형식 (예: "2026-10-26")
  type: WodType;
  title: string; // Program 이름 (예: "Fran")
  format: string; // 진행 방식 (예: "For Time", "AMRAP 20min")
  movements: string[]; // 동작 목록, 한 줄에 하나
  note?: string; // 코치 메모 (생략 가능)
};

// Record<WodType, string> = 종류마다 이름이 하나씩 반드시 있어야 합니다. 빠뜨리면 컴파일 에러
export const wodTypeLabels: Record<WodType, string> = {
  CROSSFIT: "CROSSFIT",
  HYROX: "HYROX",
  COACH_TRAINING: "COACH TRAINING",
};
