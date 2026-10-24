import Link from "next/link";
import { gym } from "@/data/gym";

// page.tsx = "/" 주소에 보여줄 화면 (메인 페이지)
export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-28 sm:py-40">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">Functional Training</p>

      {/* sm:text-6xl = 화면이 640px 이상일 때만 글자를 더 크게 (모바일 우선 설계) */}
      <h1 className="text-4xl font-black leading-tight sm:text-6xl">{gym.slogan}</h1>

      <p className="max-w-xl text-lg text-muted">
        처음 오시는 분도 코치가 동작부터 차근차근 지도합니다. 체력에 상관없이 누구나 시작할 수
        있습니다.
      </p>

      <div className="flex flex-wrap gap-3">
        {/* 사이트 안의 페이지로 이동할 때는 <Link> */}
        <Link
          href="/about"
          className="rounded-md bg-accent px-6 py-3 font-bold text-white hover:opacity-90"
        >
          체육관 둘러보기
        </Link>

        {/* 외부 사이트로 나갈 때는 <a> + 새 탭(target="_blank")
            rel="noopener noreferrer" = 새 탭에서 열린 외부 사이트가 우리 페이지를 조작하지 못하게 막는 보안 설정 */}
        <a
          href={gym.contact.kakaoChannel}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-line px-6 py-3 font-bold hover:bg-surface"
        >
          카카오톡 문의
        </a>
      </div>
    </div>
  );
}
