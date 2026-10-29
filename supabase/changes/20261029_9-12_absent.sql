-- =========================================================
-- 9-12) 결석 처리 (관리자가 안 온 회원을 결석으로 표시)
--
--   9-11: 관리자가 [출석]을 누르거나, 안 누르면 수업이 끝난 뒤 자동으로 출석 처리됩니다.
--   추가: 수업이 끝난 뒤에 보니 안 온 회원이 있으면 관리자가 [결석]을 누릅니다.
--
--   규칙
--     - [결석]: 수업이 끝난 뒤부터 누를 수 있습니다. (끝난 날, 며칠이 지난 뒤에도 가능. 수업 중에는 [출석]만 보입니다)
--         이미 출석으로 기록된 회원(자동 출석 포함)을 결석으로 바꾸면 출석 일수가 1일 줄어듭니다.
--         (같은 날 다른 수업에 출석이 있으면 그날은 그대로 출석)
--         결석으로 표시한 예약은 자동 출석 대상에서 빠집니다.
--     - [결석 취소]: 결석으로 표시한 것을 되돌립니다. 수업이 이미 끝났다면 되돌린 즉시 출석으로 기록됩니다.
--         수업이 아직 끝나지 않았으면 "처리 전"으로 돌아가서 끝나면 자동 출석됩니다.
--     - 실수로 [출석]을 눌렀다면 [결석] → [결석 취소]로 처리 전 상태로 되돌릴 수 있어서, 예전 [출석 취소] 버튼은 없앱니다.
--     - 결석을 눌러도 예약 자체는 그대로 남습니다. (정원 계산, 예약 기록은 변하지 않음)
--     - 대기자, 드랍인/체험 게스트, 코치 트레이닝은 출석/결석 대상이 아닙니다.
--
--   바뀌는 것
--     - reservations.absent_at (결석 처리한 시각)
--     - admin_mark_absent / admin_unmark_absent 추가, admin_unmark_attendance 삭제
--     - record_attendance(): 결석 처리된 예약은 건너뜀
--     - admin_mark_attendance(): 결석이던 예약을 출석으로 바꿀 수 있음
--     - get_class_attendees: 관리자에게만 absent(결석 처리됨) 컬럼 추가 (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 컬럼 추가
alter table public.reservations add column if not exists absent_at timestamptz;
comment on column public.reservations.absent_at is '관리자가 결석으로 처리한 시각. 비어 있으면 결석 아님 (출석은 attended_at)';


-- 2) 자동 출석: 결석 처리된 예약은 건너뜀 (9-11과 같고 조건 한 줄만 추가)
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
       and r.absent_at is null
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


-- 3) 관리자: 출석 처리 (결석으로 표시되어 있었다면 출석으로 바꿈)
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

  update public.reservations set attended_at = now(), absent_at = null where id = res.id;
  insert into public.attendances (user_id, attend_date, class_count)
  values (res.user_id, res.class_date, 1)
  on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + 1;
end;
$$;

revoke execute on function public.admin_mark_attendance(bigint) from public, anon;
grant execute on function public.admin_mark_attendance(bigint) to authenticated;


-- 4) 관리자: 결석 처리 (수업이 끝난 뒤부터 언제든). 이미 출석으로 기록된 예약이면 출석 일수가 1일 줄어듦
create or replace function public.admin_mark_absent(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ctype text;
  was_attended boolean;
  ends_at timestamptz;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.status <> 'confirmed' then
    raise exception '결석 처리할 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if res.user_id is null then
    raise exception '드랍인/체험은 출석 일수를 기록하지 않습니다.' using errcode = 'MB004';
  end if;
  select class_type into ctype from public.class_slots where id = res.slot_id;
  if ctype = 'COACH_TRAINING' then
    raise exception '코치 트레이닝은 출석 일수에 포함되지 않습니다.' using errcode = 'MB004';
  end if;
  select ((res.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul')
    into ends_at
    from public.class_slots s where s.id = res.slot_id;
  if ends_at > now() then
    raise exception '수업이 끝난 뒤에 결석 처리할 수 있습니다.' using errcode = 'MB012';
  end if;
  if res.absent_at is not null then
    return;                                  -- 이미 결석 처리됨
  end if;

  was_attended := res.attended_at is not null;
  update public.reservations set absent_at = now(), attended_at = null where id = res.id;

  if was_attended then
    -- 같은 날 출석 처리된 다른 수업이 있으면 그날은 출석 유지(수업 수만 하나 줄임), 없으면 그날 출석을 지움
    if exists (
      select 1 from public.reservations o
       where o.user_id = res.user_id and o.class_date = res.class_date
         and o.attended_at is not null and o.id <> res.id
    ) then
      update public.attendances
         set class_count = greatest(class_count - 1, 1)
       where user_id = res.user_id and attend_date = res.class_date;
    else
      delete from public.attendances where user_id = res.user_id and attend_date = res.class_date;
    end if;
  end if;
end;
$$;

revoke execute on function public.admin_mark_absent(bigint) from public, anon;
grant execute on function public.admin_mark_absent(bigint) to authenticated;


-- 5) 관리자: 결석 취소. 수업이 이미 끝났으면 출석으로 기록, 아직이면 "처리 전"으로 돌아감 (끝나면 자동 출석)
create or replace function public.admin_unmark_absent(p_reservation_id bigint)
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
  if not found or res.absent_at is null then
    raise exception '결석 처리된 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  update public.reservations set absent_at = null where id = res.id;

  select ((res.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul')
    into ends_at
    from public.class_slots s where s.id = res.slot_id;

  if ends_at <= now() and res.status = 'confirmed' and res.user_id is not null then
    update public.reservations set attended_at = now() where id = res.id;
    insert into public.attendances (user_id, attend_date, class_count)
    values (res.user_id, res.class_date, 1)
    on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + 1;
  end if;
end;
$$;

revoke execute on function public.admin_unmark_absent(bigint) from public, anon;
grant execute on function public.admin_unmark_absent(bigint) to authenticated;


-- 6) 예전 [출석 취소]는 결석 → 결석 취소로 대신하므로 지웁니다.
drop function if exists public.admin_unmark_attendance(bigint);


-- 7) 수업 예약자 보기: 관리자에게만 absent(결석 처리됨) 추가 (나머지는 9-11과 같음)
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
  attended       boolean,
  absent         boolean
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
    case when caller_is_admin then (r.attended_at is not null) end,
    case when caller_is_admin then (r.absent_at is not null) end
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
