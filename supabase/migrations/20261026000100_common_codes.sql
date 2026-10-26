-- =========================================================
-- 공통코드 (7-1 보완)
--
-- 회원 역할(ROLE), 회원 상태(STATUS)처럼 "정해진 값 목록"을 한 곳에서 관리합니다.
--   code_groups : 코드 묶음 (예: ROLE = 회원 역할)
--   codes       : 묶음 안의 값 (예: ROLE / admin / 관리자)
--
-- 얻는 것
--   1) 화면에 보여줄 한글 이름, 정렬 순서, 사용 여부를 DB 한 곳에서 관리 → 수정 화면의 콤보박스를 이 목록으로 채움
--   2) 새 상태(예: 정지)를 추가할 때 테이블 구조 변경 없이 INSERT 한 줄이면 됨
--   3) profiles.role, profiles.status는 이 목록에 있는 값만 들어갈 수 있음 (외래키로 DB가 강제)
--
-- ⚠️ 주의
--   - 코드 "값"(member, admin, pending, active, inactive)은 앱 로직이 직접 쓰므로 지우거나 이름을 바꾸면 안 됩니다.
--     바꿔도 되는 것: 화면 표시 이름(name), 정렬(sort_order), 사용 여부(is_active)
--   - ROLE/member 와 STATUS/pending 은 회원가입 트리거가 기본값으로 쓰므로 반드시 있어야 합니다. (없으면 가입이 실패함)
--   - 코드 추가/수정은 이 SQL Editor에서만 합니다. 사이트(API)로는 읽기만 가능합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (7-1 실행 후에)
-- =========================================================


-- 1) 코드 그룹
create table public.code_groups (
  group_code   text primary key check (group_code ~ '^[A-Z][A-Z0-9_]{0,29}$'),
  name         text not null check (char_length(name) between 1 and 50),
  description  text check (description is null or char_length(description) <= 200)
);

comment on table public.code_groups is '공통코드 그룹 (예: ROLE, STATUS)';


-- 2) 코드 값 (그룹 + 코드가 합쳐서 PK)
create table public.codes (
  group_code  text not null references public.code_groups (group_code),
  code        text not null check (code ~ '^[A-Za-z][A-Za-z0-9_]{0,29}$'),
  name        text not null check (char_length(name) between 1 and 50),
  sort_order  integer not null default 0,        -- 콤보박스에 보여줄 순서 (작을수록 위)
  is_active   boolean not null default true,     -- false면 콤보박스에서 숨김 (이미 그 값을 가진 회원은 그대로 유효)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (group_code, code)
);

comment on table  public.codes            is '공통코드 값';
comment on column public.codes.name       is '화면에 보여줄 이름 (한글)';
comment on column public.codes.sort_order is '콤보박스 정렬 순서';
comment on column public.codes.is_active  is '새로 선택할 수 있는 코드인지 (false면 콤보박스에서 숨김)';

create trigger codes_set_updated_at
  before update on public.codes
  for each row
  execute function public.set_updated_at();


-- 3) 접근 권한: 읽기만 공개, 쓰기는 아무에게도 열지 않음
--    역할/상태 이름은 민감한 정보가 아니라서 로그인하지 않은 방문자도 읽을 수 있게 합니다. (나중에 WOD 종류 등도 같은 방식으로 쓸 수 있음)
alter table public.code_groups enable row level security;
alter table public.codes enable row level security;

revoke all on public.code_groups from anon, authenticated;
revoke all on public.codes from anon, authenticated;
grant select on public.code_groups to anon, authenticated;
grant select on public.codes to anon, authenticated;

create policy "누구나 코드 그룹 읽기"
  on public.code_groups
  for select
  to anon, authenticated
  using (true);

create policy "누구나 코드 읽기"
  on public.codes
  for select
  to anon, authenticated
  using (true);


-- 4) 기본 코드 넣기
insert into public.code_groups (group_code, name, description) values
  ('ROLE',   '회원 역할', '일반회원 / 관리자'),
  ('STATUS', '회원 상태', '승인대기 / 활동 / 비활동(회원권 종료)');

insert into public.codes (group_code, code, name, sort_order) values
  ('ROLE',   'member',   '일반회원', 10),
  ('ROLE',   'admin',    '관리자',   20),
  ('STATUS', 'pending',  '승인대기', 10),
  ('STATUS', 'active',   '활동',     20),
  ('STATUS', 'inactive', '비활동',   30);


-- 5) profiles의 role, status가 위 목록의 값만 갖도록 연결
--    외래키(FK)는 "그룹 + 코드" 두 컬럼으로 연결해야 해서, 그룹 이름을 항상 같은 값으로 가진 컬럼을 하나씩 둡니다.
--    generated always as (...) stored = 값이 항상 자동으로 계산되는 컬럼 (사용자가 직접 바꿀 수 없음)
alter table public.profiles
  add column role_group   text generated always as ('ROLE'::text)   stored,
  add column status_group text generated always as ('STATUS'::text) stored;

-- 예전 방식(값을 코드에 직접 적은 check 제약)은 지우고, 공통코드 연결로 대체
alter table public.profiles
  drop constraint if exists profiles_role_check,
  drop constraint if exists profiles_status_check;

-- 기존 회원들의 값이 목록에 있는지도 이 시점에 함께 검사됩니다.
alter table public.profiles
  add constraint profiles_role_fk
    foreign key (role_group, role) references public.codes (group_code, code),
  add constraint profiles_status_fk
    foreign key (status_group, status) references public.codes (group_code, code);
