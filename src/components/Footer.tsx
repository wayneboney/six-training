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

// Footer = 모든 페이지 맨 아래에 나오는 체육관 기본 정보
// 위쪽: 소개 / 바로가기 / 문의·위치 3칸 (모바일에서는 세로로 쌓임), 아래쪽: 저작권 + 개인정보처리방침
// 전화번호는 링크로 만들지 않고 글자로만 보여줍니다.
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1.4fr]">
        {/* 소개 */}
        <section aria-label={`${gym.name} 소개`} className="space-y-3">
          <Link href="/" aria-label={`${gym.name} 홈으로`} className="inline-block">
            <Image src="/logo.png" alt={gym.name} width={345} height={133} className="h-8 w-auto" />
          </Link>
          <p className="text-lg font-black">{gym.slogan}</p>
          <ul className="space-y-1 text-sm text-muted">
            {gym.highlights.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>

        {/* 바로가기: 로그인 없이 볼 수 있는 메뉴만 */}
        <nav aria-label="바로가기" className="space-y-3">
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
          <FooterHeading>문의 · 위치</FooterHeading>
          <dl className="space-y-3 text-sm text-muted">
            <div>
              <dt className="text-xs text-muted/80">주소</dt>
              <dd className="mt-0.5">
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
              <dt className="text-xs text-muted/80">전화</dt>
              <dd className="mt-0.5">{gym.contact.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted/80">SNS</dt>
              <dd className="mt-0.5">
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
          <p>
            © {gym.foundedYear} {gym.name}. All rights reserved.
          </p>
          <PrivacyModal className="font-bold hover:text-foreground hover:underline">개인정보처리방침</PrivacyModal>
        </div>
      </div>
    </footer>
  );
}
