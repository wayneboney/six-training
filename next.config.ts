import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // /admin 은 별도 화면 없이 회원 목록으로 보냅니다. (페이지 코드에서 redirect를 부르면 개발 서버가 오류처럼 보이는 경고를 내서 설정으로 처리)
  // permanent: false = 임시 이동(307). 나중에 첫 화면을 바꿔도 브라우저가 기억해 두지 않습니다.
  async redirects() {
    return [{ source: "/admin", destination: "/admin/members", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
