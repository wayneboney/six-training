-- =========================================================
-- 관리자 테이블 + WOD 쓰기 규칙
-- admins 테이블에 등록된 사람만 WOD를 등록/수정/삭제할 수 있게 합니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 관리자 테이블
--    auth.users = Supabase가 관리하는 로그인 계정 테이블
--    references ... on delete cascade = 계정을 지우면 관리자 등록도 함께 지워짐 (Oracle의 FK + ON DELETE CASCADE)
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  created_at  timestamptz not null default now()
);

comment on table  public.admins         is '관리자(코치) 목록. 여기 등록된 계정만 WOD를 쓸 수 있습니다.';
comment on column public.admins.user_id is '로그인 계정 ID (auth.users.id)';
comment on column public.admins.name    is '관리자 이름 (화면 표시용)';

-- admins 테이블도 RLS로 보호합니다.
-- 로그인한 사람은 "자기 자신"이 관리자인지만 확인할 수 있고, 다른 사람 목록은 볼 수 없습니다.
-- 관리자 추가/삭제는 SQL Editor(관리자 계정)에서만 합니다. (쓰기 규칙을 만들지 않음)
alter table public.admins enable row level security;

grant select on public.admins to authenticated;

create policy "본인 관리자 정보만 읽기"
  on public.admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));


-- 2) 관리자인지 확인하는 함수
--    security definer = 함수를 만든 사람(관리자) 권한으로 실행. RLS 규칙 안에서 admins 테이블을 안전하게 조회하기 위해 사용
--    set search_path = '' = 다른 스키마의 같은 이름 테이블로 바꿔치기하는 공격을 막기 위해 스키마를 명시적으로만 사용
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- 로그인하지 않은 방문자(anon)는 이 함수를 쓸 일이 없으므로 실행 권한을 뺍니다.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- 3) WOD 쓰기 규칙: 관리자만 등록/수정/삭제
grant insert, update, delete on public.wods to authenticated;

create policy "관리자만 WOD 등록"
  on public.wods
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "관리자만 WOD 수정"
  on public.wods
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "관리자만 WOD 삭제"
  on public.wods
  for delete
  to authenticated
  using ((select public.is_admin()));


-- 4) 수정할 때 updated_at을 자동으로 현재 시각으로 바꾸는 트리거 (Oracle의 BEFORE UPDATE 트리거와 같음)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger wods_set_updated_at
  before update on public.wods
  for each row
  execute function public.set_updated_at();
