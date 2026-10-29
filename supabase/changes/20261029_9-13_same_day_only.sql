-- =========================================================
-- 9-13) 출석/결석은 수업 당일에만 처리 (하루가 지나면 확정)
--
--   수요일 수업에서 출석으로 기록된 회원을 목요일에 결석으로 바꾸는 일은 할 수 없습니다.
--   수요일에 출석이 되면 그걸로 확정이고, 코치가 정정하려면 수요일(수업 당일, 한국 시간 자정 전)에 해야 합니다.
--
--   규칙 (9-11, 9-12의 규칙에서 "당일" 제한만 추가)
--     - 출석 처리, 결석 처리, 결석 취소: 수업 날짜가 오늘(한국 시간)일 때만 가능. 하루가 지나면 모두 거부합니다.
--     - 결석 처리는 그날 수업이 끝난 뒤부터, 출석 처리는 수업이 시작된 뒤부터 (기존과 같음)
--     - 당일에 아무것도 안 누르면 수업이 끝난 뒤 자동으로 출석 처리되고(10분 안), 날이 바뀌면 그대로 확정됩니다.
--   바뀌는 것: admin_mark_attendance / admin_mark_absent / admin_unmark_absent 3개 함수에 "당일" 확인 추가
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

create or replace function public.admin_mark_attendance(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ctype text;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.status <> 'confirmed' then
    raise exception '출석 처리할 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if res.user_id is null then
    raise exception '드랍인/체험은 출석 일수를 기록하지 않습니다.' using errcode = 'MB004';
  end if;
  select class_type into ctype from public.class_slots where id = res.slot_id;
  if ctype = 'COACH_TRAINING' then
    raise exception '코치 트레이닝은 출석 일수에 포함되지 않습니다.' using errcode = 'MB004';
  end if;
  if public.class_start_at(res.slot_id, res.class_date) > now() then
    raise exception '수업이 시작된 뒤에 출석 처리할 수 있습니다.' using errcode = 'MB012';
  end if;
  if res.class_date <> public.seoul_today() then
    raise exception '출석은 수업 당일에만 처리할 수 있습니다. (하루가 지나면 출석이 확정됩니다)' using errcode = 'MB012';
  end if;
  if res.attended_at is not null then
    return;                                  -- 이미 출석 처리됨 (두 번 눌러도 한 번만)
  end if;

  update public.reservations set attended_at = now(), absent_at = null where id = res.id;
  insert into public.attendances (user_id, attend_date, class_count)
  values (res.user_id, res.class_date, 1)
  on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + 1;
end;
$$;

revoke execute on function public.admin_mark_attendance(bigint) from public, anon;
grant execute on function public.admin_mark_attendance(bigint) to authenticated;


create or replace function public.admin_mark_absent(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ctype text;
  was_attended boolean;
  ends_at timestamptz;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.status <> 'confirmed' then
    raise exception '결석 처리할 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  if res.user_id is null then
    raise exception '드랍인/체험은 출석 일수를 기록하지 않습니다.' using errcode = 'MB004';
  end if;
  select class_type into ctype from public.class_slots where id = res.slot_id;
  if ctype = 'COACH_TRAINING' then
    raise exception '코치 트레이닝은 출석 일수에 포함되지 않습니다.' using errcode = 'MB004';
  end if;
  select ((res.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul')
    into ends_at
    from public.class_slots s where s.id = res.slot_id;
  if ends_at > now() then
    raise exception '수업이 끝난 뒤에 결석 처리할 수 있습니다.' using errcode = 'MB012';
  end if;
  if res.class_date <> public.seoul_today() then
    raise exception '결석은 수업 당일에만 처리할 수 있습니다. (하루가 지나면 출석이 확정됩니다)' using errcode = 'MB012';
  end if;
  if res.absent_at is not null then
    return;                                  -- 이미 결석 처리됨
  end if;

  was_attended := res.attended_at is not null;
  update public.reservations set absent_at = now(), attended_at = null where id = res.id;

  if was_attended then
    -- 같은 날 출석 처리된 다른 수업이 있으면 그날은 출석 유지(수업 수만 하나 줄임), 없으면 그날 출석을 지움
    if exists (
      select 1 from public.reservations o
       where o.user_id = res.user_id and o.class_date = res.class_date
         and o.attended_at is not null and o.id <> res.id
    ) then
      update public.attendances
         set class_count = greatest(class_count - 1, 1)
       where user_id = res.user_id and attend_date = res.class_date;
    else
      delete from public.attendances where user_id = res.user_id and attend_date = res.class_date;
    end if;
  end if;
end;
$$;

revoke execute on function public.admin_mark_absent(bigint) from public, anon;
grant execute on function public.admin_mark_absent(bigint) to authenticated;


create or replace function public.admin_unmark_absent(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  res public.reservations%rowtype;
  ends_at timestamptz;
begin
  perform public.require_admin();

  select * into res from public.reservations where id = p_reservation_id for update;
  if not found or res.absent_at is null then
    raise exception '결석 처리된 예약을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  if res.class_date <> public.seoul_today() then
    raise exception '결석 취소는 수업 당일에만 할 수 있습니다. (하루가 지나면 확정됩니다)' using errcode = 'MB012';
  end if;

  update public.reservations set absent_at = null where id = res.id;

  select ((res.class_date + coalesce(s.end_time, s.start_time + interval '1 hour')) at time zone 'Asia/Seoul')
    into ends_at
    from public.class_slots s where s.id = res.slot_id;

  if ends_at <= now() and res.status = 'confirmed' and res.user_id is not null then
    update public.reservations set attended_at = now() where id = res.id;
    insert into public.attendances (user_id, attend_date, class_count)
    values (res.user_id, res.class_date, 1)
    on conflict (user_id, attend_date) do update set class_count = public.attendances.class_count + 1;
  end if;
end;
$$;

revoke execute on function public.admin_unmark_absent(bigint) from public, anon;
grant execute on function public.admin_unmark_absent(bigint) to authenticated;
