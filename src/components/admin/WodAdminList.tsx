import Link from "next/link";
import { wodTypeStyles } from "@/components/wod/wodTypeStyles";
import { wodTypeLabels, type Wod } from "@/data/wods";
import { formatDateKey } from "@/lib/date";

type WodAdminListProps = {
  wods: Wod[]; // 한 달치 WOD (날짜순으로 정렬된 상태)
};

// 관리자용 WOD 목록. 날짜별로 묶어서 보여줍니다.
// 삭제 버튼은 실수로 누르지 않도록 목록에 두지 않고, 수정 화면 맨 아래에 있습니다.
export default function WodAdminList({ wods }: WodAdminListProps) {
  if (wods.length === 0) {
    return <p className="rounded-lg bg-surface p-8 text-center text-muted">이 달에 등록된 WOD가 없습니다.</p>;
  }

  // 날짜별로 묶기: [["2026-10-26", [Wod]], ["2026-10-27", [Wod, Wod]], ...]
  // 입력이 이미 날짜순이라 Map에 넣은 순서 그대로 날짜순이 유지됩니다.
  const groups = new Map<string, Wod[]>();
  for (const wod of wods) {
    groups.set(wod.date, [...(groups.get(wod.date) ?? []), wod]);
  }

  return (
    <div className="space-y-6">
      {[...groups].map(([date, dayWods]) => (
        <section key={date}>
          <h3 className="mb-2 text-sm font-bold text-muted">{formatDateKey(date)}</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {dayWods.map((wod) => (
              <li key={wod.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <span
                  className={`w-fit shrink-0 rounded px-2 py-0.5 text-xs font-bold text-white ${wodTypeStyles[wod.type].color}`}
                >
                  {wodTypeLabels[wod.type]}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {wod.title}
                    <span className="ml-2 text-sm font-normal text-accent">{wod.format}</span>
                  </p>
                  {/* truncate = 한 줄을 넘으면 … 으로 줄임. 목록에서는 요약만 보여줍니다 */}
                  <p className="truncate text-sm text-muted">{wod.movements.join(" · ")}</p>
                </div>

                {wod.note && <span className="shrink-0 text-xs text-muted">💬 메모 있음</span>}

                <Link
                  href={`/admin/wods/${wod.id}`}
                  className="w-fit shrink-0 rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface"
                >
                  수정
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
