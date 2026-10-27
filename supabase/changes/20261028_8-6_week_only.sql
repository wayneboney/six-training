-- =========================================================
-- 8-6) 예약 범위를 "이번 주"로 변경
--   기존: 오늘부터 7일 후까지 → 변경: 오늘부터 이번 주 토요일까지 (주 단위로 관리)
--   오늘이 일요일(휴무)이면 곧 시작하는 다음 주 토요일까지 예약할 수 있습니다. (화면의 날짜 선택과 같은 규칙)
--   이미 다음 주 날짜로 만들어진 예약이 있으면 그대로 유지됩니다. (새로 예약하는 것만 막음)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (8-5 다음에)
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
  week_end   date;
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
  -- 예약은 "이번 주" 수업만 가능합니다. (오늘부터 이번 주 토요일까지. 오늘이 일요일이면 곧 시작하는 다음 주 토요일까지)
  --   isodow: 월=1 ... 토=6, 일=7
  week_end := case when extract(isodow from today)::integer = 7 then today + 6
                   else today + (6 - extract(isodow from today)::integer) end;
  if p_class_date < today or p_class_date > week_end then
    raise exception '예약은 이번 주 수업만 할 수 있습니다.' using errcode = 'MB004';
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
