-- =========================================================
-- Program 데이터: 2026-11-02(월) ~ 11-06(금) (크로스핏, 하이록스 각 1건, 총 10건)
--   기존 앱의 Program 화면(스크린샷) 내용을 옮긴 것입니다. 동작 한 줄이 배열의 한 칸입니다.
--   같은 날짜 + 같은 종류가 이미 있으면 새 내용으로 덮어씁니다. (여러 번 실행해도 안전)
--   ⚠️ 스크린샷이 아래쪽에서 잘려 있던 날(11/03, 11/04 크로스핏, 11/05 크로스핏, 11/06)은 보이는 데까지만 넣었습니다.
--      뒷부분이 더 있다면 관리자 화면(Program 수정)에서 이어서 입력해 주세요.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
insert into public.wods (wod_date, wod_type, title, format, movements, note) values
  -- 11/02 (월)
  ('2026-11-02', 'CROSSFIT', 'Front Squat + Conditioning', '5set 3 + Every 4min x 4',
    array[
      '1. Front Squat',
      '5set 3',
      '(70% 1rm)',
      '',
      '2. Conditioning',
      'Every 4min x 4',
      '20/16cal Row',
      '15 Front Squat (95/65lb)',
      '10 Box Jump'
    ],
    null),

  ('2026-11-02', 'HYROX', 'Max Run + Sled Push + SB Lunge', 'Every 5min x 5',
    array[
      '1min Max Run',
      '1min Max Sled Push (200/150/100)',
      '1min Max SB Lunge (30/20/10kg)'
    ],
    null),

  -- 11/03 (화)
  ('2026-11-03', 'CROSSFIT', 'Bench Press + Push ups / 9min AMRAP', '4set + 9min amrap',
    array[
      '1. Bench Press+Push ups',
      '4set',
      '10 DB Bench Press (50/35)',
      '15 Push ups',
      '',
      '2. Conditioning',
      '9min amrap',
      '3 handstand walk around box',
      '9 toes to bar'
    ],
    null),

  ('2026-11-03', 'HYROX', 'Hyrox Strength Day', '3set + 3set + Machine Splint 8set',
    array[
      '1. 3set',
      '10 DB Row (50/35)',
      '60m Farmer''s Carry (32/24/16kg)',
      '',
      '2. 3set',
      '8/8 DB Bulgarian split Squat (50/35)',
      '8/8 DB One leg deadlift (50/35)',
      '',
      '3. Machine Splint',
      '8set',
      '20sec on/40sec rest',
      'Bike',
      'AB',
      'Row'
    ],
    null),

  -- 11/04 (수)
  ('2026-11-04', 'CROSSFIT', 'Deadlift + Squat Clean + Push Press', '10-9-8-7-6-5-4-3-2-1',
    array[
      '1. wod',
      '10-9-8-7-6-5-4-3-2-1',
      'Deadlift',
      'Squat clean',
      'Push Press',
      'Rx''d: 135/85lb'
    ],
    null),

  ('2026-11-04', 'HYROX', 'Emom 30', 'Emom 30',
    array[
      '1) 12/9cal Row or Ski',
      '2) 15m Sled Push',
      '3) 15m burpee broad jump',
      '4) 150m run',
      '5) 15 Wallball shot',
      '6) Rest'
    ],
    null),

  -- 11/05 (목)
  ('2026-11-05', 'CROSSFIT', 'Muscle Ups Practice + Team of 2 AMRAP', 'Team of 2 / 20min amrap',
    array[
      '1. Muscle Ups Practice',
      '',
      '2. Conditioning',
      'Team of 2',
      '20min amrap',
      '',
      'P1-',
      '20 Wallball shot (20/14)',
      '5 Burpee Bar Muscle ups or 10 Burpee pull ups',
      '',
      'P2- Max Row'
    ],
    null),

  ('2026-11-05', 'HYROX', 'Run + Sled Pull + Row + Goblet Squat', 'For time',
    array[
      '1000m Run',
      '30m sled pull (heavy)',
      '1000/900m Row',
      '100 Goblet Squat (35/20lb)',
      '500m Run'
    ],
    null),

  -- 11/06 (금)
  ('2026-11-06', 'CROSSFIT', 'Snatch + Conditioning', '4set + For time',
    array[
      '1. Snatch',
      'For quality',
      '4set',
      '1 Snatch Pull',
      '1 Power Snatch',
      '(70-75% 1rm)',
      '',
      '2. Conditioning',
      'For time:',
      '15 Power Snatch',
      '15 DB thruster',
      '12 Power Snatch',
      '12 DB Thruster',
      '9 Power Snatch',
      '9 DB thruster',
      '6 Power Snatch',
      '6 DB thruster',
      '',
      'Barbell: 135/95lb',
      'DB: 35/20lb'
    ],
    null),

  ('2026-11-06', 'HYROX', 'Team of 2 AMRAP', 'Team of 2 / 25min amrap',
    array[
      '1000/900m Row',
      '60 DB Push press (35/20lb)',
      '500m Run',
      '60 devil press (35/20lb)'
    ],
    null)
on conflict (wod_date, wod_type) do update
  set title = excluded.title,
      format = excluded.format,
      movements = excluded.movements,
      note = excluded.note;
