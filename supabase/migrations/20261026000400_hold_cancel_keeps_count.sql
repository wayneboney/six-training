-- =========================================================
-- 홀딩 취소 규칙 변경: 이미 시작된 홀딩도 취소(조기 해제)할 수 있고, 취소해도 홀딩 "횟수"는 돌아오지 않습니다.
--
--   - 취소하면 홀딩 기록은 지우지 않고 cancelled_at만 채웁니다. → 횟수(행 수)는 그대로 차감된 상태로 남습니다.
--   - 이미 시작된 홀딩: 오늘부터 홀딩이 풀립니다. 오늘 전날까지 실제로 쉰 일수만 사용한 것으로 남고, 나머지 일수는 돌아옵니다.
--   - 아직 시작 전인 홀딩: 사용 일수 0일, 횟수만 차감됩니다.
--   - 이미 끝난 홀딩, 이미 취소한 홀딩은 취소할 수 없습니다.
--   - 종료일은 돌아온 일수만큼 줄어들고, 뒤에 이어진 회원권도 같이 당겨집니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (회원권 다음에)
-- =========================================================

alter table public.membership_holds add column cancelled_at timestamptz;
comment on column public.membership_holds.cancelled_at is '취소한 시각. 값이 있어도 홀딩 횟수는 차감된 상태로 유지';

-- 취소하면 0일짜리(종료일 = 시작일 - 1)가 될 수 있으므로 검사 조건을 완화
alter table public.membership_holds drop constraint if exists membership_holds_check;
alter table public.membership_holds add constraint membership_holds_range_check check (hold_end >= hold_start - 1);


-- 홀딩 등록. 돌려주는 값은 새 종료일
create or replace function public.admin_add_hold(
  p_membership_id bigint,
  p_hold_start    date,
  p_hold_end      date,
  p_note          text default null
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
  perform public.require_admin();

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
  if p_hold_start < today then
    raise exception '홀딩은 오늘 이후부터 시작할 수 있습니다.' using errcode = 'MB004';
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
  values (m.id, p_hold_start, p_hold_end, p_note, auth.uid());

  old_end := m.end_date;
  update public.memberships set end_date = end_date + d where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, d);

  return old_end + d;
end;
$$;


-- 홀딩 취소(조기 해제). 돌려주는 값은 새 종료일
create or replace function public.admin_cancel_hold(p_hold_id bigint)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  today    date := public.seoul_today();
  owner_id uuid;
  h        public.membership_holds%rowtype;
  m        public.memberships%rowtype;
  new_end  date;
  freed    integer;
  old_end  date;
begin
  perform public.require_admin();

  select m2.user_id into owner_id
    from public.membership_holds h2 join public.memberships m2 on m2.id = h2.membership_id
   where h2.id = p_hold_id;
  if owner_id is null then
    raise exception '홀딩을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  perform public.lock_profile(owner_id);

  select * into h from public.membership_holds where id = p_hold_id for update;
  if not found then
    raise exception '홀딩을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  select * into m from public.memberships where id = h.membership_id for update;

  if h.cancelled_at is not null then
    raise exception '이미 취소된 홀딩입니다.' using errcode = 'MB010';
  end if;
  if h.hold_end < today then
    raise exception '이미 끝난 홀딩은 취소할 수 없습니다.' using errcode = 'MB010';
  end if;

  -- 오늘부터 홀딩 해제: 오늘 전날까지만 사용한 것으로 인정 (시작 전이면 0일)
  new_end := greatest(h.hold_start, today) - 1;
  freed   := h.hold_end - new_end;          -- 돌려받는 일수

  update public.membership_holds set hold_end = new_end, cancelled_at = now() where id = h.id;

  old_end := m.end_date;
  update public.memberships set end_date = end_date - freed where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, -freed);

  return old_end - freed;
end;
$$;

-- 요약 뷰: 취소된 홀딩은 '예정/진행 중' 표시에서 제외 (횟수와 사용 일수에는 그대로 포함)
create or replace view public.member_membership_status
with (security_invoker = true)
as
select
  p.user_id,
  cur.id            as membership_id,
  cur.plan_code,
  pl.name           as plan_name,
  cur.start_date,
  cur.end_date,
  case when cur.start_date <= public.seoul_today() then cur.end_date - public.seoul_today() + 1 end as days_left,
  case when cur.start_date >  public.seoul_today() then cur.start_date - public.seoul_today() end     as starts_in_days,
  cur.hold_max_days,
  cur.hold_max_count,
  coalesce(h.used_days, 0)   as hold_used_days,
  coalesce(h.used_count, 0)  as hold_used_count,
  greatest(cur.hold_max_days  - coalesce(h.used_days, 0), 0)  as hold_days_left,
  greatest(cur.hold_max_count - coalesce(h.used_count, 0), 0) as hold_count_left,
  h.holding_until,           -- 오늘 홀딩 중이면 홀딩이 끝나는 날
  h.next_hold_start          -- 앞으로 예정된 홀딩이 있으면 가장 가까운 시작일
from public.profiles p
left join lateral (
  select m.*
  from public.memberships m
  where m.user_id = p.user_id and m.end_date >= public.seoul_today()
  order by m.start_date
  limit 1
) cur on true
left join public.membership_plans pl on pl.plan_code = cur.plan_code
left join lateral (
  select
    sum(x.days)::integer as used_days,
    count(*)::integer    as used_count,
    max(x.hold_end)  filter (where x.cancelled_at is null and x.hold_start <= public.seoul_today() and x.hold_end >= public.seoul_today()) as holding_until,
    min(x.hold_start) filter (where x.cancelled_at is null and x.hold_start > public.seoul_today()) as next_hold_start
  from public.membership_holds x
  where x.membership_id = cur.id
) h on cur.id is not null;

