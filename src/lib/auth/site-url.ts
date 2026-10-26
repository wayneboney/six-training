// 사이트 주소. 인증 메일의 "확인 링크"가 돌아올 주소를 만들 때 씁니다.
// 주소를 요청 헤더(Host)에서 읽으면 조작될 수 있어서, 환경변수로 직접 지정한 값만 믿습니다.
import "server-only";

export function getSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, ""); // 끝의 / 제거
  }
  // 개발 중에는 설정이 없어도 동작하게 합니다. 실서비스에서는 반드시 설정해야 하므로 에러로 알립니다.
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  throw new Error("SITE_URL 환경변수가 없습니다. 배포 환경에 사이트 주소(https://...)를 설정해 주세요.");
}
