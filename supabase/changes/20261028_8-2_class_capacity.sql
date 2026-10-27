-- =========================================================
-- 8-2) 수업별 정원 선택 (20명 / 30명)
--
--   평소 정원은 시간표(class_slots.capacity)의 값입니다. (평일 20명, 토요일 30명)
--   예외 상황에는 관리자가 "특정 날짜의 특정 수업"만 20명 또는 30명으로 바꿀 수 있습니다. (class_capacity_overrides)
--     - 선택할 수 있는 값은 20 또는 30뿐입니다.
--     - 정원을 늘리면 대기자가 자동으로 승급됩니다.
--     - 정원을 줄여도 이미 예약된 사람은 취소되지 않습니다. 빈자리가 정원 아래로 내려갈 때까지 새 예약은 대기로 등록됩니다.
--     - 지난 수업, 이미 시작한 수업은 바꿀 수 없습니다.
--   예약/대기 승급/시간표 조회가 모두 "그 날짜의 실제 정원"(override가 있으면 override, 없으면 평소 정원)을 씁니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (8-1 다음에)
-- =========================================================

-- 1) 날짜별 정원 예외
create table public.class_capacity_overrides (
  slot_id     bigint not null references public.class_slots (id) on delete cascade,
  class_date  date not null,
  capacity    integer not null check (capacity in (20, 30)),
  created_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (slot_id, class_date)
);

comment on table public.class_capacity_overrides is '특정 날짜의 수업 정원 예외 (20 또는 30). 없으면 시간표의 평소 정원을 씁니다.';

alter table public.class_capacity_overrides enable row level security;
revoke all on public.class_capacity_overrides from anon, authenticated;
grant select on public.class_capacity_overrides to authenticated;

create policy "관리자만 정원 예외 읽기"
  on public.class_capacity_overrides for select to authenticated
  using ((select public.is_admin()));


-- 2) 그 날짜의 실제 정원
create or replace function public.class_capacity(p_slot_id bigint, p_class_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.capacity from public.class_capacity_overrides o where o.slot_id = p_slot_id and o.class_date = p_class_date),
    (select s.capacity from public.class_slots s where s.id = p_slot_id)
  );
$$;

revoke execute on function public.class_capacity(bigint, date) from public, anon, authenticated;
grant execute on function public.class_capacity(bigint, date) to authenticated;   -- 시간표 화면에서 정원을 보여주기 위해 로그인 회원에게 허용 (정보 노출 없음)


-- 3) 대기자 승급 (빈자리가 있는 만큼, 대기 순서대로). 호출하는 쪽이 이미 수업(시간표 칸) 잠금을 잡은 상태여야 합니다.
create or replace function public.promote_waiting(p_slot_id bigint, p_class_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap         integer := public.class_capacity(p_slot_id, p_class_date);
  taken       integer;
  promo       public.reservations%rowtype;
  promo_role  text;
  promo_state text;
begin
  if public.class_start_at(p_slot_id, p_class_date) <= now() then
    return;   -- 이미 시작한 수업은 승급하지 않음
  end if;

  select count(*) into taken
    from public.reservations
   where slot_id = p_slot_id and class_date = p_class_date and status = 'confirmed';

  while taken < cap loop
    select * into promo
      from public.reservations
     where slot_id = p_slot_id and class_date = p_class_date and status = 'waiting'
     order by id
     limit 1
     for update;
    exit when not found;

    select p.role, p.status into promo_role, promo_state from public.profiles p where p.user_id = promo.user_id;
    if promo_role = 'member'
       and (promo_state <> 'active' or not public.has_valid_membership_on(promo.user_id, promo.class_date)) then
      -- 대기하는 사이 회원권이 끝났거나 홀딩에 들어간 경우: 이 대기는 취소하고 다음 사람을 봅니다.
      update public.reservations
         set status = 'cancelled', cancelled_at = now(), cancel_reason = 'ineligible'
       where id = promo.id;
    else
      update public.reservations set status = 'confirmed' where id = promo.id;
      taken := taken + 1;
    end if;
  end loop;
end;
$$;

revoke execute on function public.promote_waiting(bigint, date) from public, anon, authenticated;


-- 4) 취소 핵심 로직: 승급 부분을 promote_waiting으로 교체 (잠금 순서: 수업 → 예약 은 그대로)
create or replace function public.cancel_reservation_core(p_reservation_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_id_ bigint;
  r        public.reservations%rowtype;
begin
  select res.slot_id into slot_id_ from public.reservations res where res.id = p_reservation_id;
  if slot_id_ is null then
    return;
  end if;

  perform 1 from public.class_slots where id = slot_id_ for update;                -- ① 수업 잠금
  select * into r from public.reservations where id = p_reservation_id for update; -- ② 예약 잠금
  if r.status = 'cancelled' then
    return;
  end if;

  update public.reservations
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = r.id;

  if r.status = 'confirmed' then
    perform public.promote_waiting(r.slot_id, r.class_date);
  end if;
end;
$$;


-- 예약. 돌려주는 값: 'confirmed'(예약 확정) 또는 'waiting'(대기 등록)
create or replace function public.member_reserve_class(p_slot_id bigint, p_class_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  today      date := public.seoul_today();
  prof       public.profiles%rowtype;
  slot       public.class_slots%rowtype;
  taken      integer;
  new_status text;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_slot_id is null or p_class_date is null then
    raise exception '수업과 날짜를 선택해 주세요.' using errcode = 'MB004';
  end if;

  perform public.lock_profile(uid);                                                  -- ① 회원 잠금
  select * into prof from public.profiles where user_id = uid;

  select * into slot from public.class_slots where id = p_slot_id and is_active for update;  -- ② 수업 잠금 (동시에 눌러도 한 줄씩 처리)
  if not found then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  if extract(isodow from p_class_date)::integer <> slot.weekday then
    raise exception '선택한 날짜에 열리지 않는 수업입니다.' using errcode = 'MB004';
  end if;
  if p_class_date < today or p_class_date > today + 7 then
    raise exception '예약은 오늘부터 7일 후까지만 할 수 있습니다.' using errcode = 'MB004';
  end if;
  if public.class_start_at(slot.id, p_class_date) <= now() then
    raise exception '이미 시작한 수업은 예약할 수 없습니다.' using errcode = 'MB012';
  end if;

  -- 일반회원은 "그 수업 날짜에" 이용 가능한 회원권이 있어야 합니다. (관리자/코치는 회원권 없이 예약 가능)
  if prof.role = 'member'
     and (prof.status <> 'active' or not public.has_valid_membership_on(uid, p_class_date)) then
    raise exception '이 날짜에 이용할 수 있는 회원권이 없습니다. 회원권 기간과 홀딩을 확인해 주세요.' using errcode = 'MB013';
  end if;

  if exists (
    select 1 from public.reservations
     where slot_id = slot.id and class_date = p_class_date and user_id = uid and status <> 'cancelled'
  ) then
    raise exception '이미 예약한 수업입니다.' using errcode = 'MB014';
  end if;

  select count(*) into taken
    from public.reservations
   where slot_id = slot.id and class_date = p_class_date and status = 'confirmed';
  new_status := case when taken < public.class_capacity(slot.id, p_class_date) then 'confirmed' else 'waiting' end;

  insert into public.reservations (slot_id, class_date, user_id, status)
  values (slot.id, p_class_date, uid, new_status);

  return new_status;
end;
$$;

-- 시간표 조회: 날짜 범위의 수업 목록 + 정원/예약 인원/대기 인원 + 내 예약 상태
--   다른 회원의 예약은 RLS 때문에 직접 볼 수 없어서, 이 함수가 "인원 수만" 계산해서 돌려줍니다. (누가 예약했는지는 알려주지 않음)
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
    on s.is_active and s.weekday = extract(isodow from d)::integer
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


-- 5) 관리자: 특정 날짜의 수업 정원 선택 (20 또는 30)
create or replace function public.admin_set_class_capacity(p_slot_id bigint, p_class_date date, p_capacity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.seoul_today();
  slot  public.class_slots%rowtype;
begin
  perform public.require_admin();

  if p_capacity is null or p_capacity not in (20, 30) then
    raise exception '정원은 20명 또는 30명만 선택할 수 있습니다.' using errcode = 'MB004';
  end if;
  if p_class_date is null then
    raise exception '수업 날짜를 선택해 주세요.' using errcode = 'MB004';
  end if;

  select * into slot from public.class_slots where id = p_slot_id for update;      -- 수업 잠금
  if not found then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if extract(isodow from p_class_date)::integer <> slot.weekday then
    raise exception '선택한 날짜에 열리지 않는 수업입니다.' using errcode = 'MB004';
  end if;
  if p_class_date < today or public.class_start_at(slot.id, p_class_date) <= now() then
    raise exception '이미 시작했거나 지난 수업의 정원은 바꿀 수 없습니다.' using errcode = 'MB012';
  end if;

  if p_capacity = slot.capacity then
    delete from public.class_capacity_overrides where slot_id = slot.id and class_date = p_class_date;   -- 평소 정원으로 돌아가면 예외를 지움
  else
    insert into public.class_capacity_overrides (slot_id, class_date, capacity, created_by)
    values (slot.id, p_class_date, p_capacity, auth.uid())
    on conflict (slot_id, class_date)
    do update set capacity = excluded.capacity, created_by = excluded.created_by, updated_at = now();
  end if;

  -- 정원이 늘었으면 빈자리만큼 대기자 승급 (줄었으면 아무도 취소하지 않음)
  perform public.promote_waiting(slot.id, p_class_date);
end;
$$;

revoke execute on function public.admin_set_class_capacity(bigint, date, integer) from public, anon;
grant execute on function public.admin_set_class_capacity(bigint, date, integer) to authenticated;
