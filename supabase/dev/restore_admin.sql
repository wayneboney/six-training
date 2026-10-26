-- =========================================================
-- 관리자 복구: 초기화 후 "내 계정"을 관리자로 다시 등록합니다. (테이블이 모두 만들어진 다음에 실행)
--   1) 아래 이메일을 관리자 로그인 이메일로 바꾸세요.
--   2) 등록된 계정이 없으면 0건으로 끝납니다. 그땐 이메일을 확인하세요:
--        select id, email from auth.users;
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
with target as (
  select id from auth.users where email = '여기에_관리자_이메일'
), a as (
  insert into public.admins (user_id, name)
  select id, '김보규' from target
  on conflict (user_id) do update set name = excluded.name
  returning user_id
)
update public.profiles
   set role = 'admin', status = 'active', name = '김보규'
 where user_id in (select user_id from a);

-- 확인: 1줄이 나오면 성공
select p.user_id, p.name, p.role, p.status from public.profiles p where p.role = 'admin';
