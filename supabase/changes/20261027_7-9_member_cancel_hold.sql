-- =========================================================
-- 7-9) 회원이 직접 홀딩 해제
--
--   해제 규칙 (관리자와 같은 함수 release_hold를 씁니다)
--     - 홀딩이 아직 시작 전: 사용 일수 0일 (종료일이 늘어났던 만큼 모두 되돌아옴)
--     - 홀딩 진행 중: 오늘부터 풀립니다. 어제까지 쉰 일수만 사용한 것으로 인정되고, 나머지는 종료일에서 빠집니다.
--         예) 4일 홀딩(종료일 +4) 중 2일 쉬고 해제 → 종료일은 2일만 늘어난 상태가 됩니다.
--     - 사용한 홀딩 "횟수"는 해제해도 돌아오지 않습니다.
--     - 이미 끝난 홀딩, 이미 해제한 홀딩은 해제할 수 없습니다.
--     - 해제하지 않고 홀딩 기간이 지나면 별도 처리 없이 그냥 끝납니다. (종료일은 이미 늘어나 있음)
--   회원은 본인 홀딩만 해제할 수 있습니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 내부용: 홀딩 해제(조기 종료) 규칙 전체. 관리자/회원 함수가 같이 씁니다. 돌려주는 값은 새 종료일
--   p_owner가 null이 아니면 그 회원의 홀딩만 해제할 수 있습니다. (회원이 남의 홀딩 번호를 보내도 못 지움)
create or replace function public.release_hold(p_hold_id bigint, p_owner uuid)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  today    date := public.seoul_today();
  owner_id uuid;
  h        public.membership_holds%rowtype;
  m        public.memberships%rowtype;
  new_end  date;
  freed    integer;
  old_end  date;
begin
  select m2.user_id into owner_id
    from public.membership_holds h2 join public.memberships m2 on m2.id = h2.membership_id
   where h2.id = p_hold_id;
  if owner_id is null or (p_owner is not null and owner_id <> p_owner) then
    raise exception '홀딩을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  perform public.lock_profile(owner_id);

  select * into h from public.membership_holds where id = p_hold_id for update;
  if not found then
    raise exception '홀딩을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  select * into m from public.memberships where id = h.membership_id for update;

  if h.cancelled_at is not null then
    raise exception '이미 취소된 홀딩입니다.' using errcode = 'MB010';
  end if;
  if h.hold_end < today then
    raise exception '이미 끝난 홀딩은 취소할 수 없습니다.' using errcode = 'MB010';
  end if;

  -- 오늘부터 홀딩 해제: 오늘 전날까지만 사용한 것으로 인정 (시작 전이면 0일)
  new_end := greatest(h.hold_start, today) - 1;
  freed   := h.hold_end - new_end;          -- 돌려받는 일수

  update public.membership_holds set hold_end = new_end, cancelled_at = now() where id = h.id;

  old_end := m.end_date;
  update public.memberships set end_date = end_date - freed where id = m.id;
  perform public.shift_following_memberships(m.user_id, old_end, -freed);

  return old_end - freed;
end;
$$;


-- 관리자 해제: 같은 규칙, 모든 회원의 홀딩 가능
create or replace function public.admin_cancel_hold(p_hold_id bigint)
returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return public.release_hold(p_hold_id, null);
end;
$$;

-- 회원 해제: 본인 홀딩만
create or replace function public.member_cancel_hold(p_hold_id bigint)
returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  return public.release_hold(p_hold_id, auth.uid());
end;
$$;

revoke execute on function public.release_hold(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.admin_cancel_hold(bigint) from public, anon;
grant execute on function public.admin_cancel_hold(bigint) to authenticated;
revoke execute on function public.member_cancel_hold(bigint) from public, anon;
grant execute on function public.member_cancel_hold(bigint) to authenticated;
