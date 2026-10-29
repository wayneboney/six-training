// 페이지 이동 줄: 페이지 번호는 한 번에 5개씩 보여줍니다. 예: ‹ 1 2 3 4 5 ›
//   5페이지를 넘으면 양쪽에 화살표가 생기고, ›를 누르면 다음 5개(6~10), ‹를 누르면 이전 5개로 넘어갑니다.
//   5페이지 이하이면 화살표 없이 번호만 보입니다. (페이지가 1개뿐이어도 "1"은 보입니다)
// 각 페이지는 링크라서 주소(?page=)가 바뀌고, 새로고침/북마크해도 같은 페이지가 열립니다.
import Link from "next/link";

const VISIBLE_PAGES = 5; // 한 번에 보여줄 페이지 번호 개수

type PaginationProps = {
  page: number; // 현재 페이지 (1부터)
  totalPages: number;
  pageHref: (page: number) => string; // 페이지 번호 → 이동할 주소
};

const baseClass = "flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-bold";

export default function Pagination({ page, totalPages, pageHref }: PaginationProps) {
  // 현재 페이지가 속한 묶음: 1~5는 0번, 6~10은 1번 ...
  const group = Math.floor((page - 1) / VISIBLE_PAGES);
  const first = group * VISIBLE_PAGES + 1;
  const last = Math.min(first + VISIBLE_PAGES - 1, totalPages);
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  const showArrows = totalPages > VISIBLE_PAGES;
  const prevTarget = first - 1; // 이전 묶음의 마지막 페이지 (없으면 0)
  const nextTarget = last + 1; // 다음 묶음의 첫 페이지

  return (
    <nav aria-label="페이지 이동">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {showArrows && (
          <li>
            {prevTarget >= 1 ? (
              <Link href={pageHref(prevTarget)} aria-label={`이전 ${VISIBLE_PAGES}페이지`} className={`${baseClass} border-line hover:bg-surface`}>
                ‹
              </Link>
            ) : (
              <span aria-hidden="true" className={`${baseClass} border-line text-muted/40`}>
                ‹
              </span>
            )}
          </li>
        )}
        {numbers.map((n) => (
          <li key={n}>
            <Link
              href={pageHref(n)}
              aria-current={n === page ? "page" : undefined}
              className={`${baseClass} ${n === page ? "border-accent bg-accent text-white" : "border-line hover:bg-surface"}`}
            >
              {n}
            </Link>
          </li>
        ))}
        {showArrows && (
          <li>
            {nextTarget <= totalPages ? (
              <Link href={pageHref(nextTarget)} aria-label={`다음 ${VISIBLE_PAGES}페이지`} className={`${baseClass} border-line hover:bg-surface`}>
                ›
              </Link>
            ) : (
              <span aria-hidden="true" className={`${baseClass} border-line text-muted/40`}>
                ›
              </span>
            )}
          </li>
        )}
      </ul>
    </nav>
  );
}
