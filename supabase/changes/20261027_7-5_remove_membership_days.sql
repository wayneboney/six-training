-- =========================================================
-- 7-5) 서비스 일수 차감 (잘못 추가한 일수 되돌리기)
--
--   - 차감할 수 있는 일수는 "그 회원권에 서비스로 추가했던 일수(bonus_days)"까지입니다.
--     (구매한 기본 기간과 홀딩으로 늘어난 기간은 줄일 수 없습니다. → 날짜 계산이 꼬이지 않도록)
--   - 종료일이 줄어들고, 뒤에 이어진 회원권도 같이 당겨집니다.
--   - 줄어든 종료일보다 늦게 끝나는 홀딩이 있으면 막습니다. (홀딩을 먼저 취소해야 함)
--   - 차감 결과 오늘 유효한 회원권이 하나도 없으면, '활동' 일반회원은 바로 '비활동'으로 바뀝니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
create or replace function public.admin_remove_membership_days(
  p_membership_id bigint,
  p_days          integer,
  p_note          text default null
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  today    date := public.seoul_today();
  owner_id uuid;
  m        public.memberships%rowtype;
  old_end  date;
  new_end  date;
begin
  perform public.require_admin();

  select user_id into owner_id from public.memberships where id = p_membership_id;
  if owner_id is null then
    raise exception '회원권을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  perform public.lock_profile(owner_id);
  select * into m from public.memberships where id = p_membership_id for update;

  if p_days is null or p_days < 1 or p_days > 1000 then
    raise exception '차감 일수는 1~1000일로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception '메모는 200자 이하로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_days > m.bonus_days then
    raise exception '차감할 수 있는 일수는 최대 %일입니다. (이 회원권에 서비스로 추가한 일수만 차감할 수 있습니다)', m.bonus_days
      using errcode = 'MB004';
  end if;

  old_end := m.end_date;
  new_end := old_end - p_days;

  if exists (select 1 from public.membership_holds where membership_id = m.id and hold_end > new_end) then
    raise exception '줄어든 종료일(%)보다 늦게 끝나는 홀딩이 있습니다. 홀딩을 먼저 취소해 주세요.', new_end
      using errcode = 'MB004';
  end if;

  update public.memberships
     set end_date   = new_end,
         bonus_days = bonus_days - p_days,
         note       = coalesce(p_note, note)
   where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, -p_days);

  -- 오늘 유효한 회원권이 없어졌으면 바로 비활동 (밤 자동 전환을 기다리지 않음)
  if not exists (select 1 from public.memberships where user_id = m.user_id and end_date >= today) then
    update public.profiles
       set status = 'inactive'
     where user_id = m.user_id and role = 'member' and status = 'active';
  end if;

  return new_end;
end;
$$;

revoke execute on function public.admin_remove_membership_days(bigint, integer, text) from public, anon;
grant execute on function public.admin_remove_membership_days(bigint, integer, text) to authenticated;
