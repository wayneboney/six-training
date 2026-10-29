// 출석 일수 한 줄 요약: 이번 달 / 지난달 / 전체. (하루에 수업을 여러 번 들어도 1일)
import type { AttendanceCount } from "@/lib/attendance/repository";

export default function AttendanceStats({ count }: { count: AttendanceCount }) {
  return (
    <p className="text-sm">
      <span className="text-muted">출석 </span>
      이번 달 <b>{count.thisMonth}일</b>
      <span className="text-muted"> · </span>
      지난달 <b>{count.lastMonth}일</b>
      <span className="text-muted"> · </span>
      전체 <b>{count.total}일</b>
    </p>
  );
}
