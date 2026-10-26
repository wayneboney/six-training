-- =========================================================
-- 회원권을 "일수"로 계산 (30일 / 90일 / 180일)
--
--   달력 개월 수(1개월, 3개월)가 아니라 일수로 단순하게 계산합니다.
--     1개월권 = 30일, 3개월권 = 90일, 6개월권 = 180일
--   종료일 = 시작일 + 일수 - 1 (시작일 포함, 종료일 당일까지 이용). 예) 10/26 시작 30일권 → 11/24까지
--   회원권 등록 함수는 종류 코드(M1 등) 대신 일수(30/90/180)를 받습니다. 코드는 DB 내부 연결용으로만 남고 화면에는 쓰지 않습니다.
--   홀딩 규칙은 그대로: 30일권 3일 1회 / 90일권 7일 2회 / 180일권 14일 4회
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (000400 다음에)
-- =========================================================

alter table public.membership_plans add column days integer;
update public.membership_plans set days = months * 30;   -- 1→30, 3→90, 6→180
alter table public.membership_plans
  alter column days set not null,
  add constraint membership_plans_days_check check (days between 1 and 1100),
  add constraint membership_plans_days_key unique (days),
  drop column months;
update public.membership_plans set name = days || '일권(' || (days / 30) || '개월)';
comment on column public.membership_plans.days is '회원권 이용 일수 (종료일 = 시작일 + days - 1)';

-- 예전 함수(코드를 받던 버전)는 지우고 일수를 받는 새 함수로 교체
drop function public.admin_register_membership(uuid, text, date, text);

-- 회원권 등록 (신규 가입 승인, 재등록, 연장 모두 이 함수)
--   - 이미 유효하거나 예정된 회원권이 있으면 그 다음 날부터 이어서 시작합니다. (시작일을 직접 정할 수 없음)
--   - 없으면 시작일을 정할 수 있고, 비우면 오늘부터입니다.
--   - 지금 유효하거나 곧 시작하는 회원권이면 회원 상태를 '활동'으로 바꿉니다. (= 가입 승인)
create or replace function public.admin_register_membership(
  p_user_id    uuid,
  p_days       integer,
  p_start_date date default null,
  p_note       text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  today      date := public.seoul_today();
  plan       public.membership_plans%rowtype;
  latest_end date;
  v_start    date;
  v_end      date;
  new_id     bigint;
begin
  perform public.require_admin();
  perform public.lock_profile(p_user_id);

  if p_note is not null and char_length(p_note) > 200 then
    raise exception '메모는 200자 이하로 입력해 주세요.' using errcode = 'MB004';
  end if;

  select * into plan from public.membership_plans where days = p_days and is_active;
  if not found then
    raise exception '선택할 수 없는 회원권 일수입니다. (30 / 90 / 180일)' using errcode = 'MB003';
  end if;

  select max(end_date) into latest_end from public.memberships where user_id = p_user_id;

  if latest_end is not null and latest_end >= today then
    -- 이어서 시작: 시작일을 따로 지정하면 에러 (겹치거나 빈 기간이 생기는 것을 막기 위해)
    v_start := latest_end + 1;
    if p_start_date is not null and p_start_date <> v_start then
      raise exception '이미 이용 중인 회원권이 있어서 % 부터 이어서 시작합니다.', v_start using errcode = 'MB007';
    end if;
  else
    v_start := coalesce(p_start_date, today);
    if v_start < today - 60 or v_start > today + 365 then
      raise exception '시작일이 올바르지 않습니다. (오늘 기준 60일 전 ~ 1년 후)' using errcode = 'MB004';
    end if;
    if latest_end is not null and v_start <= latest_end then
      raise exception '이전 회원권 기간과 겹칩니다.' using errcode = 'MB007';
    end if;
  end if;

  v_end := v_start + plan.days - 1;   -- 시작일 포함 N일 (30일권이면 시작일 + 29일)

  insert into public.memberships
    (user_id, plan_code, start_date, original_end_date, end_date, hold_max_days, hold_max_count, note, created_by)
  values
    (p_user_id, plan.plan_code, v_start, v_end, v_end, plan.hold_max_days, plan.hold_max_count, p_note, auth.uid())
  returning id into new_id;

  -- 이미 끝난 과거 기록을 입력한 경우가 아니라면 '활동'으로 (가입 승인 포함)
  if v_end >= today then
    update public.profiles set status = 'active' where user_id = p_user_id and status <> 'active';
  end if;

  return new_id;
end;
$$;



revoke execute on function public.admin_register_membership(uuid, integer, date, text) from public, anon;
grant execute on function public.admin_register_membership(uuid, integer, date, text) to authenticated;
