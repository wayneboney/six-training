-- =========================================================
-- 9-11) 출석을 관리자가 직접 누르기 (+ 수업이 끝나면 자동 출석)
--
--   9-10은 "시작한 수업의 예약"을 자동으로 출석으로 셌습니다. 이제는 이렇게 바뀝니다.
--     1) 관리자가 수업 예약 화면의 예약자 옆 [출석] 버튼을 눌러서 출석 처리합니다.
--     2) 관리자가 누르지 못해도, 수업 종료 시각이 지나면 그 수업의 예약자(예약 상태)는 자동으로 출석 처리됩니다.
--          (6:45~7:45 수업이면 7:45가 지난 뒤 10분 간격으로 점검해서 처리. 종료 시각을 정하지 않은 수업은 시작 1시간 뒤)
--        그래서 수업이 끝난 뒤에 회원이 "안 온 사람"이 되려면 관리자가 끝나기 전에 예약을 취소해야 합니다.
--     3) 출석 일수는 줄어들지 않습니다. 한 번 출석으로 기록되면 수업이나 예약을 지워도 그대로입니다.
--          단 관리자가 실수로 누른 경우를 위해, 수업이 끝나기 전까지는 [출석 취소]로 되돌릴 수 있습니다.
--
--   규칙
--     - 출석 단위는 "날" (하루에 수업을 3번 들어도 1일). 같은 날 여러 수업을 출석 처리하면 그 횟수를 같이 기억해서,
--       하나를 취소해도 다른 수업의 출석이 남아 있으면 그날은 그대로 출석입니다.
--     - 출석 처리 대상: 예약 상태 "예약"인 회원 (대기, 취소, 드랍인/체험 게스트, 코치 트레이닝은 제외)
--     - 수업이 시작된 뒤부터 출석 처리할 수 있습니다.
--     - 월간 MVP, 내 출석, 관리자 출석 일수는 이 기록(attendances 표)만 봅니다.
--
--   바뀌는 것
--     - reservations.attended_at (출석 처리한 시각), attendances.class_count (그날 출석 처리한 수업 수)
--     - admin_mark_attendance / admin_unmark_attendance: 관리자 출석 / 출석 취소
--     - record_attendance(): 이제 "끝난 수업 자동 출석" (10분마다 자동 실행, 수업 삭제 직전에도 실행)
--     - get_class_attendees: 관리자에게만 attended(출석 처리됨) 컬럼 추가 (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   지금까지 시작한 수업의 예약은 이미 9-10에서 출석으로 기록되어 있으므로, "출석 처리됨"으로 표시만 해 둡니다.
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 컬럼 추가
alter table public.reservations add column if not exists attended_at timestamptz;
alter table public.attendances  add column if not exists class_count integer not null default 1 check (class_count >= 1);

comment on column public.reservations.attended_at is '출석 처리한 시각 (관리자가 누르거나 수업 종료 후 자동). 비어 있으면 아직 출석 처리 전';
comment on column public.attendances.class_count is '그날 출석 처리된 수업 수 (출석 취소 시 하나씩 줄이고, 0이 되면 그날 출석을 지움)';


-- 2) 지금까지 시작한 수업은 9-10의 방식으로 마지막으로 한 번 기록하고, 예약에 "출석 처리됨"으로 표시
--    (이미 새 방식으로 바뀐 뒤 다시 실행해도 안전: 이미 표시된 것은 건너뜀)
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'reservations' and column_name = 'attended_at')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'attendance_days'
                    and pg_get_functiondef(p.oid) like '%public.reservations%') then
    perform public.record_attendance();   -- 9-10 방식 (예약에서 계산해서 기록)
  end if;
end
$$;

update public.reservations r
   set attended_at = public.class_start_at(r.slot_id, r.class_date)
  from public.class_slots s, public.profiles p
 where s.id = r.slot_id
   and p.user_id = r.user_id and p.role = 'member'
   and r.status = 'confirmed'
   and r.attended_at is null
   and s.class_type <> 'COACH_TRAINING'
   and public.class_start_at(r.slot_id, r.class_date) <= now();


-- 3) 출석한 날 목록: 이제 보관된 출석 기록만 (날짜는 [p_from, p_to) 범위, DB 안에서만 사용)
create or replace function public.attendance_days(p_from date, p_to date)
returns table (user_id uuid, attend_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.attend_date
    from public.attendances a
   where a.attend_date >= p_from and a.attend_date < p_to;
$$;

revoke execute on function public.attendance_days(date, date) from public, anon, authenticated;


-- 4) 자동 출석: 종료 시각이 지난 수업의 예약자 중 아직 출석 처리되지 않은 사람을 출석으로 기록. 돌려주는 값: 처리한 예약 수
create or replace function public.record_attendance()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked integer;
begin
  with due as (
    select r.id
      from public.reservations r
      join public.class_slots s on s.id = r.slot_id
      join public.profiles p on p.user_id = r.user_id and p.role = 'member'
     where r.status = 'confirmed'
       and r.attended_at is null
       and s.class_type <> 'COACH_TRAINING'
       and ((r.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul') <= now()
     for update of r
  ),
  upd as (
    update public.reservations r
       set attended_at = now()
      from due
     where r.id = due.id
    returning r.user_id, r.class_date
  ),
  per_day as (
    select u.user_id, u.class_date, count(*)::integer as n from upd u group by u.user_id, u.class_date
  ),
  ins as (
    insert into public.attendances (user_id, attend_date, class_count)
    select d.user_id, d.class_date, d.n from per_day d
    on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + excluded.class_count
    returning 1
  )
  select count(*)::integer into marked from upd;
  return marked;
end;
$$;

revoke execute on function public.record_attendance() from public, anon, authenticated;


-- 5) 관리자: 출석 처리 (수업이 시작된 뒤부터)
create or replace function public.admin_mark_attendance(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ctype text;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.status <> 'confirmed' then
    raise exception '출석 처리할 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if res.user_id is null then
    raise exception '드랍인/체험은 출석 일수를 기록하지 않습니다.' using errcode = 'MB004';
  end if;
  select class_type into ctype from public.class_slots where id = res.slot_id;
  if ctype = 'COACH_TRAINING' then
    raise exception '코치 트레이닝은 출석 일수에 포함되지 않습니다.' using errcode = 'MB004';
  end if;
  if public.class_start_at(res.slot_id, res.class_date) > now() then
    raise exception '수업이 시작된 뒤에 출석 처리할 수 있습니다.' using errcode = 'MB012';
  end if;
  if res.attended_at is not null then
    return;                                  -- 이미 출석 처리됨 (두 번 눌러도 한 번만)
  end if;

  update public.reservations set attended_at = now() where id = res.id;
  insert into public.attendances (user_id, attend_date, class_count)
  values (res.user_id, res.class_date, 1)
  on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + 1;
end;
$$;

revoke execute on function public.admin_mark_attendance(bigint) from public, anon;
grant execute on function public.admin_mark_attendance(bigint) to authenticated;


-- 6) 관리자: 출석 취소 (수업이 끝나기 전까지만. 실수로 누른 경우)
create or replace function public.admin_unmark_attendance(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ends_at timestamptz;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.attended_at is null then
    raise exception '출석 처리된 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  select ((res.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul')
    into ends_at
    from public.class_slots s where s.id = res.slot_id;
  if ends_at <= now() then
    raise exception '수업이 끝난 뒤에는 출석을 취소할 수 없습니다. (출석 일수는 줄어들지 않습니다)' using errcode = 'MB004';
  end if;

  update public.reservations set attended_at = null where id = res.id;
  -- 그날 출석 처리된 수업이 이것 하나뿐이면 그날 출석을 지우고, 더 있으면 수업 수만 하나 줄임
  delete from public.attendances
   where user_id = res.user_id and attend_date = res.class_date and class_count <= 1;
  update public.attendances
     set class_count = class_count - 1
   where user_id = res.user_id and attend_date = res.class_date;
end;
$$;

revoke execute on function public.admin_unmark_attendance(bigint) from public, anon;
grant execute on function public.admin_unmark_attendance(bigint) to authenticated;


-- 7) 수업 예약자 보기: 관리자에게만 attended(출석 처리됨) 추가 (나머지는 9-9와 같음)
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
  mvp_rank       integer,
  attended       boolean
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
    m.mvp_rank,
    case when caller_is_admin then (r.attended_at is not null) end
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


-- 8) 자동 출석을 10분마다 실행 (9-10의 매시간 예약을 바꿈)
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '자동 출석 예약 실패: 이 데이터베이스에서 pg_cron을 사용할 수 없습니다. Database → Extensions에서 확인해 주세요.';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.unschedule(jobid) from cron.job where jobname = 'record-attendance';
  perform cron.schedule('record-attendance', '*/10 * * * *', 'select public.record_attendance()');
exception when others then
  raise notice '자동 출석 예약 실패: %. Database → Extensions에서 pg_cron을 켠 뒤 다시 실행해 주세요.', sqlerrm;
end;
$$;
