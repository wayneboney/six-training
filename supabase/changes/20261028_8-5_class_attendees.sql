-- =========================================================
-- 8-5) 수업 예약자 보기 (회원/관리자 모두)
--
--   로그인한 누구나 수업별로 "누가 예약했는지(프로필 사진 + 이름)"와 대기 순서를 볼 수 있습니다.
--   - 돌려주는 정보는 이름, 프로필 사진 주소, 예약/대기 상태, 순번뿐입니다. (이메일, 회원 번호, 회원권 정보는 포함하지 않음)
--   - 취소한 예약은 나오지 않습니다.
--   - 예약 번호(reservation_id)는 관리자에게만 돌려줍니다. (관리자의 "대신 취소" 버튼용. 회원에게는 비어 있음)
--   - is_me = 내 예약인지 (화면에서 "나"로 표시, 내 대기 순번 안내에 사용)
--   회원이 서로의 이름과 사진을 볼 수 있으므로, 정식 공개 전에 개인정보처리방침에 안내가 필요합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (8-4 다음에)
-- =========================================================
create or replace function public.get_class_attendees(p_from date, p_to date)
returns table (
  slot_id        bigint,
  class_date     date,
  status         text,
  queue_no       integer,
  name           text,
  avatar_url     text,
  is_me          boolean,
  reservation_id bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 14 then
    raise exception '조회 기간이 올바르지 않습니다. (최대 15일)' using errcode = 'MB004';
  end if;

  return query
  select
    r.slot_id,
    r.class_date,
    r.status,
    (row_number() over (partition by r.slot_id, r.class_date, r.status order by r.id))::integer,
    p.name,
    p.avatar_url,
    (r.user_id = auth.uid()),
    case when caller_is_admin then r.id end
  from public.reservations r
  join public.profiles p on p.user_id = r.user_id
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;
