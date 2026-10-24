import { gym } from "@/data/gym";

// Footer = 모든 페이지 맨 아래에 나오는 체육관 기본 정보
export default function Footer() {
  return (
    <footer className="border-t border-gray-200">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-gray-500">
        <p className="font-bold text-gray-900">{gym.name}</p>
        <p>{gym.contact.address}</p>
        <p>문의 {gym.contact.phone}</p>
        <p className="pt-4 text-xs">
          © {gym.copyrightYear} {gym.name}
        </p>
      </div>
    </footer>
  );
}
