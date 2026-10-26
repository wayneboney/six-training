-- =========================================================
-- 회원권 종료 자동 전환 스케줄
-- 매일 새벽 0시 5분(한국 시간)에 expire_memberships()를 실행해서,
-- 유효하거나 예정된 회원권이 없는 '활동' 일반회원을 '비활동'으로 바꿉니다.
--
-- pg_cron = DB 안에서 정해진 시간에 SQL을 실행해 주는 Supabase 기능 (Spring의 @Scheduled와 비슷)
-- 스케줄 시간은 UTC 기준이라 한국 0시 5분 = 전날 15시 5분(UTC) 입니다. → '5 15 * * *'
--
-- 이 SQL은 실패해도 다른 것에 영향이 없도록 오류를 안내 메시지로 바꿔서 알려 줍니다.
-- 결과 창에 "자동 전환 예약 실패" 안내가 나오면:
--   Supabase 대시보드 → Database → Extensions에서 pg_cron을 켠 다음, 이 SQL을 다시 실행해 주세요.
--
-- 참고: 예약 가능 여부는 이 스케줄과 상관없이 "오늘 유효한 회원권이 있는지"로 직접 확인합니다. (챕터 8)
--       그래서 스케줄이 하루 늦어져도 만료된 회원이 예약하는 일은 없습니다.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run (회원권 다음에)
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '자동 전환 예약 실패: 이 데이터베이스에서 pg_cron을 사용할 수 없습니다. Database → Extensions에서 확인해 주세요.';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  -- 다시 실행해도 중복으로 등록되지 않도록, 같은 이름의 예약이 있으면 지우고 새로 등록
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-memberships';
  perform cron.schedule('expire-memberships', '5 15 * * *', 'select public.expire_memberships()');

  raise notice '자동 전환 예약 완료: 매일 00:05(한국 시간) expire_memberships() 실행';
exception when others then
  raise notice '자동 전환 예약 실패: %. Database → Extensions에서 pg_cron을 켠 뒤 다시 실행해 주세요.', sqlerrm;
end;
$$;
