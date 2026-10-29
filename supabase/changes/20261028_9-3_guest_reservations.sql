-- =========================================================
-- 9-3) 드랍인 / 체험 예약 (회원이 아닌 방문자를 관리자가 직접 수업에 넣기)
--
--   드랍인이나 체험으로 오는 분은 회원이 아니라서 로그인 계정이 없습니다. 관리자가 이름과 구분(드랍인/체험)만 적어서 수업 예약자에 넣어 줍니다.
--   예약자 목록에는 "홍길동(드랍인)", "홍길순(체험)"처럼 나옵니다.
--
--   규칙
--     - 구분은 공통코드 GUEST_TYPE: DROPIN 드랍인 / TRIAL 체험. (이름을 바꾸거나 구분을 늘릴 때는 공통코드만 고치면 됩니다)
--     - 관리자만 넣을 수 있고, 취소도 관리자가 기존 "취소" 버튼으로 합니다. (취소하면 대기자가 자동 승급)
--     - 정원에 포함됩니다. 정원이 차 있으면 넣을 수 없습니다. (정원을 20 → 30명으로 늘린 뒤 넣으세요)
--     - 대기 없이 바로 "예약"으로 들어갑니다. 오늘 이후(최대 14일 후)의 수업에만 넣을 수 있고, 이미 시작한 오늘 수업에도 넣을 수 있습니다.
--     - 같은 수업에 같은 이름은 한 번만 넣을 수 있습니다. (두 번 눌러도 중복되지 않게. 동명이인이면 이름 뒤에 숫자를 붙이세요)
--     - 저장하는 개인정보는 이름뿐입니다. 이름은 수업 예약자 목록으로 회원에게도 보입니다.
--
--   바뀌는 것
--     - reservations.user_id가 비어 있을 수 있게 되고(게스트), guest_name / guest_type 컬럼이 생깁니다.
--       회원 예약은 user_id가 있고 게스트 정보가 없는 것, 게스트 예약은 그 반대인 것만 허용합니다.
--     - get_class_attendees: 게스트도 목록에 나오게 하고 guest_label(드랍인/체험) 컬럼을 추가합니다. (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   순서: 코드와 SQL 중 어느 쪽을 먼저 반영해도 사이트가 깨지지 않습니다. (SQL을 실행하기 전에는 "게스트 추가" 폼이 나타나지 않을 뿐입니다.)
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 게스트 구분 공통코드
insert into public.code_groups (group_code, name, description)
values ('GUEST_TYPE', '게스트 구분', '회원이 아닌 예약자: 드랍인 / 체험')
on conflict (group_code) do nothing;

insert into public.codes (group_code, code, name, sort_order) values
  ('GUEST_TYPE', 'DROPIN', '드랍인', 10),
  ('GUEST_TYPE', 'TRIAL',  '체험',   20)
on conflict (group_code, code) do nothing;


-- 2) 예약 테이블: 회원 또는 게스트
--    guest_type_group: 게스트일 때만 'GUEST_TYPE'으로 자동 계산 (공통코드 외래키용. 회원 예약은 비어 있어서 외래키 검사를 건너뜀)
alter table public.reservations alter column user_id drop not null;

alter table public.reservations
  add column if not exists guest_name text check (guest_name is null or char_length(guest_name) between 1 and 30),
  add column if not exists guest_type text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'reservations' and column_name = 'guest_type_group'
  ) then
    alter table public.reservations
      add column guest_type_group text generated always as (case when guest_type is not null then 'GUEST_TYPE'::text end) stored;
  end if;
end
$$;

alter table public.reservations drop constraint if exists reservations_guest_type_fk;
alter table public.reservations
  add constraint reservations_guest_type_fk foreign key (guest_type_group, guest_type) references public.codes (group_code, code);

alter table public.reservations drop constraint if exists reservations_member_or_guest;
alter table public.reservations
  add constraint reservations_member_or_guest check (
    (user_id is not null and guest_name is null and guest_type is null)
    or (user_id is null and guest_name is not null and guest_type is not null)
  );

-- 같은 수업에 같은 이름의 게스트를 두 번 넣을 수 없음 (대소문자 무시)
create unique index if not exists reservations_guest_unique
  on public.reservations (slot_id, class_date, lower(guest_name))
  where guest_name is not null and status <> 'cancelled';

comment on column public.reservations.guest_name is '게스트(드랍인/체험) 이름. 회원 예약이면 비어 있음';
comment on column public.reservations.guest_type is '게스트 구분 (공통코드 GUEST_TYPE: DROPIN, TRIAL). 회원 예약이면 비어 있음';


-- 3) 관리자: 게스트 예약 추가. 돌려주는 값: 예약 번호
create or replace function public.admin_add_guest_reservation(
  p_slot_id    bigint,
  p_class_date date,
  p_guest_name text,
  p_guest_type text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  today   date := public.seoul_today();
  slot    public.class_slots%rowtype;
  gname   text := btrim(coalesce(p_guest_name, ''));
  taken   integer;
  new_id  bigint;
begin
  perform public.require_admin();

  if gname = '' or char_length(gname) > 30 or gname ~ '[[:cntrl:]]' then
    raise exception '이름은 30자 이하의 글자로 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_guest_type is null or not exists (
       select 1 from public.codes where group_code = 'GUEST_TYPE' and code = p_guest_type and is_active
     ) then
    raise exception '드랍인 또는 체험을 선택해 주세요.' using errcode = 'MB004';
  end if;
  if p_class_date is null or p_class_date < today or p_class_date > today + 14 then
    raise exception '오늘부터 14일 후까지의 수업에만 추가할 수 있습니다.' using errcode = 'MB004';
  end if;

  select * into slot from public.class_slots where id = p_slot_id for update;      -- 수업 잠금 (정원 확인과 동시에 들어오는 예약을 순서대로 처리)
  if not found or not slot.is_active then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if extract(isodow from p_class_date)::integer <> slot.weekday then
    raise exception '해당 날짜에 열리지 않는 수업입니다.' using errcode = 'MB004';
  end if;

  select count(*) into taken
    from public.reservations
   where slot_id = p_slot_id and class_date = p_class_date and status = 'confirmed';
  if taken >= public.class_capacity(p_slot_id, p_class_date) then
    raise exception '정원이 가득 찼습니다. 정원을 늘린 뒤 추가해 주세요.' using errcode = 'MB004';
  end if;

  begin
    insert into public.reservations (slot_id, class_date, guest_name, guest_type, status)
    values (p_slot_id, p_class_date, gname, p_guest_type, 'confirmed')
    returning id into new_id;
  exception when unique_violation then
    raise exception '같은 이름이 이미 이 수업에 있습니다. (동명이인이면 이름 뒤에 숫자를 붙여 주세요)' using errcode = 'MB014';
  end;

  return new_id;
end;
$$;

revoke execute on function public.admin_add_guest_reservation(bigint, date, text, text) from public, anon;
grant execute on function public.admin_add_guest_reservation(bigint, date, text, text) to authenticated;


-- 4) 수업 예약자 보기: 게스트도 나오게 하고 guest_label 컬럼 추가 (9-2의 접근 확인은 그대로)
--    결과 컬럼이 늘어서 함수를 지우고 다시 만듭니다.
drop function if exists public.get_class_attendees(date, date);

create function public.get_class_attendees(p_from date, p_to date)
returns table (
  slot_id        bigint,
  class_date     date,
  status         text,
  queue_no       integer,
  name           text,
  avatar_url     text,
  is_me          boolean,
  reservation_id bigint,
  guest_label    text
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
    coalesce(p.name, r.guest_name),
    p.avatar_url,
    (r.user_id is not null and r.user_id = auth.uid()),
    case when caller_is_admin then r.id end,
    gc.name
  from public.reservations r
  left join public.profiles p on p.user_id = r.user_id
  left join public.codes gc on gc.group_code = r.guest_type_group and gc.code = r.guest_type
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;
