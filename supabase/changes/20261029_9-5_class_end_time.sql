-- =========================================================
-- 9-5) 수업 종료 시각
--
--   수업마다 시작 시각과 종료 시각을 따로 정합니다. 예: 06:45 - 07:45, 19:00 - 20:00
--   예약 화면, 박스 소개 시간표, 관리자 시간표 관리에 "시작 - 종료"로 보입니다.
--
--   규칙
--     - class_slots.end_time 컬럼 추가. 종료 시각은 시작 시각보다 늦어야 합니다. (자정을 넘기는 수업은 없다고 봅니다)
--     - 이미 있는 수업은 종료 시각이 비어 있습니다. 비어 있으면 화면에 시작 시각만 보이고(예전과 같음),
--       관리자 시간표 관리에서 수업마다 종료 시각을 넣으면 바뀝니다. (수업을 새로 추가하거나 수정할 때는 종료 시각이 필수)
--     - 종료 시각만 바꾸는 것은 예약이 있어도 됩니다. 시작 시각이나 종류를 바꾸는 규칙은 9-4와 같습니다.
--     - 예약, 취소 마감은 계속 "시작 시각" 기준입니다.
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 종료 시각 컬럼
alter table public.class_slots add column if not exists end_time time;

alter table public.class_slots drop constraint if exists class_slots_end_after_start;
alter table public.class_slots
  add constraint class_slots_end_after_start check (end_time is null or end_time > start_time);

comment on column public.class_slots.end_time is '수업 종료 시각 (시작 시각보다 늦어야 함). 비어 있으면 종료 시각 미정';


-- 2) 수업 추가: 종료 시각 추가 (함수 모양이 바뀌어서 예전 함수를 지우고 다시 만듭니다)
drop function if exists public.admin_add_class_slot(integer, time, text, integer);

create or replace function public.admin_add_class_slot(
  p_weekday    integer,
  p_start_time time,
  p_end_time   time,
  p_class_type text,
  p_capacity   integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.class_slots%rowtype;
  new_id   bigint;
begin
  perform public.require_admin();

  if p_weekday is null or p_weekday not between 1 and 6 then
    raise exception '요일을 월~토 중에서 선택해 주세요.' using errcode = 'MB004';
  end if;
  if p_start_time is null or p_end_time is null then
    raise exception '시작 시각과 종료 시각을 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_end_time <= p_start_time then
    raise exception '종료 시각은 시작 시각보다 늦어야 합니다.' using errcode = 'MB004';
  end if;
  if p_class_type is null or p_class_type not in ('CROSSFIT', 'HYROX', 'OPEN_GYM', 'COACH_TRAINING') then
    raise exception '수업 종류를 선택해 주세요.' using errcode = 'MB004';
  end if;
  if p_capacity is null or p_capacity not between 1 and 200 then
    raise exception '정원은 1~200명으로 입력해 주세요.' using errcode = 'MB004';
  end if;

  select * into existing
    from public.class_slots
   where weekday = p_weekday and start_time = p_start_time
   for update;

  if found then
    if existing.is_active then
      raise exception '같은 요일, 같은 시각의 수업이 이미 있습니다.' using errcode = 'MB014';
    end if;
    -- 예전에 삭제한 수업과 같은 칸이면 다시 사용합니다.
    update public.class_slots
       set is_active = true, class_type = p_class_type, capacity = p_capacity, end_time = p_end_time
     where id = existing.id;
    return existing.id;
  end if;

  insert into public.class_slots (weekday, start_time, end_time, class_type, capacity)
  values (p_weekday, p_start_time, p_end_time, p_class_type, p_capacity)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.admin_add_class_slot(integer, time, time, text, integer) from public, anon;
grant execute on function public.admin_add_class_slot(integer, time, time, text, integer) to authenticated;


-- 3) 수업 수정: 종료 시각 추가
drop function if exists public.admin_update_class_slot(bigint, time, text, integer);

create or replace function public.admin_update_class_slot(
  p_slot_id    bigint,
  p_start_time time,
  p_end_time   time,
  p_class_type text,
  p_capacity   integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot     public.class_slots%rowtype;
  booked   integer;
begin
  perform public.require_admin();

  if p_start_time is null or p_end_time is null then
    raise exception '시작 시각과 종료 시각을 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_end_time <= p_start_time then
    raise exception '종료 시각은 시작 시각보다 늦어야 합니다.' using errcode = 'MB004';
  end if;
  if p_class_type is null or p_class_type not in ('CROSSFIT', 'HYROX', 'OPEN_GYM', 'COACH_TRAINING') then
    raise exception '수업 종류를 선택해 주세요.' using errcode = 'MB004';
  end if;
  if p_capacity is null or p_capacity not between 1 and 200 then
    raise exception '정원은 1~200명으로 입력해 주세요.' using errcode = 'MB004';
  end if;

  select * into slot from public.class_slots where id = p_slot_id for update;
  if not found or not slot.is_active then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  -- 시작 시각이나 종류를 바꾸려면 오늘 이후 예약이 없어야 합니다. (종료 시각, 정원만 바꾸는 것은 예약이 있어도 됨)
  if p_start_time <> slot.start_time or p_class_type <> slot.class_type then
    select count(*) into booked
      from public.reservations
     where slot_id = p_slot_id
       and class_date >= public.seoul_today()
       and status <> 'cancelled';
    if booked > 0 then
      raise exception '오늘 이후 예약/대기가 %건 있어서 시작 시각이나 종류를 바꿀 수 없습니다. 종료 시각과 정원만 바꾸거나, 이 수업을 삭제(예약 취소)하고 새로 추가해 주세요.', booked
        using errcode = 'MB004';
    end if;
  end if;

  begin
    update public.class_slots
       set start_time = p_start_time, end_time = p_end_time, class_type = p_class_type, capacity = p_capacity
     where id = p_slot_id;
  exception when unique_violation then
    raise exception '같은 요일, 같은 시각의 수업이 이미 있습니다.' using errcode = 'MB014';
  end;
end;
$$;

revoke execute on function public.admin_update_class_slot(bigint, time, time, text, integer) from public, anon;
grant execute on function public.admin_update_class_slot(bigint, time, time, text, integer) to authenticated;


-- 4) 시간표 조회: end_time 컬럼 추가 (결과 모양이 바뀌어서 함수를 지우고 다시 만듭니다. 나머지는 9-4와 같음)
drop function if exists public.get_class_schedule(date, date);

create function public.get_class_schedule(p_from date, p_to date)
returns table (
  slot_id          bigint,
  class_date       date,
  start_time       time,
  end_time         time,
  class_type       text,
  capacity         integer,
  confirmed_count  integer,
  waiting_count    integer,
  my_reservation_id bigint,
  my_status        text
)
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
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 14 then
    raise exception '조회 기간이 올바르지 않습니다. (최대 15일)' using errcode = 'MB004';
  end if;

  return query
  select
    s.id,
    d::date,
    s.start_time,
    s.end_time,
    s.class_type,
    public.class_capacity(s.id, d::date),
    (select count(*)::integer from public.reservations r
      where r.slot_id = s.id and r.class_date = d::date and r.status = 'confirmed'),
    (select count(*)::integer from public.reservations r
      where r.slot_id = s.id and r.class_date = d::date and r.status = 'waiting'),
    mine.id,
    mine.status
  from generate_series(p_from, p_to, interval '1 day') as d
  join public.class_slots s
    on s.weekday = extract(isodow from d)::integer
   and (
     s.is_active
     -- 지금은 하지 않는 수업이어도, 그 날짜에 예약 기록이 남아 있으면 지난 수업 기록으로 계속 보여줍니다.
     or exists (
       select 1 from public.reservations r
        where r.slot_id = s.id and r.class_date = d::date and r.status <> 'cancelled'
     )
   )
  left join lateral (
    select r.id, r.status
      from public.reservations r
     where r.slot_id = s.id and r.class_date = d::date
       and r.user_id = auth.uid() and r.status <> 'cancelled'
     limit 1
  ) mine on true
  order by d, s.start_time;
end;
$$;

revoke execute on function public.get_class_schedule(date, date) from public, anon;
grant execute on function public.get_class_schedule(date, date) to authenticated;
