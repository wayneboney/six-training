-- =========================================================
-- 9-10) 출석 기록 보관 (수업을 지워도 출석 일수가 줄어들지 않게)
--
--   지금까지 출석 일수는 "시작 시각이 지난 예약"을 세어서 계산했습니다. 그래서 수업(시간표)을 삭제하면 예약 기록과 함께 출석도 사라졌습니다.
--   이제 출석한 날은 따로 보관합니다. (attendances 표: 회원 + 날짜, 하루에 한 번만 기록. 수업을 3번 들어도 그날은 1일)
--
--   규칙
--     - 출석 일수는 줄어들지 않습니다. 수업/예약 기록을 지워도 이미 기록된 출석은 그대로입니다.
--     - 기록되는 시점: 매시간 10분에 자동으로(pg_cron) 시작 시각이 지난 "예약" 상태 수업을 기록합니다.
--         수업을 삭제할 때도 지우기 직전에 한 번 더 기록하고 지웁니다.
--         조회할 때는 아직 기록되기 전인 최근 수업도 함께 세므로 늦게 반영되는 일은 없습니다.
--     - 출석으로 세는 것(9-8과 같음): 예약 상태가 "예약"이고 시작 시각이 지난 수업, 회원만, 코치 트레이닝 제외. 대기/취소/게스트/관리자는 제외
--     - 회원을 삭제하면 그 회원의 출석 기록도 함께 삭제됩니다.
--     - 월간 MVP(1~3위)도 이 출석 기록으로 계산합니다.
--
--   누가 볼 수 있나
--     - 회원: 자기 출석만 (get_my_attendance: 이번 달 / 지난달 / 전체)
--     - 관리자: 모든 회원 (admin_attendance_summary), 회원 목록과 회원 상세에 표시
--
--   이 SQL을 실행하면 지금까지의 예약 기록에서 출석을 한 번 기록해 둡니다. (테스트로 만든 예약도 출석으로 기록됩니다.
--   정식 오픈 전에 테스트 데이터를 지울 때는 attendances 표도 함께 비우세요: delete from public.attendances;)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 출석 기록 표 (접근은 아래 함수로만)
create table if not exists public.attendances (
  user_id     uuid not null references public.profiles (user_id) on delete cascade,
  attend_date date not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, attend_date)
);

alter table public.attendances enable row level security;
revoke all on public.attendances from anon, authenticated;

comment on table public.attendances is '회원의 출석한 날(하루 1회). 수업/예약 기록을 지워도 남음';


-- 2) 출석한 날 목록: 보관된 기록 + 아직 기록 전인 지난 수업의 예약. 날짜는 [p_from, p_to) 범위 (DB 안에서만 사용)
create or replace function public.attendance_days(p_from date, p_to date)
returns table (user_id uuid, attend_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.attend_date
    from public.attendances a
   where a.attend_date >= p_from and a.attend_date < p_to
  union
  select r.user_id, r.class_date
    from public.reservations r
    join public.class_slots s on s.id = r.slot_id
    join public.profiles p on p.user_id = r.user_id and p.role = 'member'
   where r.status = 'confirmed'
     and r.user_id is not null
     and s.class_type <> 'COACH_TRAINING'
     and r.class_date >= p_from and r.class_date < p_to
     and public.class_start_at(r.slot_id, r.class_date) <= now();
$$;

revoke execute on function public.attendance_days(date, date) from public, anon, authenticated;


-- 3) 지금까지의 출석을 보관 표에 기록 (이미 있는 날은 건너뜀)
create or replace function public.record_attendance()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.attendances (user_id, attend_date)
  select d.user_id, d.attend_date
    from public.attendance_days(date '2000-01-01', date '2100-01-01') d
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke execute on function public.record_attendance() from public, anon, authenticated;


-- 4) 월간 MVP도 출석 기록으로 계산 (9-9와 같고 출석 계산만 바뀜)
create or replace function public.monthly_mvp_core(p_month date)
returns table (user_id uuid, attend_days integer, mvp_rank integer)
language sql
stable
security definer
set search_path = ''
as $$
  with attend as (
    select d.user_id, count(*)::integer as days
      from public.attendance_days(
             date_trunc('month', p_month)::date,
             (date_trunc('month', p_month) + interval '1 month')::date
           ) d
     group by d.user_id
  ),
  ranked as (
    select a.user_id, a.days, (rank() over (order by a.days desc))::integer as rnk
      from attend a
  )
  select ranked.user_id, ranked.days, ranked.rnk from ranked where ranked.rnk <= 3;
$$;

revoke execute on function public.monthly_mvp_core(date) from public, anon, authenticated;


-- 5) 수업 삭제: 지우기 직전에 출석을 기록 (9-7과 같고 한 줄만 추가)
create or replace function public.admin_delete_class_slot(p_slot_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot    public.class_slots%rowtype;
  removed integer;
begin
  perform public.require_admin();

  select * into slot from public.class_slots where id = p_slot_id for update;      -- 수업 잠금 (동시에 들어오는 예약과 순서대로 처리)
  if not found or not slot.is_active then
    raise exception '수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;

  perform public.record_attendance();      -- 출석은 예약 기록과 별도로 남겨 둠 (수업을 지워도 출석 일수는 줄지 않음)

  delete from public.reservations where slot_id = p_slot_id;
  get diagnostics removed = row_count;

  -- 날짜별 정원 예외(class_capacity_overrides)는 수업과 함께 자동으로 지워집니다. (on delete cascade)
  delete from public.class_slots where id = p_slot_id;

  return removed;
end;
$$;

revoke execute on function public.admin_delete_class_slot(bigint) from public, anon;
grant execute on function public.admin_delete_class_slot(bigint) to authenticated;


-- 6) 회원 본인: 내 출석 일수 (이번 달 / 지난달 / 전체)
create or replace function public.get_my_attendance()
returns table (this_month integer, last_month integer, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  this_start date := date_trunc('month', public.seoul_today())::date;
  last_start date := (date_trunc('month', public.seoul_today()) - interval '1 month')::date;
  next_start date := (date_trunc('month', public.seoul_today()) + interval '1 month')::date;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  return query
  select
    (count(*) filter (where d.attend_date >= this_start and d.attend_date < next_start))::integer,
    (count(*) filter (where d.attend_date >= last_start and d.attend_date < this_start))::integer,
    (count(*))::integer
  from public.attendance_days(date '2000-01-01', date '2100-01-01') d
  where d.user_id = auth.uid();
end;
$$;

revoke execute on function public.get_my_attendance() from public, anon;
grant execute on function public.get_my_attendance() to authenticated;


-- 7) 관리자: 모든 회원의 출석 일수 (출석이 한 번이라도 있는 회원만)
create or replace function public.admin_attendance_summary()
returns table (user_id uuid, this_month integer, last_month integer, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  this_start date := date_trunc('month', public.seoul_today())::date;
  last_start date := (date_trunc('month', public.seoul_today()) - interval '1 month')::date;
  next_start date := (date_trunc('month', public.seoul_today()) + interval '1 month')::date;
begin
  perform public.require_admin();

  return query
  select
    d.user_id,
    (count(*) filter (where d.attend_date >= this_start and d.attend_date < next_start))::integer,
    (count(*) filter (where d.attend_date >= last_start and d.attend_date < this_start))::integer,
    (count(*))::integer
  from public.attendance_days(date '2000-01-01', date '2100-01-01') d
  group by d.user_id;
end;
$$;

revoke execute on function public.admin_attendance_summary() from public, anon;
grant execute on function public.admin_attendance_summary() to authenticated;


-- 8) 지금까지의 출석을 한 번 기록하고, 매시간 10분에 자동 기록 예약
select public.record_attendance();

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '자동 기록 예약 실패: 이 데이터베이스에서 pg_cron을 사용할 수 없습니다. Database → Extensions에서 확인해 주세요.';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.unschedule(jobid) from cron.job where jobname = 'record-attendance';
  perform cron.schedule('record-attendance', '10 * * * *', 'select public.record_attendance()');
exception when others then
  raise notice '자동 기록 예약 실패: %. Database → Extensions에서 pg_cron을 켠 뒤 다시 실행해 주세요.', sqlerrm;
end;
$$;
