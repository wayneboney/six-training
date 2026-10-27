-- =========================================================
-- 8-1) 수업 예약 (DB)
--
--   class_slots   : 주간 시간표 한 칸 (요일 + 시작 시각 + 수업 종류 + 정원). 시간표(src/data/timetable.ts)를 DB로 옮긴 것
--   reservations  : 회원의 예약 한 건 (날짜별). 상태 confirmed(예약) / waiting(대기) / cancelled(취소)
--
-- 규칙 (사용자와 정한 내용)
--   1) 예약할 수 있는 수업: 크로스핏, 하이록스, 오픈짐 (브레이크/휴무는 시간표에서 제외)
--   2) 예약 가능 범위: 오늘부터 7일 후까지, 수업 시작 시각 전까지 (한국 시간)
--   3) 정원이 차면 대기로 등록됩니다. 예약이 취소되면 대기 1번이 자동으로 예약됩니다. (대기 순서 = 신청 순서)
--        대기자가 그 사이 회원권이 끝났거나 홀딩 중이면 건너뛰고 다음 대기자를 승급합니다.
--   4) 취소는 수업 시작 전까지 자유입니다. (회원 직접). 관리자는 언제든 취소할 수 있습니다.
--   5) 예약은 "그 수업 날짜에 유효한 회원권"이 있는 활동 회원만 할 수 있습니다. (상태값이 아니라 날짜로 직접 확인)
--        홀딩 기간에 걸친 날짜는 예약할 수 없고, 홀딩을 등록하면 그 기간의 기존 예약은 자동으로 취소됩니다.
--        관리자(코치) 계정은 회원권 없이 예약할 수 있습니다.
--   6) 동시에 여러 명이 눌러도 정원이 넘지 않도록 수업(시간표 칸) 한 줄을 잠그고 처리합니다.
--
-- 오류 코드 (사이트가 안내 문구로 보여줌)
--   MB002 대상 없음 / MB004 입력값이 올바르지 않음 / MB010 이미 취소됨 / MB012 이미 시작한 수업 / MB013 이용 가능한 회원권 없음 / MB014 이미 예약함
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================


-- 1) 시간표 한 칸
create table public.class_slots (
  id          bigint generated always as identity primary key,
  weekday     smallint not null check (weekday between 1 and 7),                      -- 1=월 ... 6=토, 7=일 (ISO 방식)
  start_time  time not null,                                                          -- 시작 시각 (한국 시간)
  class_type  text not null check (class_type in ('CROSSFIT', 'HYROX', 'OPEN_GYM')),
  capacity    integer not null check (capacity between 1 and 200),                    -- 정원
  is_active   boolean not null default true,                                          -- false면 새 예약을 받지 않음 (지우지 말고 끄세요)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (weekday, start_time)
);

comment on table public.class_slots is '주간 시간표 한 칸 (요일 + 시작 시각 + 수업 종류 + 정원)';

create trigger class_slots_set_updated_at
  before update on public.class_slots
  for each row
  execute function public.set_updated_at();


-- 2) 예약
create table public.reservations (
  id             bigint generated always as identity primary key,
  slot_id        bigint not null references public.class_slots (id),
  class_date     date not null,                                                       -- 수업 날짜
  user_id        uuid not null references public.profiles (user_id) on delete cascade,
  status         text not null check (status in ('confirmed', 'waiting', 'cancelled')),
  cancel_reason  text check (cancel_reason is null or cancel_reason in ('member', 'admin', 'hold', 'ineligible')),
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 같은 수업에 같은 회원이 (취소하지 않은) 예약을 두 번 가질 수 없음
create unique index reservations_active_unique
  on public.reservations (slot_id, class_date, user_id)
  where status <> 'cancelled';

create index reservations_slot_date_idx on public.reservations (slot_id, class_date, status, id);
create index reservations_user_idx on public.reservations (user_id, class_date);

comment on table  public.reservations        is '수업 예약 (날짜별). 상태: confirmed 예약 / waiting 대기 / cancelled 취소';
comment on column public.reservations.cancel_reason is 'member 본인 취소 / admin 관리자 취소 / hold 홀딩 등록으로 자동 취소 / ineligible 대기 승급 시 자격 없음';

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row
  execute function public.set_updated_at();


-- 3) 접근 권한: 읽기만 열고, 쓰기는 아래 함수로만
alter table public.class_slots enable row level security;
alter table public.reservations enable row level security;

revoke all on public.class_slots from anon, authenticated;
revoke all on public.reservations from anon, authenticated;
grant select on public.class_slots to authenticated;
grant select on public.reservations to authenticated;

create policy "로그인한 회원은 시간표 읽기"
  on public.class_slots for select to authenticated using (true);

create policy "본인 또는 관리자만 예약 읽기"
  on public.reservations for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));


-- =========================================================
-- 내부 도우미 함수 (사이트/API로는 호출 불가)
-- =========================================================

-- 수업 시작 시각 (한국 시간 기준의 정확한 시점)
create or replace function public.class_start_at(p_slot_id bigint, p_class_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_class_date + s.start_time) at time zone 'Asia/Seoul')
    from public.class_slots s
   where s.id = p_slot_id;
$$;

-- 그 날짜에 이용할 수 있는 회원권이 있는지: 회원권 기간 안이고, 홀딩 기간이 아니어야 함
create or replace function public.has_valid_membership_on(p_user_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = p_user_id
       and p_date between m.start_date and m.end_date
       and not exists (
         select 1
           from public.membership_holds h
          where h.membership_id = m.id
            and h.cancelled_at is null
            and p_date between h.hold_start and h.hold_end
       )
  );
$$;

-- 예약 취소 + 대기자 승급 (회원/관리자/홀딩 트리거가 같이 쓰는 핵심 로직)
--   잠그는 순서: 수업(시간표 칸) → 예약. 모든 함수가 이 순서를 지켜서 서로 맞물려 멈추는 일(교착)을 막습니다.
create or replace function public.cancel_reservation_core(p_reservation_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_id_    bigint;
  slot        public.class_slots%rowtype;
  r           public.reservations%rowtype;
  promo       public.reservations%rowtype;
  promo_role  text;
  promo_state text;
  taken       integer;
begin
  select res.slot_id into slot_id_ from public.reservations res where res.id = p_reservation_id;
  if slot_id_ is null then
    return;
  end if;

  select * into slot from public.class_slots where id = slot_id_ for update;      -- ① 수업 잠금
  select * into r from public.reservations where id = p_reservation_id for update; -- ② 예약 잠금
  if r.status = 'cancelled' then
    return;
  end if;

  update public.reservations
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = r.id;

  -- 예약(confirmed)이 빠졌고 수업이 아직 시작 전이면, 자리가 있을 때 대기 1번부터 승급
  if r.status = 'confirmed' and public.class_start_at(r.slot_id, r.class_date) > now() then
    select count(*) into taken
      from public.reservations
     where slot_id = r.slot_id and class_date = r.class_date and status = 'confirmed';

    while taken < slot.capacity loop
      select * into promo
        from public.reservations
       where slot_id = r.slot_id and class_date = r.class_date and status = 'waiting'
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
  end if;
end;
$$;

-- 홀딩을 등록하면 그 기간의 예약/대기를 자동으로 취소합니다. (취소로 생긴 빈자리는 대기자에게 넘어감)
create or replace function public.cancel_reservations_for_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid bigint;
begin
  for rid in
    select res.id
      from public.reservations res
      join public.memberships m on m.user_id = res.user_id and m.id = new.membership_id
     where res.status in ('confirmed', 'waiting')
       and res.class_date between new.hold_start and new.hold_end
     order by res.id
  loop
    perform public.cancel_reservation_core(rid, 'hold');
  end loop;
  return new;
end;
$$;

create trigger membership_holds_cancel_reservations
  after insert on public.membership_holds
  for each row
  execute function public.cancel_reservations_for_hold();

revoke execute on function public.class_start_at(bigint, date) from public, anon, authenticated;
revoke execute on function public.has_valid_membership_on(uuid, date) from public, anon, authenticated;
revoke execute on function public.cancel_reservation_core(bigint, text) from public, anon, authenticated;
revoke execute on function public.cancel_reservations_for_hold() from public, anon, authenticated;


-- =========================================================
-- 회원이 부르는 함수
-- =========================================================

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
    s.capacity,
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
  new_status := case when taken < slot.capacity then 'confirmed' else 'waiting' end;

  insert into public.reservations (slot_id, class_date, user_id, status)
  values (slot.id, p_class_date, uid, new_status);

  return new_status;
end;
$$;

-- 내 예약/대기 취소 (수업 시작 전까지). 예약을 취소하면 대기 1번이 자동으로 예약됩니다.
create or replace function public.member_cancel_reservation(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r   public.reservations%rowtype;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select * into r from public.reservations where id = p_reservation_id;
  if not found or r.user_id <> uid then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'MB002';   -- 남의 예약 번호를 보내도 같은 메시지 (존재 여부를 알려주지 않음)
  end if;
  if r.status = 'cancelled' then
    raise exception '이미 취소된 예약입니다.' using errcode = 'MB010';
  end if;
  if public.class_start_at(r.slot_id, r.class_date) <= now() then
    raise exception '이미 시작한 수업은 취소할 수 없습니다.' using errcode = 'MB012';
  end if;

  perform public.cancel_reservation_core(r.id, 'member');
end;
$$;

-- 관리자 취소 (수업 시작 후에도 가능). 대기자 승급은 수업 시작 전일 때만 일어납니다.
create or replace function public.admin_cancel_reservation(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text;
begin
  perform public.require_admin();
  select status into st from public.reservations where id = p_reservation_id;
  if st is null then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if st = 'cancelled' then
    raise exception '이미 취소된 예약입니다.' using errcode = 'MB010';
  end if;
  perform public.cancel_reservation_core(p_reservation_id, 'admin');
end;
$$;

revoke execute on function public.get_class_schedule(date, date) from public, anon;
revoke execute on function public.member_reserve_class(bigint, date) from public, anon;
revoke execute on function public.member_cancel_reservation(bigint) from public, anon;
revoke execute on function public.admin_cancel_reservation(bigint) from public, anon;
grant execute on function public.get_class_schedule(date, date) to authenticated;
grant execute on function public.member_reserve_class(bigint, date) to authenticated;
grant execute on function public.member_cancel_reservation(bigint) to authenticated;
grant execute on function public.admin_cancel_reservation(bigint) to authenticated;


-- =========================================================
-- 기본 시간표 (src/data/timetable.ts의 수업을 옮긴 것)
--   기본 정원: 모든 수업 20명. (필요할 때 예약 화면에서 날짜별로 20/30명을 고릅니다)
--   나중에 바꿀 때는 아래처럼 SQL로 고칩니다. (관리자 화면에서 바꾸는 기능은 8-3에서 만듭니다)
--     update public.class_slots set capacity = 16 where class_type = 'CROSSFIT' and weekday between 1 and 5;
--   오픈짐 시간(08:00, 15:30)은 "시작 시각" 기준으로 예약합니다.
-- =========================================================
insert into public.class_slots (weekday, start_time, class_type, capacity)
select w, t::time, c, 20   -- 기본 정원 20명 (사람이 많아지면 예약 화면에서 날짜별로 30명으로 늘림)
from (values
  -- 06:45 크로스핏 (월~금)
  (1,'06:45','CROSSFIT'),(2,'06:45','CROSSFIT'),(3,'06:45','CROSSFIT'),(4,'06:45','CROSSFIT'),(5,'06:45','CROSSFIT'),
  -- 08:00 오픈짐 (월~금)
  (1,'08:00','OPEN_GYM'),(2,'08:00','OPEN_GYM'),(3,'08:00','OPEN_GYM'),(4,'08:00','OPEN_GYM'),(5,'08:00','OPEN_GYM'),
  -- 10:30 크로스핏 (월~토)
  (1,'10:30','CROSSFIT'),(2,'10:30','CROSSFIT'),(3,'10:30','CROSSFIT'),(4,'10:30','CROSSFIT'),(5,'10:30','CROSSFIT'),(6,'10:30','CROSSFIT'),
  -- 12:00 하이록스 (월~토)
  (1,'12:00','HYROX'),(2,'12:00','HYROX'),(3,'12:00','HYROX'),(4,'12:00','HYROX'),(5,'12:00','HYROX'),(6,'12:00','HYROX'),
  -- 15:30 오픈짐 (월, 화, 목, 금)
  (1,'15:30','OPEN_GYM'),(2,'15:30','OPEN_GYM'),(4,'15:30','OPEN_GYM'),(5,'15:30','OPEN_GYM'),
  -- 17:50 크로스핏 (월~금)
  (1,'17:50','CROSSFIT'),(2,'17:50','CROSSFIT'),(3,'17:50','CROSSFIT'),(4,'17:50','CROSSFIT'),(5,'17:50','CROSSFIT'),
  -- 19:00 (월 크로스핏, 화 하이록스, 수 크로스핏, 목 하이록스, 금 크로스핏)
  (1,'19:00','CROSSFIT'),(2,'19:00','HYROX'),(3,'19:00','CROSSFIT'),(4,'19:00','HYROX'),(5,'19:00','CROSSFIT'),
  -- 20:10 (월 하이록스, 화 크로스핏, 수 하이록스, 목 크로스핏, 금 하이록스)
  (1,'20:10','HYROX'),(2,'20:10','CROSSFIT'),(3,'20:10','HYROX'),(4,'20:10','CROSSFIT'),(5,'20:10','HYROX'),
  -- 21:20 크로스핏 (월~금)
  (1,'21:20','CROSSFIT'),(2,'21:20','CROSSFIT'),(3,'21:20','CROSSFIT'),(4,'21:20','CROSSFIT'),(5,'21:20','CROSSFIT')
) as v(w, t, c);
