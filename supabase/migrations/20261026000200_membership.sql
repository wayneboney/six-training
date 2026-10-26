-- =========================================================
-- 회원권 + 홀딩 (7-1 보완)
--
-- 구조
--   membership_plans  : 회원권 종류와 홀딩 규칙 (1개월권, 3개월권, 6개월권)
--   memberships       : 회원이 구매한 회원권 한 건 (시작일, 종료일)
--   membership_holds  : 그 회원권의 홀딩 한 건 (기간)
--
-- 규칙
--   1) 종료일 = 시작일 + N개월 - 1일. 종료일 당일까지 이용 가능합니다. (예: 10/26 시작 1개월권 → 11/25까지)
--   2) 홀딩 규칙은 회원권 종류별로 정해져 있고, 회원권을 만들 때 복사해서 저장합니다.
--        1개월권: 총 3일, 1회 / 3개월권: 총 7일, 최대 2회 / 6개월권: 총 14일, 최대 4회
--      허용 일수 안에서 하루 단위로 나눠 쓸 수 있고, 남은 일수는 회원권이 끝나면 소멸합니다.
--   3) 홀딩하면 종료일이 홀딩 일수만큼 늘어납니다. 뒤에 이어서 등록된 회원권도 같이 밀립니다.
--   4) 만료 전에 재등록하면 현재 회원권이 끝난 다음 날부터 이어서 시작합니다. (재등록한 회원권은 홀딩 규칙도 새로 적용)
--   5) 종료일이 지나면 매일 새벽에 자동으로 '비활동'으로 바뀝니다. (스케줄은 다음 마이그레이션)
--      단, 예약 가능 여부는 상태값이 아니라 "오늘 유효한 회원권이 있는지"로 직접 확인합니다. (챕터 8)
--   6) 남은 일수는 저장하지 않고 계산합니다. (member_membership_status 뷰)
--
-- 오류 코드 (관리자 함수가 돌려주는 SQLSTATE, 사이트가 안내 문구로 바꿔 보여줌)
--   42501 권한 없음 / MB002 대상 없음 / MB003 선택할 수 없는 값 / MB004 입력값이 올바르지 않음
--   MB005 자기 자신 보호 / MB007 회원권 기간 문제 / MB008 홀딩 횟수 초과 / MB009 홀딩 일수 초과
--   MB010 취소할 수 없음 / MB011 홀딩 기간이 겹침
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (공통코드 다음에)
-- =========================================================


-- 0) 오늘 날짜 (한국 시간). 서버 시간대(UTC)와 상관없이 한국 날짜로 계산합니다.
create or replace function public.seoul_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

revoke execute on function public.seoul_today() from public, anon;
grant execute on function public.seoul_today() to authenticated;


-- 1) 회원권 종류 + 홀딩 규칙
create table public.membership_plans (
  plan_code       text primary key check (plan_code ~ '^[A-Z0-9_]{1,20}$'),
  name            text not null check (char_length(name) between 1 and 50),
  months          integer not null check (months between 1 and 36),
  hold_max_days   integer not null check (hold_max_days between 0 and 365),   -- 홀딩 총 허용 일수
  hold_max_count  integer not null check (hold_max_count between 0 and 20),   -- 홀딩 최대 횟수
  sort_order      integer not null default 0,
  is_active       boolean not null default true,                              -- false면 새로 등록할 수 없음
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.membership_plans is '회원권 종류와 홀딩 규칙';

create trigger membership_plans_set_updated_at
  before update on public.membership_plans
  for each row
  execute function public.set_updated_at();

insert into public.membership_plans (plan_code, name, months, hold_max_days, hold_max_count, sort_order) values
  ('M1', '1개월권', 1,  3, 1, 10),
  ('M3', '3개월권', 3,  7, 2, 20),
  ('M6', '6개월권', 6, 14, 4, 30);


-- 2) 회원이 구매한 회원권
create table public.memberships (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references public.profiles (user_id) on delete cascade,
  plan_code          text not null references public.membership_plans (plan_code),
  start_date         date not null,
  original_end_date  date not null,                          -- 구매 당시 종료일 (홀딩, 서비스 일수를 더하기 전)
  bonus_days         integer not null default 0 check (bonus_days >= 0),   -- 관리자가 서비스로 더해 준 일수
  end_date           date not null,                          -- 현재 종료일 = original_end_date + bonus_days + 홀딩 일수 합계
  hold_max_days      integer not null check (hold_max_days >= 0),    -- 이 회원권의 홀딩 규칙 (구매 당시 요금제 값을 복사)
  hold_max_count     integer not null check (hold_max_count >= 0),
  note               text check (note is null or char_length(note) <= 200),
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  check (original_end_date >= start_date),
  check (end_date >= original_end_date)
);

create index memberships_user_end_idx on public.memberships (user_id, end_date);

comment on table  public.memberships            is '회원이 구매한 회원권 (한 건 = 한 번의 구매)';
comment on column public.memberships.end_date   is '현재 종료일(이 날까지 이용 가능). 홀딩, 서비스 일수가 반영된 값';


-- 3) 홀딩
create table public.membership_holds (
  id             bigint generated always as identity primary key,
  membership_id  bigint not null references public.memberships (id) on delete cascade,
  hold_start     date not null,
  hold_end       date not null,
  days           integer generated always as (hold_end - hold_start + 1) stored,   -- 홀딩 일수 (시작일, 종료일 포함)
  note           text check (note is null or char_length(note) <= 200),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (hold_end >= hold_start)
);

create index membership_holds_membership_idx on public.membership_holds (membership_id);

comment on table public.membership_holds is '회원권 홀딩(일시정지) 기록';


-- 4) 접근 권한
--    읽기: 본인 것 + 관리자는 전체 / 쓰기: 아무에게도 열지 않음 (아래 관리자 함수로만 변경)
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_holds enable row level security;

revoke all on public.membership_plans from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
revoke all on public.membership_holds from anon, authenticated;

grant select on public.membership_plans to anon, authenticated;     -- 요금제 이름과 규칙은 공개해도 되는 정보
grant select on public.memberships to authenticated;
grant select on public.membership_holds to authenticated;

create policy "누구나 회원권 종류 읽기"
  on public.membership_plans
  for select
  to anon, authenticated
  using (true);

create policy "본인 또는 관리자만 회원권 읽기"
  on public.memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 홀딩은 부모 회원권을 볼 수 있는 사람만 볼 수 있음 (서브쿼리에도 위 회원권 규칙이 그대로 적용됨)
create policy "본인 또는 관리자만 홀딩 읽기"
  on public.membership_holds
  for select
  to authenticated
  using (exists (select 1 from public.memberships m where m.id = membership_id));


-- 5) 회원별 "현재 회원권" 요약 뷰 (관리자 회원 목록, 내 회원권 화면에서 사용)
--    현재 회원권 = 종료일이 오늘 이후인 회원권 중 가장 먼저 시작하는 것 (진행 중이거나, 곧 시작할 예정인 것)
--    security_invoker = 보는 사람의 권한으로 조회 → 위 RLS가 그대로 적용됨 (회원은 본인 것만, 관리자는 전체)
--    남은 일수(days_left)는 오늘을 포함해서 센 값입니다. 종료일 당일이면 1일. 홀딩 중에도 종료일까지의 날짜 수를 그대로 보여줍니다.
create view public.member_membership_status
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
    max(x.hold_end)  filter (where x.hold_start <= public.seoul_today() and x.hold_end >= public.seoul_today()) as holding_until,
    min(x.hold_start) filter (where x.hold_start > public.seoul_today()) as next_hold_start
  from public.membership_holds x
  where x.membership_id = cur.id
) h on cur.id is not null;

revoke all on public.member_membership_status from anon, authenticated;
grant select on public.member_membership_status to authenticated;


-- =========================================================
-- 관리자 전용 함수들 (SECURITY DEFINER)
--   security definer = 함수를 만든 사람(관리자) 권한으로 실행. 회원에게는 쓰기 권한이 없어도 함수 안에서는 쓸 수 있음
--   대신 모든 함수가 맨 앞에서 "호출한 사람이 관리자인지" 확인하고, 한 회원의 행을 잠가서(FOR UPDATE) 동시에 두 번 처리되지 않게 합니다.
--   set search_path = '' : 다른 스키마의 같은 이름 객체로 바꿔치기하는 공격 방지
-- =========================================================

-- 내부용: 관리자가 아니면 에러
create or replace function public.require_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

-- 내부용: 회원 행을 잠그고, 없으면 에러
create or replace function public.lock_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception '회원을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
end;
$$;

-- 내부용: 기준일 이후에 이어지는 회원권을 p_days일만큼 앞으로(또는 뒤로) 옮김. 홀딩, 서비스 일수로 종료일이 바뀔 때 사용
--   회원권은 "만료 전 재등록이면 바로 이어서 시작"이라는 규칙으로만 쌓이므로, 뒤에 있는 회원권은 모두 이어진 묶음입니다.
create or replace function public.shift_following_memberships(p_user_id uuid, p_after_end date, p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 홀딩 날짜를 먼저 옮기고(옮길 대상을 회원권의 옛 시작일로 찾기 때문), 그다음 회원권을 옮깁니다.
  update public.membership_holds h
     set hold_start = h.hold_start + p_days,
         hold_end   = h.hold_end   + p_days
    from public.memberships m
   where h.membership_id = m.id
     and m.user_id = p_user_id
     and m.start_date > p_after_end;

  update public.memberships
     set start_date        = start_date        + p_days,
         original_end_date = original_end_date + p_days,
         end_date          = end_date          + p_days
   where user_id = p_user_id
     and start_date > p_after_end;
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;
revoke execute on function public.lock_profile(uuid) from public, anon, authenticated;
revoke execute on function public.shift_following_memberships(uuid, date, integer) from public, anon, authenticated;


-- 회원권 등록 (신규 가입 승인, 재등록, 연장 모두 이 함수)
--   - 이미 유효하거나 예정된 회원권이 있으면 그 다음 날부터 이어서 시작합니다. (시작일을 직접 정할 수 없음)
--   - 없으면 시작일을 정할 수 있고, 비우면 오늘부터입니다.
--   - 지금 유효하거나 곧 시작하는 회원권이면 회원 상태를 '활동'으로 바꿉니다. (= 가입 승인)
create or replace function public.admin_register_membership(
  p_user_id    uuid,
  p_plan_code  text,
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

  select * into plan from public.membership_plans where plan_code = p_plan_code and is_active;
  if not found then
    raise exception '선택할 수 없는 회원권 종류입니다.' using errcode = 'MB003';
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

  v_end := (v_start + make_interval(months => plan.months))::date - 1;

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


-- 아직 시작하지 않은 홀딩 취소. 돌려주는 값은 새 종료일
--   이미 시작했거나 끝난 홀딩은 취소할 수 없습니다. (조기 해제 기능은 필요해지면 추가)
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

  if h.hold_start <= today then
    raise exception '이미 시작된 홀딩은 취소할 수 없습니다.' using errcode = 'MB010';
  end if;

  old_end := m.end_date;
  delete from public.membership_holds where id = h.id;
  update public.memberships set end_date = end_date - h.days where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, -h.days);

  return old_end - h.days;
end;
$$;


-- 서비스 일수 추가 (관리자가 직접 종료일을 늘려 줌). 돌려주는 값은 새 종료일
--   이미 끝난 회원권에는 쓸 수 없습니다. (새 회원권을 등록하세요)
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
begin
  perform public.require_admin();

  select user_id into owner_id from public.memberships where id = p_membership_id;
  if owner_id is null then
    raise exception '회원권을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  perform public.lock_profile(owner_id);
  select * into m from public.memberships where id = p_membership_id for update;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception '추가 일수는 1~365일로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception '메모는 200자 이하로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if m.end_date < today then
    raise exception '이미 끝난 회원권에는 일수를 추가할 수 없습니다. 새 회원권을 등록해 주세요.' using errcode = 'MB004';
  end if;

  old_end := m.end_date;
  update public.memberships
     set end_date = end_date + p_days,
         bonus_days = bonus_days + p_days,
         note = coalesce(p_note, note)
   where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, p_days);

  return old_end + p_days;
end;
$$;


-- 회원 역할/상태 수정 (수정 화면의 콤보박스)
--   - 공통코드에서 '사용 중'인 값만 새로 선택할 수 있습니다. (이미 가진 값을 그대로 두는 것은 허용)
--   - 일반회원을 '활동'으로 바꾸려면 유효하거나 예정된 회원권이 있어야 합니다. → 먼저 회원권 등록
--   - 자기 자신의 관리자 권한은 해제할 수 없습니다. (관리자가 아무도 없게 되는 것을 막기 위해)
create or replace function public.admin_update_member(
  p_user_id uuid,
  p_role    text,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.seoul_today();
  cur   public.profiles%rowtype;
begin
  perform public.require_admin();
  perform public.lock_profile(p_user_id);
  select * into cur from public.profiles where user_id = p_user_id;

  if p_role is distinct from cur.role
     and not exists (select 1 from public.codes where group_code = 'ROLE' and code = p_role and is_active) then
    raise exception '선택할 수 없는 역할입니다.' using errcode = 'MB003';
  end if;
  if p_status is distinct from cur.status
     and not exists (select 1 from public.codes where group_code = 'STATUS' and code = p_status and is_active) then
    raise exception '선택할 수 없는 상태입니다.' using errcode = 'MB003';
  end if;

  if p_user_id = auth.uid() and p_role is distinct from 'admin' then
    raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.' using errcode = 'MB005';
  end if;

  if p_role = 'member' and p_status = 'active'
     and not exists (select 1 from public.memberships where user_id = p_user_id and end_date >= today) then
    raise exception '유효하거나 예정된 회원권이 없습니다. 먼저 회원권을 등록해 주세요.' using errcode = 'MB004';
  end if;

  update public.profiles set role = p_role, status = p_status where user_id = p_user_id;
end;
$$;


-- 종료된 회원 자동 전환 (매일 새벽 스케줄로 실행): 유효하거나 예정된 회원권이 없는 '활동' 일반회원 → '비활동'
--   돌려주는 값은 전환된 회원 수. 사이트(API)로는 호출할 수 없고 DB 스케줄러만 실행합니다.
create or replace function public.expire_memberships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today   date := public.seoul_today();
  expired integer;
begin
  with changed as (
    update public.profiles p
       set status = 'inactive'
     where p.role = 'member'
       and p.status = 'active'
       and not exists (select 1 from public.memberships m where m.user_id = p.user_id and m.end_date >= today)
    returning 1
  )
  select count(*) into expired from changed;
  return expired;
end;
$$;

-- 관리자 화면에서 부르는 함수는 로그인한 사용자(authenticated)에게만 열고, 함수 안에서 관리자인지 다시 확인합니다.
revoke execute on function public.admin_register_membership(uuid, text, date, text) from public, anon;
revoke execute on function public.admin_add_hold(bigint, date, date, text) from public, anon;
revoke execute on function public.admin_cancel_hold(bigint) from public, anon;
revoke execute on function public.admin_add_membership_days(bigint, integer, text) from public, anon;
revoke execute on function public.admin_update_member(uuid, text, text) from public, anon;
grant execute on function public.admin_register_membership(uuid, text, date, text) to authenticated;
grant execute on function public.admin_add_hold(bigint, date, date, text) to authenticated;
grant execute on function public.admin_cancel_hold(bigint) to authenticated;
grant execute on function public.admin_add_membership_days(bigint, integer, text) to authenticated;
grant execute on function public.admin_update_member(uuid, text, text) to authenticated;

revoke execute on function public.expire_memberships() from public, anon, authenticated;
