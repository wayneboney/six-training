-- =========================================================
-- ⚠️ 개발용 초기화: 우리 서비스 테이블/함수를 전부 지웁니다. (public 스키마의 우리 객체만)
--   지워지는 것: WOD, 관리자 목록, 회원 프로필, 공통코드, 회원권, 홀딩, 관련 함수/뷰/트리거, 자동 전환 예약
--   안 지워지는 것: 로그인 계정(auth.users) → 가입/로그인 정보는 그대로 남습니다.
--   실서비스(회원 데이터가 생긴 뒤)에서는 절대 실행하지 마세요. 이 파일은 migrations 폴더에 두지 않았습니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 자동 전환 예약 삭제 (pg_cron이 켜져 있을 때만)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-memberships';
  end if;
end;
$$;

-- 가입 트리거 (auth.users에 걸려 있음)
drop trigger if exists on_auth_user_created on auth.users;

-- 뷰, 테이블 (참조하는 쪽부터)
drop view  if exists public.member_membership_status;
drop table if exists public.membership_holds  cascade;
drop table if exists public.memberships       cascade;
drop table if exists public.membership_plans  cascade;
drop table if exists public.profiles          cascade;
drop table if exists public.codes             cascade;
drop table if exists public.code_groups       cascade;
drop table if exists public.admins            cascade;
drop table if exists public.wods              cascade;

-- 함수
drop function if exists public.expire_memberships();
drop function if exists public.admin_update_member(uuid, text, text);
drop function if exists public.admin_add_membership_days(bigint, integer, text);
drop function if exists public.admin_cancel_hold(bigint);
drop function if exists public.admin_add_hold(bigint, date, date, text);
drop function if exists public.admin_register_membership(uuid, integer, date, text);
drop function if exists public.admin_register_membership(uuid, text, date, text);
drop function if exists public.shift_following_memberships(uuid, date, integer);
drop function if exists public.lock_profile(uuid);
drop function if exists public.require_admin();
drop function if exists public.seoul_today();
drop function if exists public.handle_new_user();
drop function if exists public.profile_avatar_from_metadata(jsonb);
drop function if exists public.profile_name_from_metadata(jsonb);
drop function if exists public.is_admin();
drop function if exists public.set_updated_at();
