// DB에서 꺼낸 WOD 한 줄을 화면에서 쓰는 Wod 모양으로 바꿉니다. (MyBatis resultMap 역할)
// DB 컬럼 이름(snake_case)과 화면 필드 이름(camelCase)이 달라서 이 변환이 필요합니다.
import { wodTypes, type Wod, type WodType } from "@/data/wods";

// DB의 wods 테이블 한 줄 모양 (컬럼 이름 그대로)
export type WodRow = {
  id: number;
  wod_date: string; // PostgreSQL date → "YYYY-MM-DD" 문자열로 옵니다
  wod_type: string; // DB에는 문자열로 저장되어 있어서, 아래에서 허용된 값인지 검사합니다
  title: string;
  format: string;
  movements: string[] | null;
  note: string | null;
};

// 화면이 아는 종류인지 검사 (DB 제약과 코드 목록이 어긋났을 때를 대비)
export function isWodType(value: string): value is WodType {
  return (wodTypes as readonly string[]).includes(value);
}

// DB 한 줄 → Wod. 화면에 보여줄 수 없는 줄이면 null을 돌려줍니다.
export function toWod(row: WodRow): Wod | null {
  if (!isWodType(row.wod_type)) {
    return null;
  }
  return {
    id: row.id,
    date: row.wod_date,
    type: row.wod_type,
    title: row.title,
    format: row.format,
    movements: row.movements ?? [],
    note: row.note ?? undefined, // DB의 null → 화면에서는 "없음"(undefined)
  };
}

// 여러 줄을 한 번에 변환하고, 같은 날짜 안에서는 wodTypes 순서(CROSSFIT → HYROX → COACH_TRAINING)로 정렬합니다.
// 변환하지 못한 줄은 빼고, 몇 줄이 빠졌는지 함께 돌려줍니다.
export function toWods(rows: WodRow[]): { wods: Wod[]; skipped: WodRow[] } {
  const wods: Wod[] = [];
  const skipped: WodRow[] = [];
  for (const row of rows) {
    const wod = toWod(row);
    if (wod) {
      wods.push(wod);
    } else {
      skipped.push(row);
    }
  }
  wods.sort(
    (a, b) => a.date.localeCompare(b.date) || wodTypes.indexOf(a.type) - wodTypes.indexOf(b.type),
  );
  return { wods, skipped };
}
