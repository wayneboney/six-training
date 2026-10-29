-- =========================================================
-- 9-16) 예약자 목록에 "그날 출석 처리된 수업 수" 추가 (관리자용)
--
--   출석된 회원의 [취소] 확인창에서, 같은 날 다른 수업에도 출석이 있으면 "출석 일수가 줄어든다"는 경고를 띄우지 않기 위해
--   그 회원이 그날 출석 처리된 수업이 몇 개인지 알려 줍니다. (관리자에게만 값이 있음. 1이면 취소 시 그날 출석이 빠짐, 2 이상이면 그날은 그대로)
--
--   바뀌는 것: get_class_attendees에 day_attended 컬럼 추가 (결과 모양이 바뀌어서 함수를 지웠다가 다시 만듭니다)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

drop function if exists public.get_class_attendees(date, date);

create function public.get_class_attendees(p_from date, p_to date)
returns table (
  slot_id        bigint,
  class_date     date,
  status         text,
  queue_no       integer,
  name           text,
  avatar_url     text,
  is_me          boolean,
  reservation_id bigint,
  guest_label    text,
  mvp_rank       integer,
  attended       boolean,
  day_attended   integer
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
  if not public.can_view_member_content() then
    raise exception '회원권이 유효한 회원만 이용할 수 있습니다.' using errcode = 'MB004';
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
    coalesce(p.name, r.guest_name),
    p.avatar_url,
    (r.user_id is not null and r.user_id = auth.uid()),
    case when caller_is_admin then r.id end,
    gc.name,
    m.mvp_rank,
    case when caller_is_admin then (r.attended_at is not null) end,
    case when caller_is_admin then (count(*) filter (where r.attended_at is not null) over (partition by r.user_id, r.class_date))::integer end
  from public.reservations r
  left join public.profiles p on p.user_id = r.user_id
  left join public.codes gc on gc.group_code = r.guest_type_group and gc.code = r.guest_type
  left join public.monthly_mvp_core((date_trunc('month', public.seoul_today()) - interval '1 month')::date) m
         on m.user_id = r.user_id
  where r.class_date between p_from and p_to
    and r.status <> 'cancelled'
  order by r.class_date, r.slot_id, (r.status = 'waiting'), r.id;
end;
$$;

revoke execute on function public.get_class_attendees(date, date) from public, anon;
grant execute on function public.get_class_attendees(date, date) to authenticated;
