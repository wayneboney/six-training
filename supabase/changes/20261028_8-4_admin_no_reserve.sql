-- =========================================================
-- 8-4) 관리자 계정은 수업을 예약할 수 없게 변경
--   관리자(코치)는 예약을 관리만 하고 수업을 예약하지 않습니다. 예약 함수가 관리자 계정을 거부합니다.
--   (이미 관리자 이름으로 만들어진 예약이 있으면 아래 정리 SQL로 지우세요. 테스트 중에만 있을 수 있습니다.)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (8-2 다음에)
-- =========================================================

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

  -- 관리자(코치) 계정은 수업을 예약하지 않습니다. (예약 관리만 함)
  if prof.role <> 'member' then
    raise exception '관리자 계정은 수업을 예약할 수 없습니다.' using errcode = 'MB004';
  end if;

  -- 회원은 "그 수업 날짜에" 이용 가능한 회원권이 있어야 합니다. (상태값이 아니라 날짜로 직접 확인)
  if prof.status <> 'active' or not public.has_valid_membership_on(uid, p_class_date) then
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

-- 정리: 관리자 계정이 가진 예약/대기 삭제 (있을 때만 영향)
delete from public.reservations r
 using public.profiles p
 where p.user_id = r.user_id and p.role = 'admin';
