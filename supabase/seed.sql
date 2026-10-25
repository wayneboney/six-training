-- =========================================================
-- 샘플 WOD 데이터 (화면 확인용)
-- src/data/wods.ts의 예시 WOD와 같은 내용입니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
--
-- on conflict ... do nothing = 같은 날짜, 같은 종류가 이미 있으면 건너뜀
-- (여러 번 실행해도 중복으로 들어가지 않습니다. Oracle의 MERGE ... WHEN NOT MATCHED와 비슷)
--
-- ⚠️ 실제 사이트를 공개하기 전에는 아래 delete 문으로 샘플 데이터를 지워 주세요.
--    delete from public.wods where wod_date between '2026-10-19' and '2026-10-27';
-- =========================================================
insert into public.wods (wod_date, wod_type, title, format, movements, note) values
  ('2026-10-19', 'CROSSFIT', 'Fran', 'For Time (21-15-9)',
    array['Thruster (43/30kg)', 'Pull-up'],
    '목표 기록 8분 이내. 스케일: 밴드 풀업 또는 링로우'),

  ('2026-10-20', 'HYROX', 'Run & Sled', '4 Rounds For Time',
    array['Run 1km', 'Sled Push 50m', 'Sled Pull 50m', 'Wall Ball 20회'],
    null),

  ('2026-10-21', 'CROSSFIT', 'Cindy', 'AMRAP 20min',
    array['Pull-up 5회', 'Push-up 10회', 'Air Squat 15회'],
    null),

  ('2026-10-22', 'HYROX', 'Erg Ladder', 'For Time',
    array['SkiErg 1000m', 'Row 1000m', 'Sandbag Lunge 80m', 'Burpee Broad Jump 40m'],
    '페이스 조절이 핵심입니다. 첫 에르그에서 무리하지 마세요.'),

  ('2026-10-23', 'CROSSFIT', 'EMOM Engine', 'EMOM 16min',
    array['홀수 분: Row 12/10cal', '짝수 분: Burpee 10회'],
    null),

  ('2026-10-24', 'CROSSFIT', 'Saturday Partner WOD', '2인 1팀, 30min Cap',
    array['Run 400m (함께)', 'Kettlebell Swing 100회', 'Box Jump 80회', 'Run 400m (함께)'],
    null),

  ('2026-10-24', 'HYROX', 'Saturday Simulation', 'For Time',
    array['Run 500m', 'Farmers Carry 100m', 'Run 500m', 'Wall Ball 50회'],
    null),

  ('2026-10-26', 'CROSSFIT', 'Deadlift Day', 'Strength + Metcon',
    array['Deadlift 5-5-3-3-1 (무게 올리기)', '이후 AMRAP 8min: Deadlift 5회, Box Jump Over 10회'],
    null),

  ('2026-10-27', 'HYROX', 'Station Practice', '3 Rounds',
    array['SkiErg 500m', 'Sled Push 25m x 2', 'Row 500m', 'Farmers Carry 50m'],
    null),

  ('2026-10-27', 'COACH_TRAINING', 'Olympic Lifting Technique', 'Skill Session',
    array['Snatch Balance 5 x 3', 'Hang Power Snatch 5 x 2', 'Overhead Squat 4 x 5'],
    '코치 트레이닝 예시입니다.')
on conflict (wod_date, wod_type) do nothing;
