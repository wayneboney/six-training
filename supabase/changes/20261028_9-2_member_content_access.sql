-- =========================================================
-- 9-2) WOD와 수업 예약은 "회원권이 유효한 회원"(과 관리자)만 볼 수 있게 제한
--
--   누가 볼 수 있나 (can_view_member_content)
--     - 관리자
--     - 일반회원 중 상태가 '활동'이고, 오늘(한국 시간) 이후까지 유효한 회원권이 있는 사람 (시작 전인 회원권도 포함, 홀딩 중이어도 포함)
--     - 로그인하지 않은 방문자, 승인 대기, 비활동(회원권 종료) 회원은 볼 수 없음
--
--   DB에서 막는 곳 (화면을 거치지 않고 API를 직접 호출해도 막힘)
--     1) wods 테이블 읽기 규칙(RLS): 위 조건을 만족해야 읽힘. 쓰기(관리자만)는 그대로
--     2) get_class_schedule (수업 시간표/정원/내 예약) 와 get_class_attendees (예약자 목록)
--   수업 예약/취소 함수는 원래부터 "예약일에 회원권이 유효한 회원만" 가능해서 그대로 둡니다.
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 바로 이어서 코드를 배포(push)하세요.
--      (이전 코드는 로그인 없이 WOD를 읽어서, SQL 실행 후 새 코드가 배포되기 전까지 WOD 화면이 비어 보일 수 있습니다.
--       수업 예약은 영향 없음. 새 코드가 배포되면 바로 정상으로 돌아옵니다.)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 접근 확인 함수. 로그인한 사람이 "나는 볼 수 있나?"를 묻는 용도 (남의 정보는 알려주지 않음)
create or replace function public.can_view_member_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.user_id = (select auth.uid())
       and (
         p.role = 'admin'
         or (
           p.role = 'member'
           and p.status = 'active'
           and exists (
             select 1 from public.memberships m
              where m.user_id = p.user_id and m.end_date >= public.seoul_today()
           )
         )
       )
  );
$$;

revoke execute on function public.can_view_member_content() from public, anon;
grant execute on function public.can_view_member_content() to authenticated;


-- 2) WOD 읽기 규칙 교체: 로그인하지 않은 방문자(anon)의 권한을 회수하고, 접근 조건을 만족하는 사람만 읽게 함
revoke select on public.wods from anon;

drop policy if exists "누구나 WOD 읽기 가능" on public.wods;
drop policy if exists "로그인한 사용자만 WOD 읽기" on public.wods;
drop policy if exists "회원권이 유효한 회원만 WOD 읽기" on public.wods;

create policy "회원권이 유효한 회원만 WOD 읽기"
  on public.wods
  for select
  to authenticated
  using ((select public.can_view_member_content()));


-- 3) 수업 시간표 조회: 접근 확인 추가 (나머지는 8-4와 같음)
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
  if not public.can_view_member_content() then
    raise exception '회원권이 유효한 회원만 이용할 수 있습니다.' using errcode = 'MB004';
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

-- 4) 수업 예약자 보기: 접근 확인 추가 (나머지는 8-5와 같음)
create or replace function public.get_class_attendees(p_from date, p_to date)
returns table (
  slot_id        bigint,
  class_date     date,
  status         text,
  queue_no       integer,
  name           text,
  avatar_url     text,
  is_me          boolean,
  reservation_id bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not public.can_view_member_content() then
    raise exception '회원권이 유효한 회원만 이용할 수 있습니다.' using errcode = 'MB004';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 14 then
    raise exception '조회 기간이 올바르지 않습니다. (최대 15일)' using errcode = 'MB004';
  end if;

  return query
  select
    r.slot_id,
    r.class_date,
    r.status,
    (row_number() over (partition by r.slot_id, r.class_date, r.status order by r.id))::integer,
    p.name,
    p.avatar_url,
    (r.user_id = auth.uid()),
    case when caller_is_admin then r.id end
  from public.reservations r
  join public.profiles p on p.user_id = r.user_id
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;


-- 5) 확인용: WOD 읽기 규칙 목록 (SELECT 규칙은 '회원권이 유효한 회원만 WOD 읽기' 하나만 있어야 정상)
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'wods'
 order by cmd, policyname;
