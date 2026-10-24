// page.tsx = "/" 주소에 보여줄 화면
// 화면은 "HTML을 return하는 함수"로 만들고, 이 함수를 '컴포넌트'라고 부릅니다.
// export default = 이 파일의 대표 함수를 외부(Next.js)에 공개한다는 뜻입니다.
export default function Home() {
  // const는 Java의 final 변수와 같습니다. 값을 다시 바꿀 수 없습니다.
  const gymName = "SIX Training";

  return (
    // className은 HTML의 class 속성입니다. (JS에서 class는 예약어라 이름이 다릅니다)
    // p-10 = 안쪽 여백, text-4xl = 큰 글씨, font-bold = 굵게 (Tailwind 문법)
    // mx-auto max-w-5xl px-4 = 헤더와 같은 너비, 같은 좌우 여백으로 정렬
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* 중괄호 { } 안에는 JS 값을 넣습니다. JSP의 ${gymName}와 같습니다 */}
      <h1 className="text-4xl font-bold">{gymName}</h1>
      <p className="mt-4 text-lg">어제보다 강한 오늘</p>
    </main>
  );
}
