// 회원 연락처/생년월일/성별 검증과 표시 도우미. 화면/DB와 무관한 순수 함수라서 서버(검증)와 화면(표시) 어디서나 씁니다.
// 개인정보라서 서버에서 반드시 다시 검사합니다. (브라우저 검사는 우회할 수 있음)
import { seoulTodayKey } from "@/lib/date";

export type Gender = "M" | "F";
export const genderLabels: Record<Gender, string> = { M: "남성", F: "여성" };

// 만 14세 미만은 보호자(법정대리인) 동의 없이 개인정보를 수집할 수 없어서 가입을 받지 않습니다. (개인정보 보호법)
export const MIN_JOIN_AGE = 14;

// 전화번호: 숫자만 남겨서 휴대전화 형식(010, 011, 016, 017, 018, 019 + 7~8자리)인지 확인합니다.
// "010-1234-5678", "010 1234 5678", "01012345678" 모두 "01012345678"로 맞춥니다. 형식이 틀리면 null
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^0-9]/g, "");
  return /^01[016789][0-9]{7,8}$/.test(digits) ? digits : null;
}

// "01012345678" → "010-1234-5678", "0111234567" → "011-123-4567" (화면 표시용)
export function formatPhone(digits: string | null): string {
  if (!digits) {
    return "";
  }
  return digits.length === 11
    ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// 생년월일: "YYYY-MM-DD"이고 실제 있는 날짜이며 1900-01-01 ~ 오늘(한국 시간) 사이여야 합니다. 아니면 null
export function parseBirthDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return null; // 2월 30일 같은 없는 날짜
  }
  return value >= "1900-01-01" && value <= seoulTodayKey() ? value : null;
}

export function parseGender(value: unknown): Gender | null {
  return value === "M" || value === "F" ? value : null;
}

// 만 나이 (오늘 기준, 한국 시간). 생년월일이 없으면 null
export function ageOf(birthDate: string | null, today: string = seoulTodayKey()): number | null {
  if (!birthDate) {
    return null;
  }
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
