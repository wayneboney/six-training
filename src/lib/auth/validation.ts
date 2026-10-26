// 회원가입 입력값 검증. 브라우저의 검사는 우회할 수 있으므로 서버에서 반드시 다시 검사합니다.
// 순수 함수(화면/DB와 무관)라서 따로 떼어 두었습니다.

export type SignupInput = {
  email: string;
  name: string;
  password: string;
};

export type SignupValidation =
  | { ok: true; value: SignupInput }
  | { ok: false; error: string; email: string; name: string };

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
  const fail = (error: string): SignupValidation => ({ ok: false, error, email, name });

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
  return { ok: true, value: { email, name, password } };
}
