-- =========================================================
-- 9-18) 내 정보: 내가 출석한 날짜 목록
--
--   로그인한 회원 본인의 출석한 날짜를 최근순으로 돌려줍니다. (남의 출석은 볼 수 없음)
--   p_limit: 최대 개수 (기본 120일, 최대 500일). 전체 출석 일수는 get_my_attendance가 알려 줍니다.
--
--   ⚠️ 순서: 코드와 SQL 중 어느 쪽을 먼저 반영해도 사이트가 깨지지 않습니다. (SQL 전에는 날짜 목록만 비어 보입니다)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

create or replace function public.get_my_attendance_dates(p_limit integer default 120)
returns table (attend_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  return query
  select a.attend_date
    from public.attendances a
   where a.user_id = auth.uid()
   order by a.attend_date desc
   limit greatest(1, least(coalesce(p_limit, 120), 500));
end;
$$;

revoke execute on function public.get_my_attendance_dates(integer) from public, anon;
grant execute on function public.get_my_attendance_dates(integer) to authenticated;
