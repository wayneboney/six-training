-- =========================================================
-- 회원 프로필 테이블 (7-1)
--
-- 로그인 계정(auth.users)은 Supabase가 관리하고, 우리 서비스의 회원 정보는 이 테이블에 둡니다.
--   role   : member(일반회원) / admin(코치 포함 관리자)
--   status : pending(승인대기) / active(활동) / inactive(휴면)  -- 수업 예약은 active만 가능하게 할 예정
--
-- 보안 원칙
--   1) 회원이 직접 고칠 수 있는 컬럼은 name, avatar_url 둘뿐입니다. role, status는 API로 못 바꿉니다.
--   2) 가입할 때 회원이 보내는 값(raw_user_meta_data)에서는 이름과 사진만 읽습니다. role/status는 절대 읽지 않습니다.
--   3) 프로필 행은 가입 트리거만 만듭니다. 회원이 직접 INSERT/DELETE 할 수 없습니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================


-- 1) 가입 정보에서 이름/프로필 사진을 뽑는 도우미 함수 (트리거와 기존 회원 옮기기에서 같이 씁니다)
--    immutable = 같은 입력이면 항상 같은 결과 (DB가 최적화할 수 있음)
--    set search_path = '' = 다른 스키마의 같은 이름 객체로 바꿔치기하는 공격을 막기 위해 스키마를 항상 명시

-- 이름: name → full_name → nickname → user_name 순서로 비어 있지 않은 첫 값, 50자까지, 없으면 '회원'
create or replace function public.profile_name_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(left(coalesce(
      nullif(btrim(meta ->> 'name'), ''),
      nullif(btrim(meta ->> 'full_name'), ''),
      nullif(btrim(meta ->> 'nickname'), ''),
      nullif(btrim(meta ->> 'user_name'), ''),
      ''
    ), 50)), ''),
    '회원'
  );
$$;

-- 프로필 사진: https:// 주소만 허용 (카카오 등 로그인 업체가 주는 값). 그 밖의 값은 버립니다.
create or replace function public.profile_avatar_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  -- 정규식은 반복 횟수를 255회까지만 지정할 수 있어서, 길이는 char_length로 따로 검사합니다.
  select case
    when meta ->> 'avatar_url' ~ '^https://[^[:space:]]+$' and char_length(meta ->> 'avatar_url') <= 500 then meta ->> 'avatar_url'
    when meta ->> 'picture'    ~ '^https://[^[:space:]]+$' and char_length(meta ->> 'picture')    <= 500 then meta ->> 'picture'
    else null
  end;
$$;

-- 도우미 함수는 DB 안에서만 쓰므로 API(anon, authenticated)로는 호출하지 못하게 막습니다.
revoke execute on function public.profile_name_from_metadata(jsonb) from public, anon, authenticated;
revoke execute on function public.profile_avatar_from_metadata(jsonb) from public, anon, authenticated;


-- 2) 테이블
--    references ... on delete cascade = 로그인 계정을 지우면 프로필도 함께 지워짐
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  -- 프로필 사진 주소. https만 허용 (javascript: 같은 이상한 값을 막기 위해)
  avatar_url  text check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://[^[:space:]]+$')),
  role        text not null default 'member' check (role in ('member', 'admin')),
  status      text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 관리자 화면에서 "승인대기 회원"을 가입순으로 보여줄 때 쓰는 인덱스
create index profiles_status_created_idx on public.profiles (status, created_at desc);

comment on table  public.profiles            is '회원 프로필. 로그인 계정(auth.users)과 1:1';
comment on column public.profiles.name       is '회원 이름 (화면 표시용)';
comment on column public.profiles.avatar_url is '프로필 사진 주소 (https만 허용)';
comment on column public.profiles.role       is '역할: member(일반회원), admin(관리자·코치)';
comment on column public.profiles.status     is '상태: pending(승인대기), active(활동), inactive(휴면)';

-- 수정할 때 updated_at 자동 갱신 (6-1에서 만든 함수 재사용)
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();


-- 3) 접근 권한: "필요한 것만 열기"
--    Supabase는 새 테이블에 기본으로 모든 권한을 열어 두므로, 먼저 전부 걷어내고 필요한 것만 다시 줍니다.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;                 -- 로그인한 사용자: 읽기 (아래 RLS가 범위를 제한)
grant update (name, avatar_url) on public.profiles to authenticated;  -- 고칠 수 있는 컬럼은 이 둘뿐 (role, status, user_id는 불가)
-- 로그인하지 않은 방문자(anon)는 아무 권한도 없습니다. INSERT/DELETE는 누구에게도 주지 않습니다.

-- 읽기: 본인 것, 그리고 관리자는 전체
create policy "본인 프로필 읽기"
  on public.profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "관리자는 모든 프로필 읽기"
  on public.profiles
  for select
  to authenticated
  using ((select public.is_admin()));

-- 수정: 본인 행만 (그리고 위 컬럼 권한 때문에 이름과 사진만)
create policy "본인 프로필 수정"
  on public.profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- 4) 가입하면 프로필을 자동으로 만드는 트리거
--    security definer = 함수를 만든 사람(관리자) 권한으로 실행. 회원에게는 INSERT 권한이 없어도 이 함수는 넣을 수 있음
--    ⚠️ 이 함수가 에러를 내면 회원가입 자체가 실패합니다. 그래서 이름/사진은 항상 안전한 값으로 만들어 넣습니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- role, status는 넣지 않습니다. → 기본값(member, pending)이 적용됩니다.
  insert into public.profiles (user_id, name, avatar_url)
  values (
    new.id,
    public.profile_name_from_metadata(meta),
    public.profile_avatar_from_metadata(meta)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- 5) 이미 있는 로그인 계정을 프로필로 옮기기
--    admins 테이블에 있는 계정 → role = admin, status = active, 이름은 admins.name 사용
--    그 밖의 계정 → role = member, status = pending
insert into public.profiles (user_id, name, avatar_url, role, status)
select
  u.id,
  coalesce(a.name, public.profile_name_from_metadata(coalesce(u.raw_user_meta_data, '{}'::jsonb))),
  public.profile_avatar_from_metadata(coalesce(u.raw_user_meta_data, '{}'::jsonb)),
  case when a.user_id is not null then 'admin'  else 'member'  end,
  case when a.user_id is not null then 'active' else 'pending' end
from auth.users u
left join public.admins a on a.user_id = u.id
on conflict (user_id) do nothing;
