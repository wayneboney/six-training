-- =========================================================
-- 관리자 복구: 초기화 후 "내 계정"을 관리자로 다시 등록합니다. (테이블이 모두 만들어진 다음에 실행)
--   관리자는 profiles.role = 'admin' 인 계정입니다.
--   1) 아래 이메일을 관리자 로그인 이메일로 바꾸세요.
--   2) 0건이면 이메일을 확인하세요:  select id, email from auth.users;
-- =========================================================
update public.profiles
   set role = 'admin', status = 'active', name = '김보규'
 where user_id in (select id from auth.users where email = '여기에_관리자_이메일');

-- 확인: 1줄이 나오면 성공
select user_id, name, role, status from public.profiles where role = 'admin';
