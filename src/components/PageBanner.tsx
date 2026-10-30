// 페이지 맨 위 제목 영역(배너): 회색 배경 + 작은 영문 문구 + 큰 제목 + 설명. 홈 화면을 뺀 모든 페이지가 같은 모양을 씁니다.
//   compact: 관리자 화면처럼 도구가 많은 곳에서 높이를 줄인 모양
export default function PageBanner({
  eyebrow,
  title,
  description,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <div className={`mx-auto max-w-5xl px-4 ${compact ? "py-8" : "py-16"}`}>
        <p className="text-sm font-bold tracking-widest text-accent">{eyebrow}</p>
        <h1 className={`mt-2 font-black ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}>{title}</h1>
        {description && <p className={`max-w-2xl text-muted ${compact ? "mt-2 text-sm" : "mt-4"}`}>{description}</p>}
      </div>
    </div>
  );
}
