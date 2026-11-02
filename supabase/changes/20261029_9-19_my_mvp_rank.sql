-- =========================================================
-- 9-19) 내 MVP 순위 (헤더의 내 프로필 사진에 🥇🥈🥉 표시용)
--
--   로그인한 본인의 지난달 MVP 순위(1~3)를 돌려줍니다. 순위 밖이거나 출석이 없으면 비어 있음(null).
--   본인 것만 알려 주고, 다른 회원의 순위는 이 함수로 알 수 없습니다.
--
--   ⚠️ 순서: 코드와 SQL 중 어느 쪽을 먼저 반영해도 사이트가 깨지지 않습니다. (SQL 전에는 헤더에 메달만 안 보입니다)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

create or replace function public.get_my_mvp_rank()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rank_ integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select c.mvp_rank into rank_
    from public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) c
   where c.user_id = auth.uid();
  return rank_;
end;
$$;

revoke execute on function public.get_my_mvp_rank() from public, anon;
grant execute on function public.get_my_mvp_rank() to authenticated;
