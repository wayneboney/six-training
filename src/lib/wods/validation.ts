// Program 입력값 검증 (Spring의 @Valid + Validator 역할)
// 규칙은 DB 테이블의 check 제약(supabase/migrations/20261025000000_create_wods.sql)과 같게 맞춥니다.
// 서버에서 반드시 실행합니다. 브라우저 검사(required 등)는 우회할 수 있어서 믿으면 안 됩니다.
import { wodTypes, type WodType } from "@/data/wods";
import { parseDateKey, toDateKey } from "@/lib/date";

// 글자 수 제한 (DB check 제약과 같은 값)
export const WOD_LIMITS = {
  title: 100,
  format: 100,
  note: 500,
  movement: 200, // 동작 한 줄
  movementCount: 30, // 동작 최대 줄 수
} as const;

// 검증을 통과한 값 (DB에 저장할 내용)
export type WodInput = {
  date: string; // "YYYY-MM-DD"
  type: WodType;
  title: string;
  format: string;
  movements: string[];
  note: string | null;
};

// 폼에 다시 채워 넣을 원래 입력값 (에러가 나도 입력한 내용이 지워지지 않게)
export type WodFormValues = {
  date: string;
  type: string;
  title: string;
  format: string;
  movements: string; // 텍스트 상자 그대로 (한 줄에 동작 하나)
  note: string;
};

export type WodFieldErrors = Partial<Record<keyof WodFormValues, string>>;

// values(원래 입력값)는 성공해도 함께 돌려줍니다. 검증은 통과했지만 저장에 실패했을 때(중복 등) 폼에 다시 채우기 위해서입니다.
export type WodValidationResult =
  | { ok: true; value: WodInput; values: WodFormValues }
  | { ok: false; errors: WodFieldErrors; values: WodFormValues };

// 주소나 폼에서 받은 Program id 검사: 1 이상의 정수만 허용 (예: "abc", "-1", "1.5", "0"은 거부)
export function parseWodId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// 화면용 Wod → 폼 초기값 (수정 화면에서 기존 값을 채울 때)
export function wodToFormValues(wod: {
  date: string;
  type: string;
  title: string;
  format: string;
  movements: string[];
  note?: string;
}): WodFormValues {
  return {
    date: wod.date,
    type: wod.type,
    title: wod.title,
    format: wod.format,
    movements: wod.movements.join("\n"),
    note: wod.note ?? "",
  };
}

// 폼 데이터에서 문자열 꺼내기. 값이 없거나 파일 등 문자열이 아니면 빈 문자열
function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// "YYYY-MM-DD" 형식이면서 실제로 있는 날짜인지 (예: 2026-02-30은 거부)
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const { year, month, day } = parseDateKey(value);
  const date = new Date(year, month, day);
  // 2026-02-30을 넣으면 JavaScript가 3월 2일로 바꿔 버리므로, 다시 문자열로 만들어 같은지 비교합니다.
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate()) === value;
}

export function validateWodForm(formData: FormData): WodValidationResult {
  const values: WodFormValues = {
    date: readText(formData, "date").trim(),
    type: readText(formData, "type").trim(),
    title: readText(formData, "title").trim(),
    format: readText(formData, "format").trim(),
    movements: readText(formData, "movements"),
    note: readText(formData, "note").trim(),
  };
  const errors: WodFieldErrors = {};

  if (!isValidDateKey(values.date)) {
    errors.date = "날짜를 올바르게 입력해 주세요.";
  }

  if (!(wodTypes as readonly string[]).includes(values.type)) {
    errors.type = "종류를 선택해 주세요.";
  }

  if (!values.title) {
    errors.title = "Program 이름을 입력해 주세요.";
  } else if (values.title.length > WOD_LIMITS.title) {
    errors.title = `Program 이름은 ${WOD_LIMITS.title}자 이하로 입력해 주세요.`;
  }

  if (!values.format) {
    errors.format = "진행 방식을 입력해 주세요.";
  } else if (values.format.length > WOD_LIMITS.format) {
    errors.format = `진행 방식은 ${WOD_LIMITS.format}자 이하로 입력해 주세요.`;
  }

  // 동작: 줄바꿈으로 나누고, 앞뒤 공백 제거
  // 빈 줄은 "구간 사이 띄움"으로 남깁니다. (예: 1번 운동과 2번 운동 사이) 단, 맨 앞/뒤의 빈 줄과 연속된 빈 줄은 하나로 줄입니다.
  // \r?\n = 윈도우(\r\n)와 맥(\n) 줄바꿈 모두 처리
  const movements = values.movements
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0));
  // 맨 뒤의 빈 줄은 버립니다.
  while (movements.length > 0 && movements[movements.length - 1] === "") {
    movements.pop();
  }

  if (movements.length === 0) {
    errors.movements = "동작을 한 줄에 하나씩 1개 이상 입력해 주세요.";
  } else if (movements.length > WOD_LIMITS.movementCount) {
    errors.movements = `동작은 ${WOD_LIMITS.movementCount}줄 이하로 입력해 주세요.`;
  } else if (movements.some((line) => line.length > WOD_LIMITS.movement)) {
    errors.movements = `동작 한 줄은 ${WOD_LIMITS.movement}자 이하로 입력해 주세요.`;
  }

  if (values.note.length > WOD_LIMITS.note) {
    errors.note = `코치 메모는 ${WOD_LIMITS.note}자 이하로 입력해 주세요.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    value: {
      date: values.date,
      type: values.type as WodType, // 위에서 wodTypes에 있는 값인지 확인했으므로 안전
      title: values.title,
      format: values.format,
      movements,
      note: values.note || null, // 빈 메모는 DB에 null로 저장
    },
  };
}
