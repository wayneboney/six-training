-- =========================================================
-- 7-8) 회원이 직접 홀딩 등록 (/me)
--
--   홀딩은 회원이 직접 등록하고, 관리자는 확인과 해제만 합니다. (관리자용 홀딩 등록 함수는 삭제)
--     - 회원은 "내일 이후"부터 시작하는 홀딩만 등록할 수 있습니다.
--     - 회원은 본인 계정(활동 상태의 일반회원)의 회원권에만 등록할 수 있습니다.
--     - 규칙 검사(일수, 횟수, 기간, 겹침)는 내부 함수 apply_hold가 합니다.
--   회원이 보낼 수 있는 값은 홀딩 시작일/종료일뿐이고, 어느 회원권인지는 시작일로 DB가 찾습니다. (다른 사람 것 조작 불가)
--   회원은 홀딩을 해제할 수 없습니다. (해제는 관리자만. 해제해도 횟수는 복구되지 않으므로 신청 전에 확인창으로 안내)
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 내부용: 홀딩 등록 규칙 전체(기간, 횟수, 일수, 겹침 검사 + 종료일 연장). 관리자/회원 함수가 같이 씁니다. 돌려주는 값은 새 종료일
--   p_min_start: 홀딩을 시작할 수 있는 가장 빠른 날 (관리자는 오늘, 회원은 내일)
create or replace function public.apply_hold(
  p_membership_id bigint,
  p_hold_start    date,
  p_hold_end      date,
  p_note          text,
  p_min_start     date,
  p_actor         uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  today      date := public.seoul_today();
  owner_id   uuid;
  m          public.memberships%rowtype;
  d          integer;
  used_days  integer;
  used_count integer;
  old_end    date;
begin
  select user_id into owner_id from public.memberships where id = p_membership_id;
  if owner_id is null then
    raise exception '회원권을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  perform public.lock_profile(owner_id);
  select * into m from public.memberships where id = p_membership_id for update;

  if p_hold_start is null or p_hold_end is null then
    raise exception '홀딩 시작일과 종료일을 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_hold_end < p_hold_start then
    raise exception '홀딩 종료일이 시작일보다 빠릅니다.' using errcode = 'MB004';
  end if;
  if p_hold_start < p_min_start then
    raise exception '홀딩은 %부터 시작할 수 있습니다.', p_min_start using errcode = 'MB004';
  end if;
  if p_hold_start < m.start_date or p_hold_start > m.end_date then
    raise exception '홀딩은 회원권 기간(% ~ %) 안에서 시작해야 합니다.', m.start_date, m.end_date using errcode = 'MB004';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception '메모는 200자 이하로 입력해 주세요.' using errcode = 'MB004';
  end if;

  if exists (
    select 1 from public.membership_holds
     where membership_id = m.id
       and cancelled_at is null
       and daterange(hold_start, hold_end, '[]') && daterange(p_hold_start, p_hold_end, '[]')
  ) then
    raise exception '이미 등록된 다른 홀딩 기간과 겹칩니다.' using errcode = 'MB011';
  end if;

  d := p_hold_end - p_hold_start + 1;
  select count(*), coalesce(sum(days), 0) into used_count, used_days
    from public.membership_holds where membership_id = m.id;

  if used_count >= m.hold_max_count then
    raise exception '홀딩 가능 횟수(%회)를 모두 사용했습니다.', m.hold_max_count using errcode = 'MB008';
  end if;
  if used_days + d > m.hold_max_days then
    raise exception '남은 홀딩 일수는 %일입니다. (총 %일 중 %일 사용)', m.hold_max_days - used_days, m.hold_max_days, used_days
      using errcode = 'MB009';
  end if;

  insert into public.membership_holds (membership_id, hold_start, hold_end, note, created_by)
  values (m.id, p_hold_start, p_hold_end, p_note, p_actor);

  old_end := m.end_date;
  update public.memberships set end_date = end_date + d where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, d);

  return old_end + d;
end;
$$;



-- 홀딩 등록은 회원만 합니다. 관리자용 등록 함수는 없애고, 관리자는 아래처럼 "해제"만 합니다. (admin_cancel_hold, 이미 있음)
drop function if exists public.admin_add_hold(bigint, date, date, text);

-- 회원 홀딩 등록: 본인의 회원권 중 시작일이 포함된 것, 내일부터 가능. 돌려주는 값은 새 종료일
create or replace function public.member_add_hold(
  p_hold_start date,
  p_hold_end   date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid          uuid := auth.uid();
  today        date := public.seoul_today();
  prof         public.profiles%rowtype;
  membership_id bigint;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_hold_start is null or p_hold_end is null then
    raise exception '홀딩 시작일과 종료일을 입력해 주세요.' using errcode = 'MB004';
  end if;

  perform public.lock_profile(uid);
  select * into prof from public.profiles where user_id = uid;
  if prof.role <> 'member' or prof.status <> 'active' then
    raise exception '이용 중인 회원만 홀딩을 신청할 수 있습니다.' using errcode = 'MB004';
  end if;

  select id into membership_id
    from public.memberships
   where user_id = uid and start_date <= p_hold_start and end_date >= p_hold_start and end_date >= today
   order by start_date
   limit 1;
  if membership_id is null then
    raise exception '홀딩 시작일이 이용 중인 회원권 기간 안에 있어야 합니다.' using errcode = 'MB004';
  end if;

  return public.apply_hold(membership_id, p_hold_start, p_hold_end, null, today + 1, uid);
end;
$$;

revoke execute on function public.apply_hold(bigint, date, date, text, date, uuid) from public, anon, authenticated;
revoke execute on function public.member_add_hold(date, date) from public, anon;
grant execute on function public.member_add_hold(date, date) to authenticated;
