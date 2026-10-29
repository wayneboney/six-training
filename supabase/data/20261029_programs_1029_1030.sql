-- =========================================================
-- Program 데이터: 2026-10-29(목), 2026-10-30(금) (크로스핏, 하이록스 각 1건, 총 4건)
--   기존 앱의 Program 화면(이미지) 내용을 옮긴 것입니다. 동작 한 줄이 배열의 한 칸입니다.
--   같은 날짜 + 같은 종류가 이미 있으면 새 내용으로 덮어씁니다. (여러 번 실행해도 안전)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
insert into public.wods (wod_date, wod_type, title, format, movements, note) values
  ('2026-10-29', 'HYROX', 'Partner Wod', 'Every 6min x 4 / Rest 2min',
    array[
      '1) 1000/800m Row + Max Burpee over Row',
      '2) 6min Run (Race Pace)',
      '3) Emom 6 Sled Drag (i go you go every 1min)',
      '4) 120 Goblet Squat (24/16kg)'
    ],
    null),

  ('2026-10-29', 'CROSSFIT', 'Emom 25', 'Every Minute On the Minute, 25min',
    array[
      '1) 12/9cal Row',
      '2) 10 DB Lunge (50/35)',
      '3) 3-5 Muscle ups or 10 chest to bar Pull ups',
      '4) 8-10 Burpee box jump&step down',
      '5) Rest'
    ],
    null),

  ('2026-10-30', 'CROSSFIT', 'Core + Active Recovery (Zone 2)', 'Core 3set + Active Recovery 3set',
    array[
      '1. Core (3set)',
      '20 Hanging Leg raise',
      '40 weighted Russian Twist',
      '2min rest',
      '2. Active Recovery (Zone 2) (3set)',
      '3min Bike',
      '1min Plank Hold',
      '3min Row',
      '1min Bar hang hold',
      '3min Run',
      '1min Wallsit'
    ],
    null),

  ('2026-10-30', 'HYROX', 'Sled Pull + 5 Rounds', 'Sled Pull 3set + Wod 5R',
    array[
      '1. Sled Pull (3set)',
      '30m Sled Pull',
      '200m Run or 400m Bike',
      '2. Wod (5R)',
      '250/225m Ski or Row',
      '8 Strict Pull ups',
      '20 KB Gorilla Row'
    ],
    null)
on conflict (wod_date, wod_type) do update
  set title = excluded.title,
      format = excluded.format,
      movements = excluded.movements,
      note = excluded.note;
