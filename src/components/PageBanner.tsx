// 페이지 맨 위 제목 영역(배너): 회색 배경 + 작은 영문 문구 + 큰 제목 + 설명. 홈 화면을 뺀 모든 페이지(관리자 포함)가 똑같은 크기와 모양을 씁니다.
// 크기를 바꾸려면 이 파일 한 곳만 고치면 모든 페이지에 같이 적용됩니다. (화면마다 크기를 다르게 하는 옵션은 일부러 두지 않았습니다)
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
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm font-bold tracking-widest text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-muted">{description}</p>}
      </div>
    </div>
  );
}
