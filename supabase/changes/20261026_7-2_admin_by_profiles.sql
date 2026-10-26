-- =========================================================
-- 7-2) 관리자 판별을 profiles.role 기준으로 변경하고 admins 테이블 제거
--
--   이전: admins 테이블에 등록된 계정 = 관리자
--   이후: profiles.role = 'admin' 인 계정 = 관리자 (역할은 profiles 한 곳에서만 관리)
--
--   is_admin() 함수 하나만 바꾸면, 이 함수를 쓰는 모든 규칙(WOD 쓰기, 회원/회원권 읽기, 관리자 함수)이
--   자동으로 새 기준을 따릅니다. → 규칙을 한 곳(함수)에 모아 둔 덕분에 가능한 변경입니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (한 번에 실행되므로 중간에 오류가 나면 전부 취소됨)
-- =========================================================

-- 1) 안전장치: admins에만 있고 profiles에는 관리자로 안 되어 있는 계정이 있으면 먼저 관리자로 옮김
update public.profiles p
   set role = 'admin', status = 'active'
  from public.admins a
 where a.user_id = p.user_id
   and (p.role <> 'admin' or p.status <> 'active');

-- 2) 관리자 확인 함수 교체
--    security definer: profiles의 RLS를 거치지 않고 읽기 위해 (RLS 규칙 안에서 쓰이므로 필요)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where user_id = (select auth.uid())
       and role = 'admin'
  );
$$;

-- 3) 관리자가 최소 1명은 있어야 함 (없으면 아무도 관리자 화면에 못 들어가므로 여기서 중단)
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception '관리자(role=admin)가 한 명도 없습니다. 중단합니다. 먼저 관리자를 지정해 주세요.';
  end if;
end;
$$;

-- 4) 더 이상 쓰지 않는 admins 테이블 삭제
drop table public.admins;
