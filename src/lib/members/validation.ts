// 관리자 회원 관리 입력값 검증. 화면에서 온 값은 전부 조작될 수 있다고 보고 서버에서 다시 검사합니다.
// 순수 함수 모음이라 화면/DB와 무관합니다.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const NOTE_MAX = 200;

// 회원 id(uuid) 형식 확인. 아니면 null
export function parseUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

// bigint id (회원권, 홀딩). 양의 정수만 허용
export function parseBigintId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// 폼의 날짜 칸(YYYY-MM-DD). 비어 있으면 null, 형식이 틀리거나 없는 날짜(2월 30일 등)면 undefined
export function parseDate(value: FormDataEntryValue | null): string | null | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") {
    return null;
  }
  if (!DATE_PATTERN.test(text)) {
    return undefined;
  }
  // 실제 존재하는 날짜인지 확인: Date로 만들었다가 다시 문자열로 바꿔서 같은지 비교
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    return undefined;
  }
  return text;
}

// 폼의 정수 칸. 정수가 아니면 null
export function parseInteger(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,6}$/.test(text)) {
    return null;
  }
  return Number(text);
}

// 메모: 앞뒤 공백 제거, 비면 null. 너무 길면 undefined
export function parseNote(value: FormDataEntryValue | null): string | null | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") {
    return null;
  }
  return text.length <= NOTE_MAX ? text : undefined;
}
