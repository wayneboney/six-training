import type { Metadata } from "next";
import WodCalendar from "@/components/wod/WodCalendar";
import { wods } from "@/data/wods";

export const metadata: Metadata = {
  title: "WOD",
};

// /wod 주소의 화면.
// 지금은 src/data/wods.ts 파일에서 WOD를 가져오지만, 나중에 DB를 붙이면 이 파일에서 DB를 조회해서
// 같은 모양의 배열을 <WodCalendar wods={...} />에 넘기기만 하면 됩니다. (Controller가 Service를 호출해 화면에 넘기는 구조와 같음)
export default function WodPage() {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="text-sm font-bold tracking-widest text-accent">WORKOUT OF THE DAY</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">WOD</h1>
          <p className="mt-4 text-muted">날짜를 누르면 그날의 WOD를 볼 수 있습니다.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <WodCalendar wods={wods} />
      </div>
    </>
  );
}
