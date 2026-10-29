-- =========================================================
-- 9-17) 관리자 회원 상세: 출석한 날짜 목록
--
--   회원 한 명의 출석한 날짜를 최근순으로 돌려줍니다. (관리자만 호출 가능)
--   p_limit: 최대 개수 (기본 120일, 최대 500일). 전체 출석 일수는 admin_attendance_summary가 알려 줍니다.
--
--   ⚠️ 순서: 코드와 SQL 중 어느 쪽을 먼저 반영해도 사이트가 깨지지 않습니다. (SQL 전에는 날짜 목록만 비어 보입니다)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

create or replace function public.admin_member_attendance_dates(p_user_id uuid, p_limit integer default 120)
returns table (attend_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_user_id is null then
    raise exception '회원을 선택해 주세요.' using errcode = 'MB004';
  end if;

  return query
  select a.attend_date
    from public.attendances a
   where a.user_id = p_user_id
   order by a.attend_date desc
   limit greatest(1, least(coalesce(p_limit, 120), 500));
end;
$$;

revoke execute on function public.admin_member_attendance_dates(uuid, integer) from public, anon;
grant execute on function public.admin_member_attendance_dates(uuid, integer) to authenticated;
