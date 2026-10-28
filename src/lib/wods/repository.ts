// WOD 데이터를 DB에서 읽어 오는 곳. (Spring의 Repository/DAO 역할)
// 화면 코드는 이 함수만 부르고, DB 종류나 SQL은 몰라도 됩니다.
import "server-only";
import { createAuthSupabase } from "@/lib/supabase/auth";
import { toWods, type WodRow } from "@/lib/wods/mapper";
import type { Wod } from "@/data/wods";

// 조회 실패를 나타내는 에러. 화면에서는 이 에러를 잡아서 안내 문구를 보여줍니다.
export class WodLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WodLoadError";
  }
}

// from ~ to 기간의 WOD를 날짜순으로 가져옵니다. (날짜는 "YYYY-MM-DD")
export async function getWods(from: string, to: string): Promise<Wod[]> {
  // 로그인한 사용자의 권한으로 조회합니다. DB 규칙(RLS)이 로그인하지 않은 요청은 막아서, 로그인하지 않으면 빈 결과가 나옵니다.
  const supabase = await createAuthSupabase();

  // select ... from wods where wod_date between from and to order by wod_date
  const { data, error } = await supabase
    .from("wods")
    .select("id, wod_date, wod_type, title, format, movements, note")
    .gte("wod_date", from)
    .lte("wod_date", to)
    .order("wod_date", { ascending: true })
    // 조회 결과의 타입을 WodRow 배열로 지정 (merge: false = 자동 추론 타입과 섞지 않고 이 타입만 사용)
    .overrideTypes<WodRow[], { merge: false }>();

  if (error) {
    // 원인(error)은 서버 로그용으로 함께 넘기고, 화면에는 일반적인 안내만 보여줍니다.
    throw new WodLoadError(`WOD 조회 실패: ${error.message}`, { cause: error });
  }

  const { wods, skipped } = toWods(data ?? []);
  if (skipped.length > 0) {
    // 화면이 모르는 종류(wod_type)가 DB에 있으면 빼고 보여주되, 서버 로그에 남깁니다.
    console.warn(
      `[wods] 알 수 없는 종류라서 제외한 WOD ${skipped.length}개:`,
      skipped.map((row) => ({ id: row.id, wod_type: row.wod_type })),
    );
  }
  return wods;
}
