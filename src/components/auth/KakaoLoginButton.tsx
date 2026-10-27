import { kakaoLogin } from "@/app/auth/actions";

// 카카오로 시작하기 버튼. 로그인과 회원가입이 같은 흐름이라(처음이면 자동으로 가입) 두 화면에서 같이 씁니다.
// 폼(POST)으로 서버 함수를 실행해서 카카오 로그인 화면으로 이동합니다. 자바스크립트 없이도 동작합니다.
// 색상(#FEE500)과 검정 글자는 카카오 디자인 가이드의 노란 버튼 규격입니다. 정식 공개 전에는 카카오가 제공하는 공식 버튼 이미지/가이드를 확인하세요.
export default function KakaoLoginButton() {
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        또는
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={kakaoLogin}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md py-3 font-bold hover:opacity-90"
          style={{ backgroundColor: "#FEE500", color: "rgba(0,0,0,0.85)" }}
        >
          {/* 말풍선 모양 아이콘 (카카오톡 느낌의 단순한 도형. 공식 로고가 아님) */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.87 5.37 4.68 6.78-.2.72-.74 2.6-.85 3-.13.5.18.49.38.36.16-.1 2.5-1.7 3.5-2.4.74.1 1.5.16 2.29.16 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
          </svg>
          카카오로 시작하기
        </button>
      </form>
    </div>
  );
}
