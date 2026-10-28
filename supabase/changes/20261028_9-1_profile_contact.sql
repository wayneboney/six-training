-- =========================================================
-- 9-1) 회원 연락처(전화번호), 생년월일, 성별
--
--   profiles.phone      : 숫자만 저장 (예: 01012345678). 화면에서는 010-1234-5678 로 보여줍니다.
--   profiles.birth_date : 생년월일 (날짜)
--   profiles.gender     : 성별. 공통코드(GENDER): M 남성 / F 여성. 상태/역할처럼 공통코드 목록의 값만 들어갈 수 있습니다.
--   기존 회원은 아직 값이 없어서 비어 있을 수 있습니다. (내 정보에서 입력하도록 안내)
--
--   누가 볼 수 있나 (개인정보라서 엄격하게)
--     - 본인: 자기 것을 보고 고칠 수 있음
--     - 관리자: 모든 회원 것을 볼 수 있음 (고치는 것은 회원 본인만)
--     - 다른 회원: 볼 수 없음. 수업 예약자 목록 등 회원끼리 보는 화면에는 이름과 사진만 나옵니다.
--   가입할 때 보내는 값은 가입 트리거가 엄격하게 검사해서 넣습니다. 형식이 틀리면 비워 두고 가입은 성공시킵니다. (가입이 실패하면 안 되므로)
--   회원 삭제 시 함께 삭제됩니다. (프로필이 삭제되므로)
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 성별 공통코드
insert into public.code_groups (group_code, name, description)
values ('GENDER', '성별', '남성 / 여성')
on conflict (group_code) do nothing;

insert into public.codes (group_code, code, name, sort_order) values
  ('GENDER', 'M', '남성', 10),
  ('GENDER', 'F', '여성', 20)
on conflict (group_code, code) do nothing;

-- 2) 컬럼 + 형식 검사
--    gender_group = 항상 'GENDER'로 자동 계산되는 컬럼 (공통코드의 그룹+코드 두 컬럼에 외래키를 걸기 위한 장치. 역할/상태와 같은 방식)
alter table public.profiles
  add column phone      text check (phone is null or phone ~ '^01[016789][0-9]{7,8}$'),
  add column birth_date date check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  add column gender       text,
  add column gender_group text generated always as ('GENDER'::text) stored;

alter table public.profiles
  add constraint profiles_gender_fk foreign key (gender_group, gender) references public.codes (group_code, code);

comment on column public.profiles.phone      is '휴대전화번호 (숫자만, 예: 01012345678). 본인과 관리자만 조회 가능';
comment on column public.profiles.birth_date is '생년월일. 본인과 관리자만 조회 가능';
comment on column public.profiles.gender     is '성별 (공통코드 GENDER: M, F). 본인과 관리자만 조회 가능';


-- 3) 가입 정보(메타데이터)에서 전화번호/생년월일/성별을 안전하게 뽑는 도우미. 형식이 틀리면 null (가입을 막지 않음)
create or replace function public.profile_phone_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(coalesce(meta ->> 'phone', ''), '[^0-9]', '', 'g') ~ '^01[016789][0-9]{7,8}$'
    then regexp_replace(meta ->> 'phone', '[^0-9]', '', 'g')
  end;
$$;

create or replace function public.profile_birth_from_metadata(meta jsonb)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  raw text := meta ->> 'birth_date';
  d   date;
begin
  if raw is null or raw !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  d := raw::date;                       -- 2월 30일 같은 없는 날짜는 여기서 에러 → 아래 exception에서 null
  if d < date '1900-01-01' or d > current_date then
    return null;
  end if;
  return d;
exception when others then
  return null;
end;
$$;

create or replace function public.profile_gender_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when meta ->> 'gender' in ('M', 'F') then meta ->> 'gender' end;
$$;

revoke execute on function public.profile_gender_from_metadata(jsonb) from public, anon, authenticated;
revoke execute on function public.profile_phone_from_metadata(jsonb) from public, anon, authenticated;
revoke execute on function public.profile_birth_from_metadata(jsonb) from public, anon, authenticated;


-- 4) 가입 트리거: 전화번호, 생년월일, 성별도 함께 저장 (role/status는 여전히 읽지 않음)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (user_id, name, avatar_url, email, phone, birth_date, gender)
  values (
    new.id,
    public.profile_name_from_metadata(meta),
    public.profile_avatar_from_metadata(meta),
    left(new.email, 254),
    public.profile_phone_from_metadata(meta),
    public.profile_birth_from_metadata(meta),
    public.profile_gender_from_metadata(meta)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


-- 5) 회원 본인이 고칠 수 있는 컬럼에 추가 (role, status, email 등은 여전히 불가)
grant update (phone, birth_date, gender) on public.profiles to authenticated;
