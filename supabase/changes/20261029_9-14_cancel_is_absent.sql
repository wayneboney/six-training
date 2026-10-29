-- =========================================================
-- 9-14) 결석 버튼을 없애고 [취소] 하나로 (취소 = 결석 처리)
--
--   9-12/9-13의 [결석], [결석 취소]는 같은 뜻의 버튼이 둘이라 헷갈려서 없앱니다.
--   이제 예약자 옆 버튼은 [출석]과 [취소] 두 개입니다.
--
--   규칙
--     - [취소]: 예약을 취소합니다. 안 온 회원은 수업이 끝난 뒤 [취소]를 누르면 결석으로 처리되어 출석에 들어가지 않습니다.
--     - 이미 출석으로 기록된 예약(관리자가 [출석]을 눌렀거나 자동 출석된 예약)을 [취소]하면 출석 일수가 1일 줄어듭니다.
--         (같은 날 다른 수업에 출석이 있으면 그날은 그대로 출석)
--     - 출석이 기록된 예약의 [취소]는 수업 당일(한국 시간)에만 됩니다. 하루가 지나면 출석이 확정되어 취소할 수 없습니다.
--     - [출석]은 수업이 시작된 뒤부터 당일에만 누를 수 있습니다. (9-13과 같음)
--     - 수업이 끝난 뒤 10분 안에 자동 출석이 되므로, 안 온 회원은 끝나기 전이나 끝난 직후에 [취소]하는 것이 가장 깔끔합니다.
--         자동 출석이 된 뒤라도 당일이면 [취소]로 출석을 되돌릴 수 있습니다.
--
--   바뀌는 것
--     - admin_cancel_reservation: 출석 처리된 예약이면 출석 기록을 되돌림
--     - admin_mark_absent / admin_unmark_absent 삭제, reservations.absent_at 컬럼 삭제
--       (결석으로 표시만 해 둔 예약이 있다면 취소된 예약으로 바꿉니다)
--     - record_attendance / admin_mark_attendance / get_class_attendees: 결석 관련 부분 제거
--       (get_class_attendees는 결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 결석으로만 표시해 둔 예약은 취소된 예약으로 바꿈 (컬럼을 지우기 전에. 컬럼이 이미 없으면 건너뜀)
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'reservations' and column_name = 'absent_at') then
    execute $q$
      update public.reservations
         set status = 'cancelled', cancelled_at = now(), cancel_reason = 'admin'
       where absent_at is not null and status <> 'cancelled'
    $q$;
  end if;
end
$$;


-- 2) 자동 출석 (결석 조건 제거)
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


-- 3) 관리자 출석 처리 (결석 해제 부분 제거)
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


-- 4) 결석 함수 삭제
drop function if exists public.admin_mark_absent(bigint);
drop function if exists public.admin_unmark_absent(bigint);


-- 5) 관리자 예약 취소: 출석 처리된 예약이면 출석 기록을 되돌림
create or replace function public.admin_cancel_reservation(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservations%rowtype;
begin
  perform public.require_admin();
  select * into r from public.reservations where id = p_reservation_id;
  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if r.status = 'cancelled' then
    raise exception '이미 취소된 예약입니다.' using errcode = 'MB010';
  end if;
  if r.attended_at is not null and r.class_date <> public.seoul_today() then
    raise exception '출석이 확정된 예약은 취소할 수 없습니다. (수업 당일에만 취소할 수 있습니다)' using errcode = 'MB012';
  end if;

  perform public.cancel_reservation_core(p_reservation_id, 'admin');

  -- 출석으로 기록된 예약이었다면 출석을 되돌림
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.attended_at is not null then
    update public.reservations set attended_at = null where id = r.id;
    if exists (
      select 1 from public.reservations o
       where o.user_id = r.user_id and o.class_date = r.class_date
         and o.attended_at is not null and o.id <> r.id
    ) then
      -- 같은 날 출석 처리된 다른 수업이 있으면 그날은 출석 유지 (수업 수만 하나 줄임)
      update public.attendances
         set class_count = greatest(class_count - 1, 1)
       where user_id = r.user_id and attend_date = r.class_date;
    else
      delete from public.attendances where user_id = r.user_id and attend_date = r.class_date;
    end if;
  end if;
end;
$$;

revoke execute on function public.admin_cancel_reservation(bigint) from public, anon;
grant execute on function public.admin_cancel_reservation(bigint) to authenticated;


-- 6) 수업 예약자 보기 (결석 컬럼 제거. 나머지는 9-12와 같음)
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


-- 7) 결석 컬럼 삭제
alter table public.reservations drop column if exists absent_at;
