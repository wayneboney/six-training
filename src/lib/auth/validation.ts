// 회원가입 입력값 검증. 브라우저의 검사는 우회할 수 있으므로 서버에서 반드시 다시 검사합니다.
// 순수 함수(화면/DB와 무관)라서 따로 떼어 두었습니다.

import { ageOf, MIN_JOIN_AGE, normalizePhone, parseBirthDate, parseGender, type Gender } from "@/lib/profile/contact";

export type SignupInput = {
  email: string;
  name: string;
  password: string;
  phone: string; // 숫자만 (01012345678)
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
};

// 오류가 났을 때 입력칸을 다시 채워 주기 위한 값 (비밀번호는 제외)
export type SignupFormValues = { email: string; name: string; phone: string; birthDate: string; gender: string };

export type SignupValidation =
  | { ok: true; value: SignupInput }
  | ({ ok: false; error: string } & SignupFormValues);

export const PASSWORD_MIN = 8;
// bcrypt(비밀번호 암호화 방식)는 72바이트까지만 반영합니다. 그 이상은 의미가 없으므로 막습니다.
export const PASSWORD_MAX = 72;
export const NAME_MAX = 50;

// 아주 느슨한 이메일 모양 검사. 진짜 확인은 인증 메일이 하므로 여기서는 명백한 오타만 걸러냅니다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 제어문자(줄바꿈, 탭 등)는 이름에 넣을 수 없게 합니다.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function validateSignup(formData: FormData): SignupValidation {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const birthRaw = String(formData.get("birthDate") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "");
  const fail = (error: string): SignupValidation => ({
    ok: false,
    error,
    email,
    name,
    phone: phoneRaw,
    birthDate: birthRaw,
    gender: genderRaw,
  });

  if (!name) {
    return fail("이름을 입력해 주세요.");
  }
  if (name.length > NAME_MAX || CONTROL_CHARS.test(name)) {
    return fail(`이름은 ${NAME_MAX}자 이하의 글자로 입력해 주세요.`);
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return fail("이메일 형식이 올바르지 않습니다.");
  }
  if (password.length < PASSWORD_MIN) {
    return fail(`비밀번호는 ${PASSWORD_MIN}자 이상으로 입력해 주세요.`);
  }
  if (password.length > PASSWORD_MAX) {
    return fail(`비밀번호는 ${PASSWORD_MAX}자 이하로 입력해 주세요.`);
  }
  if (password !== passwordConfirm) {
    return fail("비밀번호 확인이 일치하지 않습니다.");
  }

  const birthDate = parseBirthDate(birthRaw);
  if (!birthDate) {
    return fail("생년월일을 올바르게 입력해 주세요.");
  }
  const age = ageOf(birthDate);
  if (age !== null && age < MIN_JOIN_AGE) {
    return fail(`만 ${MIN_JOIN_AGE}세 미만은 직접 가입할 수 없습니다. 체육관으로 문의해 주세요.`);
  }
  const gender = parseGender(genderRaw);
  if (!gender) {
    return fail("성별을 선택해 주세요.");
  }
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return fail("휴대전화번호를 올바르게 입력해 주세요. (예: 010-1234-5678)");
  }
  // 개인정보 수집·이용 동의 (체크박스). 동의 없이는 가입할 수 없습니다.
  if (formData.get("consent") !== "on") {
    return fail("개인정보 수집·이용에 동의해 주세요.");
  }
  return { ok: true, value: { email, name, password, phone, birthDate, gender } };
}

// 이름만 검증 (내 정보 수정용). 가입 검증과 같은 규칙입니다.
export function validateName(value: FormDataEntryValue | null): { ok: true; value: string } | { ok: false; error: string } {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    return { ok: false, error: "이름을 입력해 주세요." };
  }
  if (name.length > NAME_MAX || CONTROL_CHARS.test(name)) {
    return { ok: false, error: `이름은 ${NAME_MAX}자 이하의 글자로 입력해 주세요.` };
  }
  return { ok: true, value: name };
}
