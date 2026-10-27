-- =========================================================
-- 개발용: 시간표(class_slots)를 지우고 기본 시간표로 다시 만듭니다.
--   ⚠️ 모든 예약(reservations)도 함께 삭제됩니다. 테스트 중에만 쓰세요. 실제 예약이 생긴 뒤에는 실행하지 마세요.
--   기본 정원: 모든 수업 20명. 코치트레이닝(토 09:00) 포함이라 8-7 SQL을 먼저 실행해야 합니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (한 번에 실행되므로 중간에 오류가 나면 전부 취소됨)
-- =========================================================
delete from public.reservations;
delete from public.class_slots;

insert into public.class_slots (weekday, start_time, class_type, capacity)
select w, t::time, c, 20   -- 기본 정원 20명
from (values
  -- 06:45 크로스핏 (월~금)
  (1,'06:45','CROSSFIT'),(2,'06:45','CROSSFIT'),(3,'06:45','CROSSFIT'),(4,'06:45','CROSSFIT'),(5,'06:45','CROSSFIT'),
  -- 08:00 오픈짐 (월~금)
  (1,'08:00','OPEN_GYM'),(2,'08:00','OPEN_GYM'),(3,'08:00','OPEN_GYM'),(4,'08:00','OPEN_GYM'),(5,'08:00','OPEN_GYM'),
  -- 09:00 코치트레이닝 (토요일만) — 8-7 SQL을 실행한 뒤에만 넣을 수 있습니다
  (6,'09:00','COACH_TRAINING'),
  -- 10:30 크로스핏 (월~토)
  (1,'10:30','CROSSFIT'),(2,'10:30','CROSSFIT'),(3,'10:30','CROSSFIT'),(4,'10:30','CROSSFIT'),(5,'10:30','CROSSFIT'),(6,'10:30','CROSSFIT'),
  -- 12:00 하이록스 (월~토)
  (1,'12:00','HYROX'),(2,'12:00','HYROX'),(3,'12:00','HYROX'),(4,'12:00','HYROX'),(5,'12:00','HYROX'),(6,'12:00','HYROX'),
  -- 15:30 오픈짐 (월, 화, 목, 금)
  (1,'15:30','OPEN_GYM'),(2,'15:30','OPEN_GYM'),(4,'15:30','OPEN_GYM'),(5,'15:30','OPEN_GYM'),
  -- 17:50 크로스핏 (월~금)
  (1,'17:50','CROSSFIT'),(2,'17:50','CROSSFIT'),(3,'17:50','CROSSFIT'),(4,'17:50','CROSSFIT'),(5,'17:50','CROSSFIT'),
  -- 19:00 (월 크로스핏, 화 하이록스, 수 크로스핏, 목 하이록스, 금 크로스핏)
  (1,'19:00','CROSSFIT'),(2,'19:00','HYROX'),(3,'19:00','CROSSFIT'),(4,'19:00','HYROX'),(5,'19:00','CROSSFIT'),
  -- 20:10 (월 하이록스, 화 크로스핏, 수 하이록스, 목 크로스핏, 금 하이록스)
  (1,'20:10','HYROX'),(2,'20:10','CROSSFIT'),(3,'20:10','HYROX'),(4,'20:10','CROSSFIT'),(5,'20:10','HYROX'),
  -- 21:20 크로스핏 (월~금)
  (1,'21:20','CROSSFIT'),(2,'21:20','CROSSFIT'),(3,'21:20','CROSSFIT'),(4,'21:20','CROSSFIT'),(5,'21:20','CROSSFIT')
) as v(w, t, c);

-- 확인: 모두 정원 20명, 총 47칸 (코치트레이닝 포함)
select weekday, class_type, capacity, count(*) as 칸수
from public.class_slots group by 1, 2, 3 order by 1, 2;
