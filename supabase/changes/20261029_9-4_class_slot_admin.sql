-- =========================================================
-- 9-4) 수업 시간표 관리 (관리자가 수업 시간을 직접 추가/수정/삭제)
--
--   수업 시간표는 DB의 class_slots(요일 + 시작 시각 + 수업 종류 + 기본 정원)입니다. 예약 화면과 박스 소개의 시간표가 모두 이 값을 읽습니다.
--   이 파일은 관리자 화면에서 시간표를 바꾸는 데 필요한 DB 함수와 규칙을 만듭니다.
--
--   규칙
--     - 수업 추가: 요일(월~토) + 시작 시각 + 종류 + 기본 정원. 같은 요일, 같은 시각의 수업이 이미 있으면 거부합니다.
--         (예전에 삭제한 수업과 같은 요일/시각이면 그 수업을 다시 켜고 새 종류/정원을 적용)
--     - 수업 수정: 시작 시각이나 종류를 바꾸려면 "오늘 이후 예약이 없어야" 합니다. (예약한 회원이 모르는 사이 시간이 바뀌는 것을 막기 위해)
--         예약이 있으면 거부하고 개수를 알려 줍니다. 기본 정원만 바꾸는 것은 예약이 있어도 됩니다. (정원을 줄여도 기존 예약은 취소되지 않음)
--     - 수업 삭제: 지우지 않고 "사용 안 함"으로 바꿉니다. 아직 시작하지 않은 오늘 이후의 예약/대기는 모두 취소하고(관리자 취소) 몇 건인지 돌려줍니다.
--         이미 지난 수업의 예약 기록은 그대로 남아서, 지난 날짜를 보면 예약자를 확인할 수 있습니다.
--     - 박스 소개 페이지가 로그인 없이 시간표를 읽을 수 있게 합니다. (사용 중인 수업만, 코치 트레이닝 제외. 정원 등 예약 정보는 시간표 읽기에 포함되어도 민감하지 않음)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--      (새 코드는 시간표를 DB에서 읽습니다. SQL 전에 배포하면 박스 소개의 시간표가 비어 보입니다.)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 로그인하지 않은 방문자도 (사용 중인) 시간표를 읽을 수 있게
grant select on public.class_slots to anon;

drop policy if exists "누구나 사용 중인 시간표 읽기" on public.class_slots;
create policy "누구나 사용 중인 시간표 읽기"
  on public.class_slots for select to anon
  using (is_active and class_type <> 'COACH_TRAINING');


-- 2) 수업 추가. 돌려주는 값: 수업 번호
create or replace function public.admin_add_class_slot(
  p_weekday    integer,
  p_start_time time,
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
  if p_start_time is null then
    raise exception '시작 시각을 입력해 주세요.' using errcode = 'MB004';
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
       set is_active = true, class_type = p_class_type, capacity = p_capacity
     where id = existing.id;
    return existing.id;
  end if;

  insert into public.class_slots (weekday, start_time, class_type, capacity)
  values (p_weekday, p_start_time, p_class_type, p_capacity)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.admin_add_class_slot(integer, time, text, integer) from public, anon;
grant execute on function public.admin_add_class_slot(integer, time, text, integer) to authenticated;


-- 3) 수업 수정 (시작 시각, 종류, 기본 정원)
create or replace function public.admin_update_class_slot(
  p_slot_id    bigint,
  p_start_time time,
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

  if p_start_time is null then
    raise exception '시작 시각을 입력해 주세요.' using errcode = 'MB004';
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

  if p_start_time <> slot.start_time or p_class_type <> slot.class_type then
    select count(*) into booked
      from public.reservations
     where slot_id = p_slot_id
       and class_date >= public.seoul_today()
       and status <> 'cancelled';
    if booked > 0 then
      raise exception '오늘 이후 예약/대기가 %건 있어서 시간이나 종류를 바꿀 수 없습니다. 정원만 바꾸거나, 이 수업을 삭제(예약 취소)하고 새로 추가해 주세요.', booked
        using errcode = 'MB004';
    end if;
  end if;

  begin
    update public.class_slots
       set start_time = p_start_time, class_type = p_class_type, capacity = p_capacity
     where id = p_slot_id;
  exception when unique_violation then
    raise exception '같은 요일, 같은 시각의 수업이 이미 있습니다.' using errcode = 'MB014';
  end;
end;
$$;

revoke execute on function public.admin_update_class_slot(bigint, time, text, integer) from public, anon;
grant execute on function public.admin_update_class_slot(bigint, time, text, integer) to authenticated;


-- 4) 수업 삭제 (= 사용 안 함). 아직 시작하지 않은 오늘 이후의 예약/대기는 모두 취소합니다. 돌려주는 값: 취소한 예약 수
create or replace function public.admin_deactivate_class_slot(p_slot_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot      public.class_slots%rowtype;
  cancelled integer;
begin
  perform public.require_admin();

  select * into slot from public.class_slots where id = p_slot_id for update;      -- 수업 잠금 (동시에 들어오는 예약과 순서대로 처리)
  if not found or not slot.is_active then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  update public.reservations
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'admin'
   where slot_id = p_slot_id
     and status <> 'cancelled'
     and class_date >= public.seoul_today()
     and public.class_start_at(p_slot_id, class_date) > now();
  get diagnostics cancelled = row_count;

  update public.class_slots set is_active = false where id = p_slot_id;
  return cancelled;
end;
$$;

revoke execute on function public.admin_deactivate_class_slot(bigint) from public, anon;
grant execute on function public.admin_deactivate_class_slot(bigint) to authenticated;


-- 5) 관리자 화면용: 수업별 "오늘 이후 예약/대기 건수". (삭제 확인창과 수정 가능 여부 안내에 씀)
create or replace function public.admin_class_slot_booking_counts()
returns table (slot_id bigint, booked integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select r.slot_id, count(*)::integer
    from public.reservations r
   where r.class_date >= public.seoul_today() and r.status <> 'cancelled'
   group by r.slot_id;
end;
$$;

revoke execute on function public.admin_class_slot_booking_counts() from public, anon;
grant execute on function public.admin_class_slot_booking_counts() to authenticated;


-- 6) 시간표 조회: 지금은 하지 않는 수업이어도 그 날짜에 예약 기록이 있으면 지난 수업으로 계속 보여줌 (나머지는 9-2와 같음)
create or replace function public.get_class_schedule(p_from date, p_to date)
returns table (
  slot_id          bigint,
  class_date       date,
  start_time       time,
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
