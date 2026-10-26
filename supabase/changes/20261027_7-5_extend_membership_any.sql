-- =========================================================
-- 7-5) 서비스 일수 추가를 더 자유롭게
--
--   변경 1) 이미 끝난 회원권에도 일수를 추가할 수 있습니다. (예: 어제 끝난 회원에게 5일 더 주기)
--           추가한 결과 종료일이 오늘 이후가 되면, 비활동 상태의 일반회원은 자동으로 '활동'으로 돌아옵니다.
--   변경 2) 한 번에 추가할 수 있는 일수를 365일 → 1000일로 늘림 (여러 번 나눠 넣지 않아도 됨)
--   뒤에 이어진 회원권이 있으면 같이 밀리는 규칙은 그대로입니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
create or replace function public.admin_add_membership_days(
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
    raise exception '추가 일수는 1~1000일로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception '메모는 200자 이하로 입력해 주세요.' using errcode = 'MB004';
  end if;

  old_end := m.end_date;
  new_end := old_end + p_days;
  update public.memberships
     set end_date = new_end,
         bonus_days = bonus_days + p_days,
         note = coalesce(p_note, note)
   where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, p_days);

  -- 종료돼서 '비활동'이던 일반회원이 다시 유효해지면 '활동'으로 복귀 (그 밖의 상태, 관리자는 건드리지 않음)
  if new_end >= today then
    update public.profiles
       set status = 'active'
     where user_id = m.user_id and role = 'member' and status = 'inactive';
  end if;

  return new_end;
end;
$$;
