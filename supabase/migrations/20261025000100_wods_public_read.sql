-- =========================================================
-- WOD 읽기 허용 규칙 (RLS 정책)
-- 사이트 방문자 누구나 WOD를 "읽기"만 할 수 있게 엽니다.
-- 쓰기(등록/수정/삭제) 규칙은 만들지 않았으므로 여전히 아무도 못 씁니다.
-- (코치 로그인 기능을 만들 때 쓰기 규칙을 따로 추가합니다)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

-- anon = 로그인하지 않은 방문자, authenticated = 로그인한 사용자
-- 테이블 단위 권한: SELECT만 줍니다. (Oracle의 GRANT SELECT ON ... TO ...)
grant select on public.wods to anon, authenticated;

-- 행 단위 규칙: using (true) = 모든 행을 읽을 수 있음
create policy "누구나 WOD 읽기 가능"
  on public.wods
  for select
  to anon, authenticated
  using (true);
