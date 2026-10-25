-- =========================================================
-- WOD 테이블
-- 화면의 Wod 타입(src/data/wods.ts)과 같은 모양으로 만듭니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================
create table public.wods (
  -- PK. Oracle의 시퀀스 + 트리거를 한 줄로 처리하는 PostgreSQL 방식
  id          bigint generated always as identity primary key,

  wod_date    date not null,

  -- 허용하는 종류. src/data/wods.ts의 wodTypes 목록과 반드시 같아야 합니다.
  wod_type    text not null check (wod_type in ('CROSSFIT', 'HYROX', 'COACH_TRAINING')),

  title       text not null check (char_length(title) between 1 and 100),
  format      text not null check (char_length(format) between 1 and 100),

  -- 동작 목록: 문자열 배열. 최소 1개 이상 있어야 함
  movements   text[] not null check (cardinality(movements) > 0),

  -- 코치 메모 (없어도 됨)
  note        text check (note is null or char_length(note) <= 500),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 같은 날짜에 같은 종류 WOD가 두 번 들어가지 않게 (Oracle의 UNIQUE 인덱스)
create unique index wods_date_type_uk on public.wods (wod_date, wod_type);

-- 테이블, 컬럼 설명 (Oracle의 COMMENT ON과 같음)
comment on table  public.wods            is '오늘의 운동(WOD)';
comment on column public.wods.wod_date   is 'WOD 날짜';
comment on column public.wods.wod_type   is '수업 종류: CROSSFIT, HYROX, COACH_TRAINING';
comment on column public.wods.title      is 'WOD 이름';
comment on column public.wods.format     is '진행 방식 (예: For Time, AMRAP 20min)';
comment on column public.wods.movements  is '동작 목록 (순서대로)';
comment on column public.wods.note       is '코치 메모';

-- 보안: 행 단위 접근 제어(RLS) 켜기
-- 켜는 순간 "허용 규칙이 없으면 아무도 못 읽고 못 씀" 상태가 됩니다.
-- 읽기/쓰기 허용 규칙은 다음 마이그레이션(5-3)에서 추가합니다.
alter table public.wods enable row level security;
