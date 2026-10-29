import Link from "next/link";
import { wodTypeStyles } from "@/components/wod/wodTypeStyles";
import { wodTypeLabels, type Wod } from "@/data/wods";
import { formatDateKey, parseDateKey } from "@/lib/date";

type WodDetailProps = {
  date: string | null; // 선택한 날짜. 아직 선택 전이면 null
  wods: Wod[]; // 그날의 Program 목록
  holiday?: string; // 공휴일이면 그 이름
  isAdmin?: boolean; // 관리자면 수정/등록 바로가기 버튼을 보여줌
};

// WodDetail = 달력에서 선택한 날짜의 Program 내용
// 버튼은 화면 표시용일 뿐이고, 실제 수정 권한은 관리자 화면과 DB(RLS)에서 다시 확인합니다.
export default function WodDetail({ date, wods, holiday, isAdmin = false }: WodDetailProps) {
  if (!date) {
    return <aside className="rounded-lg bg-surface p-6 text-muted">날짜를 선택해 주세요.</aside>;
  }

  const { year, month, day } = parseDateKey(date);
  const isSunday = new Date(year, month, day).getDay() === 0;

  return (
    <aside className="space-y-4">
      <h3 className="text-lg font-black">
        {formatDateKey(date)}
        {holiday && (
          <span className="ml-2 rounded bg-accent px-2 py-0.5 align-middle text-xs font-bold text-white">{holiday}</span>
        )}
      </h3>

      {wods.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-muted">
          {isSunday ? "일요일은 휴무입니다." : "등록된 Program이 없습니다."}
        </p>
      ) : (
        wods.map((wod) => (
          <article key={wod.id} className="rounded-lg border border-line p-5">
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-bold text-white ${wodTypeStyles[wod.type].color}`}
            >
              {wodTypeLabels[wod.type]}
            </span>
            <h4 className="mt-2 text-xl font-black">{wod.title}</h4>
            <p className="mt-1 text-sm font-bold text-accent">{wod.format}</p>

            {/* 동작 목록. ol = 순서가 있는 목록
                key에 순서 번호(index)를 함께 넣습니다. 같은 동작이 한 Program에 두 번 나올 수 있어서
                (예: 처음과 마지막에 Run 400m) 이름만으로는 key가 겹치기 때문입니다. */}
            <ol className="mt-3 space-y-1">
              {wod.movements.map((movement, index) => (
                <li key={`${index}-${movement}`} className="border-l-2 border-line pl-3">
                  {movement}
                </li>
              ))}
            </ol>

            {wod.note && <p className="mt-3 rounded bg-surface p-3 text-sm text-muted">💬 {wod.note}</p>}

            {isAdmin && (
              <Link
                href={`/admin/programs/${wod.id}`}
                className="mt-4 inline-block rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface"
              >
                수정
              </Link>
            )}
          </article>
        ))
      )}

      {isAdmin && (
        <Link
          href={`/admin/programs/new?date=${date}`}
          className="block rounded-lg border border-dashed border-accent p-3 text-center text-sm font-bold text-accent hover:bg-accent-soft"
        >
          + 이 날짜에 Program 등록
        </Link>
      )}
    </aside>
  );
}
