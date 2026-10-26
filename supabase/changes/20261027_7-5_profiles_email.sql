-- =========================================================
-- 7-5) 관리자 회원 목록에서 회원을 구별할 수 있도록 profiles에 이메일 추가
--
--   이메일은 로그인 계정(auth.users)에만 있어서 관리자 화면에서 읽을 수 없었습니다.
--   그래서 가입할 때 profiles에도 복사해 둡니다. (이름이 같은 회원을 구별하기 위해)
--   - 회원 본인이 고칠 수 있는 컬럼은 여전히 name, avatar_url 둘뿐입니다. (email은 수정 불가)
--   - 가입 후 로그인 이메일을 바꾸는 기능은 아직 없습니다. 생기면 이 값도 같이 갱신해야 합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

alter table public.profiles
  add column email text check (email is null or char_length(email) <= 254);

comment on column public.profiles.email is '가입 이메일 (auth.users에서 복사. 관리자 목록 표시용)';

-- 이미 가입한 회원의 이메일 채우기
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.user_id
   and p.email is null;

-- 가입 트리거: 이메일도 함께 저장 (이 함수가 실패하면 가입 자체가 실패하므로 길이가 넘으면 잘라서 넣음)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (user_id, name, avatar_url, email)
  values (
    new.id,
    public.profile_name_from_metadata(meta),
    public.profile_avatar_from_metadata(meta),
    left(new.email, 254)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
