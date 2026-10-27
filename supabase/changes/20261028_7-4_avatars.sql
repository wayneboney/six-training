-- =========================================================
-- 7-4) 프로필 사진 저장소 (Supabase Storage) + 사진 주소 보호
--
--   저장소(버킷) avatars
--     - 공개 읽기: 사진 주소를 알면 누구나 볼 수 있습니다. (헤더/목록에 로그인 없이 쓰는 용도가 아니라, 주소가 추측하기 어려운 이름이라 사실상 본인과 관리자만 압니다)
--     - 올리기/지우기: 로그인한 회원이 "자기 번호 폴더(avatars/<내 user_id>/…)"에만 가능
--     - 파일 크기 2MB 이하, 형식은 jpg / png / webp만 (저장소가 직접 거부)
--
--   사진 주소 보호 (트리거)
--     회원이 API로 프로필의 avatar_url을 "아무 외부 주소"로 바꾸지 못하게 합니다.
--     (남의 사이트 이미지를 걸어서 관리자 화면 방문자의 IP를 수집하는 식의 악용을 막기 위해)
--     회원이 직접 바꿀 수 있는 값은 "비우기(null)" 또는 "내 폴더의 우리 저장소 사진 주소"뿐입니다.
--     카카오 가입 때 가입 트리거가 넣는 카카오 사진 주소는 영향을 받지 않습니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) 저장소 접근 규칙: 본인 폴더만
--    storage.foldername(name)[1] = 파일 경로의 첫 번째 폴더 이름 (우리는 user_id를 폴더 이름으로 씁니다)
drop policy if exists "아바타 본인 폴더 읽기" on storage.objects;
drop policy if exists "아바타 본인 폴더 업로드" on storage.objects;
drop policy if exists "아바타 본인 폴더 삭제" on storage.objects;

create policy "아바타 본인 폴더 읽기"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "아바타 본인 폴더 업로드"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "아바타 본인 폴더 삭제"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) avatar_url 직접 수정 제한
--    current_user = 'authenticated' 는 로그인한 회원이 API로 직접 수정하는 경우입니다.
create or replace function public.guard_profile_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and current_user = 'authenticated'
     and new.avatar_url !~ ('^https://[^/]+/storage/v1/object/public/avatars/' || new.user_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception '프로필 사진은 사이트에서 직접 올린 사진만 사용할 수 있습니다.' using errcode = 'MB004';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_avatar on public.profiles;
create trigger profiles_guard_avatar
  before update of avatar_url on public.profiles
  for each row
  execute function public.guard_profile_avatar();
