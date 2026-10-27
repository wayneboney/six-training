-- =========================================================
-- 8-7) 코치트레이닝 수업 추가 (토요일 09:00)
--   수업 종류에 COACH_TRAINING을 추가하고, 토요일 09:00 시간표 칸을 만듭니다.
--   다른 수업과 똑같이 회원이 예약하고(정원, 대기, 취소 동일), 기본 정원은 20명입니다.
--   정원은 예약 화면에서 날짜별로 20/30으로 바꿀 수 있습니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (8-6 다음에)
-- =========================================================

-- 수업 종류 허용 목록에 COACH_TRAINING 추가
alter table public.class_slots drop constraint if exists class_slots_class_type_check;
alter table public.class_slots
  add constraint class_slots_class_type_check
  check (class_type in ('CROSSFIT', 'HYROX', 'OPEN_GYM', 'COACH_TRAINING'));

-- 토요일(6) 09:00 코치트레이닝. 이미 있으면 건너뜀 (다시 실행해도 안전)
insert into public.class_slots (weekday, start_time, class_type, capacity)
values (6, '09:00', 'COACH_TRAINING', 20)
on conflict (weekday, start_time) do nothing;
