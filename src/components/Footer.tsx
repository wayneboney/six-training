import Link from "next/link";
import { gym } from "@/data/gym";

// Footer = 모든 페이지 맨 아래에 나오는 체육관 기본 정보
export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-muted">
        <p className="font-bold text-foreground">{gym.name}</p>
        <p>{gym.contact.address}</p>
        <p>문의 {gym.contact.phone}</p>
        <p>
          <Link href="/privacy" className="underline hover:text-foreground">
            개인정보처리방침
          </Link>
        </p>
        <p className="pt-4 text-xs">
          © {gym.foundedYear} {gym.name}
        </p>
      </div>
    </footer>
  );
}
