// 소개 페이지의 각 구역(철학, 코치진, 시간표 등)이 같은 제목 스타일과 여백을 쓰도록 묶은 컴포넌트.
// 구역마다 같은 코드를 반복하지 않고, 바꿀 때도 여기 한 곳만 고치면 됩니다.

// props(컴포넌트에 넘기는 값)의 모양. Java의 메서드 파라미터 목록과 같습니다.
type SectionProps = {
  title: string;
  subtitle?: string; // 생략 가능
  children: React.ReactNode; // <Section>...</Section> 사이에 넣은 내용
};

export default function Section({ title, subtitle, children }: SectionProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      {/* subtitle이 있을 때만 표시 */}
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}
