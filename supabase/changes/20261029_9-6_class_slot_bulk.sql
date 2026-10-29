-- =========================================================
-- 9-6) 수업 시간표 한꺼번에 설정
--
--   요일마다 하나씩 입력하지 않아도 되게 하는 관리자용 함수 3개
--     1) admin_add_class_slots       : 같은 시각, 종류, 정원의 수업을 여러 요일에 한 번에 추가 (예: 월~금 19:00 - 20:00 크로스핏)
--                                       하나라도 실패하면(예: 수요일에 같은 시각 수업이 이미 있음) 전부 취소되어 일부만 들어가지 않습니다.
--     2) admin_set_class_end_time    : 같은 시작 시각의 모든 (사용 중인) 수업의 종료 시각을 한 번에 설정 (예: 06:45 시작 → 07:45 종료)
--                                       종료 시각만 바꾸는 것이라 예약이 있어도 됩니다.
--     3) admin_fill_missing_end_times: 종료 시각이 비어 있는 수업을 "시작 + N분"으로 채움 (오픈짐 제외. 오픈짐은 시간대가 수업마다 달라서)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- 1) 여러 요일에 한 번에 추가. 돌려주는 값: 추가(또는 다시 사용)한 수업 수
create or replace function public.admin_add_class_slots(
  p_weekdays   integer[],
  p_start_time time,
  p_end_time   time,
  p_class_type text,
  p_capacity   integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  wd    integer;
  total integer := 0;
  names text[] := array['일', '월', '화', '수', '목', '금', '토'];
begin
  perform public.require_admin();

  if p_weekdays is null or cardinality(p_weekdays) = 0 then
    raise exception '요일을 하나 이상 선택해 주세요.' using errcode = 'MB004';
  end if;

  for wd in select distinct unnest(p_weekdays) order by 1 loop
    begin
      perform public.admin_add_class_slot(wd, p_start_time, p_end_time, p_class_type, p_capacity);
      total := total + 1;
    exception when sqlstate 'MB014' then
      -- 어느 요일에서 겹쳤는지 알려 줍니다. (이 예외로 이 함수에서 한 일은 모두 취소됨)
      raise exception '%요일에 같은 시각의 수업이 이미 있습니다. 그 요일을 빼고 다시 추가해 주세요.', names[wd + 1]
        using errcode = 'MB014';
    end;
  end loop;

  return total;
end;
$$;

revoke execute on function public.admin_add_class_slots(integer[], time, time, text, integer) from public, anon;
grant execute on function public.admin_add_class_slots(integer[], time, time, text, integer) to authenticated;


-- 2) 같은 시작 시각의 모든 수업에 종료 시각 설정. 돌려주는 값: 바꾼 수업 수
create or replace function public.admin_set_class_end_time(p_start_time time, p_end_time time)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform public.require_admin();

  if p_start_time is null or p_end_time is null then
    raise exception '시작 시각과 종료 시각을 입력해 주세요.' using errcode = 'MB004';
  end if;
  if p_end_time <= p_start_time then
    raise exception '종료 시각은 시작 시각보다 늦어야 합니다.' using errcode = 'MB004';
  end if;

  update public.class_slots
     set end_time = p_end_time
   where is_active and start_time = p_start_time;
  get diagnostics changed = row_count;

  if changed = 0 then
    raise exception '해당 시작 시각의 수업을 찾을 수 없습니다.' using errcode = 'MB002';
  end if;
  return changed;
end;
$$;

revoke execute on function public.admin_set_class_end_time(time, time) from public, anon;
grant execute on function public.admin_set_class_end_time(time, time) to authenticated;


-- 3) 종료 시각이 비어 있는 수업을 "시작 + N분"으로 채우기 (오픈짐 제외). 돌려주는 값: 채운 수업 수
create or replace function public.admin_fill_missing_end_times(p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform public.require_admin();

  if p_minutes is null or p_minutes not between 15 and 240 then
    raise exception '수업 시간은 15~240분으로 입력해 주세요.' using errcode = 'MB004';
  end if;

  update public.class_slots
     set end_time = start_time + make_interval(mins => p_minutes)
   where is_active
     and end_time is null
     and class_type <> 'OPEN_GYM'
     -- 자정을 넘기면 계산 결과가 시작보다 이른 시각이 되므로 제외
     and start_time + make_interval(mins => p_minutes) > start_time;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.admin_fill_missing_end_times(integer) from public, anon;
grant execute on function public.admin_fill_missing_end_times(integer) to authenticated;
