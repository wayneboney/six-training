-- =========================================================
-- 9-8) 월간 MVP (한 달 출석 일수가 가장 많은 회원)
--
--   "출석"은 수업 횟수가 아니라 "출석한 날"입니다. 하루에 수업을 3번 들어도 그날은 1일로 셉니다.
--   매달 마지막 날이 끝나면(= 다음 달 1일 0시부터) 지난달 출석이 가장 많은 회원에게 "MVP" 딱지가 붙고, 그 달 내내 유지됩니다.
--   (지난달 기록은 더 바뀌지 않으므로 따로 계산해 저장하지 않고, 보여줄 때 지난달 기록으로 바로 계산합니다.)
--   딱지는 예약 화면(예약자 목록, 상단 안내), 관리자 회원 목록에 나옵니다.
--
--   출석으로 세는 것
--     - 예약 상태가 "예약(confirmed)"이고, 수업 시작 시각이 이미 지난 것 (대기/취소는 제외, 시작 전인 오늘 수업도 제외)
--     - 회원만 (드랍인/체험 게스트와 관리자 계정은 제외), 코치 트레이닝 수업은 제외
--     - 한 달 = 한국 시간 기준 그 달 1일 ~ 말일
--   동점이면 공동 MVP로 모두 나옵니다. 출석이 0일이면 아무도 나오지 않습니다.
--   회원에게는 이름, 프로필 사진, 출석 일수만 보여 줍니다. (회원권이 유효한 회원만 호출 가능)
--
--   ⚠️ 수업을 삭제하면 그 수업의 예약 기록도 지워지므로, 그 출석도 함께 빠집니다.
--
--   바뀌는 것
--     - monthly_mvp_core(달): 계산 본체 (DB 안에서만 사용)
--     - get_monthly_mvp(달): 예약 화면 상단 안내용
--     - admin_last_month_mvp(): 관리자 회원 목록의 딱지용 (회원 번호 + 출석 일수)
--     - get_class_attendees: is_mvp 컬럼 추가 (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   순서: 코드와 SQL 중 어느 쪽을 먼저 반영해도 사이트가 깨지지 않습니다. (SQL 전에는 MVP 칸만 안 보입니다)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 계산 본체: 그 달 출석 일수가 가장 많은 회원(공동 포함)
create or replace function public.monthly_mvp_core(p_month date)
returns table (user_id uuid, attend_days integer)
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
  )
  select a.user_id, a.days from attend a where a.days = (select max(days) from attend);
$$;

revoke execute on function public.monthly_mvp_core(date) from public, anon, authenticated;


-- 2) 회원용: 지정한 달의 MVP (이름, 사진, 출석 일수)
create or replace function public.get_monthly_mvp(p_month date)
returns table (name text, avatar_url text, attend_days integer)
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
  select p.name, p.avatar_url, c.attend_days
    from public.monthly_mvp_core(p_month) c
    join public.profiles p on p.user_id = c.user_id
   order by p.name;
end;
$$;

revoke execute on function public.get_monthly_mvp(date) from public, anon;
grant execute on function public.get_monthly_mvp(date) to authenticated;


-- 3) 관리자용: 지난달 MVP의 회원 번호 (회원 목록 딱지용)
create or replace function public.admin_last_month_mvp()
returns table (user_id uuid, attend_days integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select c.user_id, c.attend_days
    from public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) c;
end;
$$;

revoke execute on function public.admin_last_month_mvp() from public, anon;
grant execute on function public.admin_last_month_mvp() to authenticated;


-- 4) 수업 예약자 보기: 지난달 MVP 회원에게 is_mvp 표시 (나머지는 9-3과 같음)
drop function if exists public.get_class_attendees(date, date);

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
  is_mvp         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := public.is_admin();
  mvp_ids uuid[];
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

  select coalesce(array_agg(c.user_id), '{}')
    into mvp_ids
    from public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) c;

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
    (r.user_id is not null and r.user_id = any (mvp_ids))
  from public.reservations r
  left join public.profiles p on p.user_id = r.user_id
  left join public.codes gc on gc.group_code = r.guest_type_group and gc.code = r.guest_type
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;
