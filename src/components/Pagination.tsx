// 페이지 이동 줄: [이전] 1 2 3 … 10 [다음] + "총 N명". 각 페이지는 링크라서 주소(?page=)가 바뀌고, 새로고침/북마크해도 같은 페이지가 열립니다.
import Link from "next/link";

type PaginationProps = {
  page: number; // 현재 페이지 (1부터)
  totalPages: number;
  totalCount: number;
  pageHref: (page: number) => string; // 페이지 번호 → 이동할 주소
  unit?: string; // "명", "건" 등
};

// 보여줄 페이지 번호: 처음, 끝, 현재 주변 ±2. 건너뛴 곳은 "…"(null)로 표시합니다. 예: 1 … 4 5 [6] 7 8 … 20
function pageItems(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 1 && p <= totalPages) {
      wanted.add(p);
    }
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];
  for (const p of sorted) {
    const last = items[items.length - 1];
    if (typeof last === "number" && p - last > 1) {
      items.push(null);
    }
    items.push(p);
  }
  return items;
}

const baseClass = "flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-bold";

export default function Pagination({ page, totalPages, totalCount, pageHref, unit = "명" }: PaginationProps) {
  if (totalPages <= 1) {
    return <p className="text-center text-sm text-muted">총 {totalCount}{unit}</p>;
  }

  return (
    <nav aria-label="페이지 이동" className="space-y-2">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={`${baseClass} border-line hover:bg-surface`}>
              이전
            </Link>
          ) : (
            <span aria-disabled="true" className={`${baseClass} border-line text-muted/50`}>
              이전
            </span>
          )}
        </li>
        {pageItems(page, totalPages).map((item, index) => (
          <li key={item ?? `gap-${index}`}>
            {item === null ? (
              <span aria-hidden="true" className="px-1 text-muted">
                …
              </span>
            ) : (
              <Link
                href={pageHref(item)}
                aria-current={item === page ? "page" : undefined}
                className={`${baseClass} ${item === page ? "border-accent bg-accent text-white" : "border-line hover:bg-surface"}`}
              >
                {item}
              </Link>
            )}
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={`${baseClass} border-line hover:bg-surface`}>
              다음
            </Link>
          ) : (
            <span aria-disabled="true" className={`${baseClass} border-line text-muted/50`}>
              다음
            </span>
          )}
        </li>
      </ul>
      <p className="text-center text-sm text-muted">
        총 {totalCount}{unit} · {page} / {totalPages} 페이지
      </p>
    </nav>
  );
}
