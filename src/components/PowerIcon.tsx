// 전원 버튼 모양 아이콘. 로그인/로그아웃 버튼에서 같이 씁니다.
// aria-hidden = 화면 낭독기는 아이콘 대신 버튼의 aria-label을 읽습니다.
export default function PowerIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3v9" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  );
}
