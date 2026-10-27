-- =========================================================
-- 7-10) 회원 삭제 (관리자)
--
--   삭제되는 것: 로그인 계정(auth.users) → 프로필, 회원권, 홀딩 기록이 함께 삭제됨 (연결된 외래키가 cascade)
--   프로필 사진 파일은 DB에서 지울 수 없습니다. (Supabase가 SQL로 저장소 파일을 지우는 것을 막음)
--     → 사이트(Server Action)가 먼저 Storage API로 사진을 지우도록 하고, 이를 위해 관리자에게 avatars 읽기/삭제 권한을 줍니다.
--   '비활동' 전환(회원권 종료)은 아무것도 지우지 않습니다. 사진과 기록은 그대로 남습니다.
--
--   안전장치
--     - 관리자만 호출 가능
--     - 자기 자신은 삭제할 수 없음
--     - 관리자(role = admin) 계정은 삭제할 수 없음. 먼저 일반회원으로 바꾼 뒤 삭제해야 합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 관리자가 다른 회원의 프로필 사진 폴더를 조회/삭제할 수 있게 함
drop policy if exists "아바타 관리자 읽기" on storage.objects;
drop policy if exists "아바타 관리자 삭제" on storage.objects;

create policy "아바타 관리자 읽기"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));

create policy "아바타 관리자 삭제"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));

-- 2) 회원 삭제 함수
create or replace function public.admin_delete_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  perform public.require_admin();

  if p_user_id = auth.uid() then
    raise exception '자기 자신은 삭제할 수 없습니다.' using errcode = 'MB005';
  end if;

  perform public.lock_profile(p_user_id);
  select role into target_role from public.profiles where user_id = p_user_id;
  if target_role = 'admin' then
    raise exception '관리자 계정은 삭제할 수 없습니다. 먼저 역할을 일반회원으로 바꿔 주세요.' using errcode = 'MB005';
  end if;

  -- 로그인 계정을 지우면 프로필, 회원권, 홀딩이 같이 지워집니다.
  delete from auth.users where id = p_user_id;
end;
$$;

revoke execute on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;
