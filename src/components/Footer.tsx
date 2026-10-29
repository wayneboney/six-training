import Image from "next/image";
import Link from "next/link";
import PrivacyModal from "@/components/PrivacyModal";
import { gym } from "@/data/gym";
import { publicNavItems } from "@/data/navigation";

// 푸터 안의 작은 제목 (바로가기, 문의·위치)
function FooterHeading({ children }: { children: string }) {
  return <h2 className="text-xs font-bold uppercase tracking-widest text-accent">{children}</h2>;
}

const externalLink = "hover:text-foreground hover:underline";

// Footer = 모든 페이지 맨 아래에 나오는 박스 기본 정보
// 위쪽: 소개 / 바로가기 / 문의·위치 3칸 (모바일에서는 세로로 쌓임), 아래쪽: 저작권 + 개인정보처리방침
// 전화번호는 링크로 만들지 않고 글자로만 보여줍니다.
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-5xl gap-3 px-4 py-5 sm:grid-cols-[1.4fr_1fr_1.4fr] sm:gap-10 sm:py-12">
        {/* 소개 */}
        <section aria-label={`${gym.name} 소개`} className="flex items-center gap-3 sm:block sm:space-y-3">
          <Link href="/" aria-label={`${gym.name} 홈으로`} className="inline-block">
            <Image src="/logo.png" alt={gym.name} width={345} height={133} className="h-6 w-auto sm:h-8" />
          </Link>
          <p className="text-sm font-black sm:text-lg">{gym.slogan}</p>
          <ul className="hidden space-y-1 text-sm text-muted sm:block">
            {gym.highlights.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>

        {/* 바로가기: 로그인 없이 볼 수 있는 메뉴만 */}
        <nav aria-label="바로가기" className="hidden space-y-3 sm:block">
          <FooterHeading>바로가기</FooterHeading>
          <ul className="space-y-2 text-sm text-muted">
            {publicNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 문의, 위치 */}
        <section aria-label="문의 및 위치" className="space-y-3">
          <div className="hidden sm:block">
            <FooterHeading>문의 · 위치</FooterHeading>
          </div>
          {/* 모바일: 주소 한 줄 + 전화/인스타그램 한 줄로 줄여서 보여줍니다. 항목 이름(주소, 전화…)은 PC에서만 */}
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted sm:block sm:space-y-3 sm:text-sm">
            <div className="basis-full">
              <dt className="sr-only text-xs text-muted/80 sm:not-sr-only">주소</dt>
              <dd className="sm:mt-0.5">
                {gym.contact.address}{" "}
                <a
                  href={gym.contact.naverPlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-accent hover:underline"
                >
                  지도 보기
                </a>
              </dd>
            </div>
            <div>
              <dt className="sr-only text-xs text-muted/80 sm:not-sr-only">전화</dt>
              <dd className="sm:mt-0.5">{gym.contact.phone}</dd>
            </div>
            <div>
              <dt className="sr-only text-xs text-muted/80 sm:not-sr-only">SNS</dt>
              <dd className="sm:mt-0.5">
                <a href={gym.contact.instagram} target="_blank" rel="noopener noreferrer" className={externalLink}>
                  인스타그램
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* 맨 아래 줄: 저작권 + 개인정보처리방침(팝업) */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted sm:py-4">
          <p>
            © {gym.foundedYear} {gym.name}. All rights reserved.
          </p>
          <PrivacyModal className="font-bold hover:text-foreground hover:underline">개인정보처리방침</PrivacyModal>
        </div>
      </div>
    </footer>
  );
}
