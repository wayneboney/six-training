-- =========================================================
-- 9-15) 오픈짐과 코치 트레이닝은 출석에서 제외
--
--   출석 일수에 들어가는 수업: 크로스핏, 하이록스. (오픈짐과 코치 트레이닝은 제외. 코치 트레이닝은 원래부터 제외였고 이번에 함께 정리)
--   - 오픈짐/코치 트레이닝 예약에는 [출석] 버튼이 나오지 않고, 수업이 끝나도 자동 출석되지 않습니다.
--   - 이미 오픈짐 예약으로 출석이 기록되어 있다면 그 출석을 되돌립니다.
--       (같은 날 다른 수업에 출석이 있으면 그날은 그대로 출석. 일수는 오픈짐 때문에 올라간 만큼만 줄어듭니다)
--
--   바뀌는 것: record_attendance(자동 출석), admin_mark_attendance(출석 버튼)의 제외 대상에 오픈짐 추가
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 이미 오픈짐/코치 트레이닝으로 기록된 출석 되돌리기
with og as (
  select r.user_id, r.class_date, count(*)::integer as n
    from public.reservations r
    join public.class_slots s on s.id = r.slot_id
   where s.class_type in ('OPEN_GYM', 'COACH_TRAINING') and r.attended_at is not null and r.user_id is not null
   group by r.user_id, r.class_date
),
del as (
  delete from public.attendances a using og
   where a.user_id = og.user_id and a.attend_date = og.class_date and a.class_count <= og.n
  returning 1
),
upd as (
  update public.attendances a set class_count = a.class_count - og.n from og
   where a.user_id = og.user_id and a.attend_date = og.class_date and a.class_count > og.n
  returning 1
)
select (select count(*) from del) as removed_days, (select count(*) from upd) as reduced_days;

update public.reservations r
   set attended_at = null
  from public.class_slots s
 where s.id = r.slot_id and s.class_type in ('OPEN_GYM', 'COACH_TRAINING') and r.attended_at is not null;


-- 2) 자동 출석: 오픈짐 제외
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
       and s.class_type not in ('COACH_TRAINING', 'OPEN_GYM')
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


-- 3) 관리자 출석 처리: 오픈짐 제외
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
  if ctype in ('COACH_TRAINING', 'OPEN_GYM') then
    raise exception '오픈짐과 코치 트레이닝은 출석 일수에 포함되지 않습니다.' using errcode = 'MB004';
  end if;
  if public.class_start_at(res.slot_id, res.class_date) > now() then
    raise exception '수업이 시작된 뒤에 출석 처리할 수 있습니다.' using errcode = 'MB012';
  end if;
  if res.class_date <> public.seoul_today() then
    raise exception '출석은 수업 당일에만 처리할 수 있습니다. (하루가 지나면 출석이 확정됩니다)' using errcode = 'MB012';
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
