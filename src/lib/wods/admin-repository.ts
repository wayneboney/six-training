// 관리자용 프로그램 데이터 접근 (등록/수정/단건 조회)
// 모든 함수가 시작할 때 관리자인지 다시 확인합니다.
// Server Action은 주소만 알면 누구나 직접 호출할 수 있다고 가정해야 해서, 화면에서 확인했더라도 여기서 또 확인합니다.
// 그리고 DB의 RLS 규칙(관리자만 쓰기)이 마지막으로 한 번 더 막아 줍니다.
import "server-only";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { createAuthSupabase } from "@/lib/supabase/auth";
import { toWod, type WodRow } from "@/lib/wods/mapper";
import type { WodInput } from "@/lib/wods/validation";
import { wodTypeLabels, type Wod } from "@/data/wods";

// 저장 실패 원인. 화면에서는 kind에 따라 안내 문구를 고릅니다.
export type WodSaveError =
  | { kind: "unauthorized" } // 관리자가 아님
  | { kind: "duplicate"; message: string } // 같은 날짜에 같은 종류가 이미 있음
  | { kind: "not_found" } // 수정하려는 프로그램이 없음 (그사이 삭제됨 등)
  | { kind: "unknown" }; // 그 밖의 오류 (원인은 서버 로그에)

export type WodSaveResult = { ok: true; wod: Wod } | { ok: false; error: WodSaveError };

// PostgreSQL 에러 코드 (Oracle의 ORA-00001 같은 번호)
const PG_UNIQUE_VIOLATION = "23505"; // unique 제약 위반
const PG_INSUFFICIENT_PRIVILEGE = "42501"; // 권한 없음 (RLS 거부)

const SELECT_COLUMNS = "id, wod_date, wod_type, title, format, movements, note";

// 화면 입력값 → DB 컬럼 이름 (toWod의 반대 방향 매핑)
function toRow(input: WodInput) {
  return {
    wod_date: input.date,
    wod_type: input.type,
    title: input.title,
    format: input.format,
    movements: input.movements,
    note: input.note,
  };
}

// DB 에러를 화면용 원인으로 바꿉니다.
function toSaveError(error: { code?: string; message: string }, input: WodInput): WodSaveError {
  if (error.code === PG_UNIQUE_VIOLATION) {
    return {
      kind: "duplicate",
      message: `${input.date}에 이미 ${wodTypeLabels[input.type]} 프로그램이 있습니다. 기존 프로그램을 수정해 주세요.`,
    };
  }
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
    return { kind: "unauthorized" };
  }
  console.error("[wods] 저장 실패", error);
  return { kind: "unknown" };
}

// 저장된 한 줄을 화면용 Wod로 바꿉니다. (DB가 모르는 종류일 리 없지만 만약을 대비)
function rowToWodOrError(row: WodRow): WodSaveResult {
  const wod = toWod(row);
  return wod ? { ok: true, wod } : { ok: false, error: { kind: "unknown" } };
}

export async function createWod(input: WodInput): Promise<WodSaveResult> {
  if (!(await getCurrentAdmin())) {
    return { ok: false, error: { kind: "unauthorized" } };
  }
  const supabase = await createAuthSupabase();

  // insert ... returning (저장된 줄을 바로 돌려받기)
  const { data, error } = await supabase
    .from("wods")
    .insert(toRow(input))
    .select(SELECT_COLUMNS)
    .single()
    .overrideTypes<WodRow, { merge: false }>();

  if (error) {
    return { ok: false, error: toSaveError(error, input) };
  }
  return rowToWodOrError(data);
}

export async function updateWod(id: number, input: WodInput): Promise<WodSaveResult> {
  if (!(await getCurrentAdmin())) {
    return { ok: false, error: { kind: "unauthorized" } };
  }
  const supabase = await createAuthSupabase();

  // update ... where id = ? returning
  // maybeSingle: 해당 id가 없으면(이미 삭제됨) 에러 대신 null
  const { data, error } = await supabase
    .from("wods")
    .update(toRow(input))
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle()
    .overrideTypes<WodRow | null, { merge: false }>();

  if (error) {
    return { ok: false, error: toSaveError(error, input) };
  }
  if (!data) {
    return { ok: false, error: { kind: "not_found" } };
  }
  return rowToWodOrError(data);
}

export type WodDeleteResult =
  | { ok: true; date: string } // 지운 프로그램의 날짜 (그 달 목록으로 돌아가기 위해)
  | { ok: false; error: { kind: "unauthorized" } | { kind: "not_found" } | { kind: "unknown" } };

export async function deleteWod(id: number): Promise<WodDeleteResult> {
  if (!(await getCurrentAdmin())) {
    return { ok: false, error: { kind: "unauthorized" } };
  }
  const supabase = await createAuthSupabase();

  // delete from wods where id = ? returning id, wod_date
  // 지운 줄을 돌려받아서, 실제로 지워졌는지(0줄이면 이미 없던 것) 확인합니다.
  const { data, error } = await supabase
    .from("wods")
    .delete()
    .eq("id", id)
    .select("id, wod_date")
    .maybeSingle()
    .overrideTypes<{ id: number; wod_date: string } | null, { merge: false }>();

  if (error) {
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
      return { ok: false, error: { kind: "unauthorized" } };
    }
    console.error("[wods] 삭제 실패", error);
    return { ok: false, error: { kind: "unknown" } };
  }
  if (!data) {
    // 이미 삭제됐거나, RLS 때문에 지울 수 있는 줄이 없었던 경우
    return { ok: false, error: { kind: "not_found" } };
  }
  return { ok: true, date: data.wod_date };
}

// 수정 화면에 채울 프로그램 한 건. 관리자가 아니거나 없으면 null
export async function getWodById(id: number): Promise<Wod | null> {
  if (!(await getCurrentAdmin())) {
    return null;
  }
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase
    .from("wods")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<WodRow | null, { merge: false }>();

  if (error) {
    console.error("[wods] 단건 조회 실패", error);
    throw new Error("프로그램 조회 실패", { cause: error });
  }
  return data ? toWod(data) : null;
}
