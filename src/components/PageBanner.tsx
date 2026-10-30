// 페이지 맨 위 제목 영역(배너): 회색 배경 + 작은 영문 문구 + 큰 제목 + 설명. 홈 화면을 뺀 모든 페이지(관리자 포함)가 똑같은 크기와 모양을 씁니다.
// 높이는 고정입니다. 크기를 바꾸려면 이 파일 한 곳만 고치면 모든 페이지에 같이 적용됩니다. (화면마다 크기를 다르게 하는 옵션은 일부러 두지 않았습니다)
export default function PageBanner({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-line bg-surface">
      {/* 높이를 고정해서 설명 글이 길거나 없어도 모든 페이지의 배너 높이와 제목 위치가 똑같습니다. (설명이 너무 길면 3줄까지만 보임) */}
      <div className="mx-auto h-60 max-w-5xl overflow-hidden px-4 pt-12 sm:h-64 sm:pt-14">
        <p className="text-sm font-bold tracking-widest text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 line-clamp-3 max-w-2xl text-muted">{description}</p>}
      </div>
    </div>
  );
}
