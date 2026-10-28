// 기능 켜기/끄기 스위치. 아직 쓰지 않는 기능을 코드는 그대로 둔 채 화면과 접근만 막아 둘 때 씁니다.
// 비밀번호 찾기/재설정: 메일 발송(SMTP)과 메일 템플릿 설정이 끝난 뒤 true로 바꾸면 모든 화면과 기능이 다시 나타납니다.
//   (로그인 화면의 "비밀번호를 잊으셨나요?", 관리자 회원 상세의 "비밀번호 초기화", /forgot-password, /reset-password, /auth/confirm)
export const PASSWORD_RESET_ENABLED = false;
