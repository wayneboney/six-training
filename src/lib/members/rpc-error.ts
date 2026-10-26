// DB 함수(RPC)가 돌려준 에러를 화면에 보여줄 결과로 바꾸는 공통 도우미.
// 관리자 화면과 회원 화면의 Server Action이 같이 씁니다.

// 폼에 돌려줄 결과: 성공/실패 + 안내 문구
export type ActionResult = { ok: boolean; message: string };

export type RpcError = { code?: string; message?: string } | null;

// MB로 시작하는 코드는 우리가 DB 함수에서 직접 만든 안내 문구(한글)라서 그대로 보여주고,
// 그 밖의 에러(DB 내부 오류 등)는 내용을 숨기고 로그만 남깁니다.
export function toFailure(error: NonNullable<RpcError>, what: string): ActionResult {
  if (error.code?.startsWith("MB") && error.message) {
    return { ok: false, message: error.message };
  }
  if (error.code === "42501") {
    return { ok: false, message: "권한이 없습니다. 다시 로그인해 주세요." };
  }
  console.error(`[members] ${what} 실패`, error.code, error.message);
  return { ok: false, message: "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." };
}
