-- =========================================================
-- 9-9) 월간 MVP를 1위 1명에서 "1~3위 금/은/동"으로 확장
--
--   9-8의 월간 MVP를 확장합니다. 지난달 출석 일수(하루에 수업을 몇 번 들어도 1일) 기준 1~3위에게 🥇🥈🥉 마크가 붙습니다.
--   매달 1일 0시부터 그 달 내내 유지됩니다. (지난달 기록은 더 바뀌지 않으므로 보여줄 때 바로 계산)
--
--   순위 규칙 (동점이면 같은 순위, 다음 순위는 건너뜀: 1위 2명 → 다음은 3위)
--     예) 출석 12, 12, 10, 9일 → 🥇 2명, 🥉 1명(10일), 9일은 순위 밖
--   출석 0일은 순위에 없습니다. 출석으로 세는 것(예약 상태 "예약", 시작 시각이 지난 수업, 회원만, 코치 트레이닝 제외)은 9-8과 같습니다.
--
--   바뀌는 것 (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--     - monthly_mvp_core / get_monthly_mvp / admin_last_month_mvp: mvp_rank(1~3) 컬럼 추가, 3위까지 돌려줌
--     - get_class_attendees: is_mvp 대신 mvp_rank 컬럼 (1~3, 순위 밖이면 비어 있음)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

drop function if exists public.get_class_attendees(date, date);
drop function if exists public.get_monthly_mvp(date);
drop function if exists public.admin_last_month_mvp();
drop function if exists public.monthly_mvp_core(date);


-- 1) 계산 본체: 그 달 출석 일수 1~3위 (동점이면 같은 순위)
create function public.monthly_mvp_core(p_month date)
returns table (user_id uuid, attend_days integer, mvp_rank integer)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as month_start,
           (date_trunc('month', p_month) + interval '1 month')::date as month_end
  ),
  attend as (
    select r.user_id, count(distinct r.class_date)::integer as days
      from public.reservations r
      join public.class_slots s on s.id = r.slot_id
      join public.profiles p on p.user_id = r.user_id and p.role = 'member'
      cross join bounds b
     where r.status = 'confirmed'
       and r.user_id is not null
       and s.class_type <> 'COACH_TRAINING'
       and r.class_date >= b.month_start and r.class_date < b.month_end
       and public.class_start_at(r.slot_id, r.class_date) <= now()
     group by r.user_id
  ),
  ranked as (
    select a.user_id, a.days, (rank() over (order by a.days desc))::integer as rnk
      from attend a
  )
  select ranked.user_id, ranked.days, ranked.rnk from ranked where ranked.rnk <= 3;
$$;

revoke execute on function public.monthly_mvp_core(date) from public, anon, authenticated;


-- 2) 회원용: 지정한 달의 1~3위 (이름, 사진, 출석 일수, 순위)
create function public.get_monthly_mvp(p_month date)
returns table (name text, avatar_url text, attend_days integer, mvp_rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not public.can_view_member_content() then
    raise exception '회원권이 유효한 회원만 이용할 수 있습니다.' using errcode = 'MB004';
  end if;
  if p_month is null then
    raise exception '조회할 달이 올바르지 않습니다.' using errcode = 'MB004';
  end if;

  return query
  select p.name, p.avatar_url, c.attend_days, c.mvp_rank
    from public.monthly_mvp_core(p_month) c
    join public.profiles p on p.user_id = c.user_id
   order by c.mvp_rank, p.name;
end;
$$;

revoke execute on function public.get_monthly_mvp(date) from public, anon;
grant execute on function public.get_monthly_mvp(date) to authenticated;


-- 3) 관리자용: 지난달 1~3위의 회원 번호 (회원 목록 마크용)
create function public.admin_last_month_mvp()
returns table (user_id uuid, attend_days integer, mvp_rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select c.user_id, c.attend_days, c.mvp_rank
    from public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) c;
end;
$$;

revoke execute on function public.admin_last_month_mvp() from public, anon;
grant execute on function public.admin_last_month_mvp() to authenticated;


-- 4) 수업 예약자 보기: 지난달 1~3위 회원에게 mvp_rank 표시 (나머지는 9-8과 같음)
create function public.get_class_attendees(p_from date, p_to date)
returns table (
  slot_id        bigint,
  class_date     date,
  status         text,
  queue_no       integer,
  name           text,
  avatar_url     text,
  is_me          boolean,
  reservation_id bigint,
  guest_label    text,
  mvp_rank       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not public.can_view_member_content() then
    raise exception '회원권이 유효한 회원만 이용할 수 있습니다.' using errcode = 'MB004';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 14 then
    raise exception '조회 기간이 올바르지 않습니다. (최대 15일)' using errcode = 'MB004';
  end if;

  return query
  select
    r.slot_id,
    r.class_date,
    r.status,
    (row_number() over (partition by r.slot_id, r.class_date, r.status order by r.id))::integer,
    coalesce(p.name, r.guest_name),
    p.avatar_url,
    (r.user_id is not null and r.user_id = auth.uid()),
    case when caller_is_admin then r.id end,
    gc.name,
    m.mvp_rank
  from public.reservations r
  left join public.profiles p on p.user_id = r.user_id
  left join public.codes gc on gc.group_code = r.guest_type_group and gc.code = r.guest_type
  left join public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) m
         on m.user_id = r.user_id
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;
