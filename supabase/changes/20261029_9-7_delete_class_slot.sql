-- =========================================================
-- 9-7) 수업 삭제 시 예약 기록까지 함께 삭제
--
--   예전(9-4): 수업을 삭제해도 수업 칸은 "사용 안 함"으로 남기고, 시작하지 않은 오늘 이후의 예약만 취소했습니다. (지난 예약 기록은 남음)
--   이제: 수업을 삭제하면 그 수업의 예약 기록을 날짜와 상관없이 전부 삭제하고, 수업 칸도 완전히 지웁니다.
--     - 지우는 것: 이 수업의 모든 예약/대기/취소 기록 (지난 수업 포함, 회원 예약과 드랍인/체험 게스트 모두), 날짜별 정원 예외
--     - 지난 수업에서 누가 예약했는지 확인하는 기록도 함께 사라집니다. 되돌릴 수 없습니다.
--     - 돌려주는 값: 삭제한 예약 기록 수
--   같은 요일/시각으로 수업을 다시 추가하면 새 수업으로 만들어집니다.
--   (이전 방식으로 "사용 안 함" 처리되어 남아 있는 수업은 그대로 두고, 같은 요일/시각으로 추가하면 다시 사용합니다.)
--
--   ⚠️ 순서: 이 SQL을 먼저 실행하고, 이어서 코드를 배포(push)하세요.
--   다시 실행해도 안전합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- =========================================================

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

  delete from public.reservations where slot_id = p_slot_id;
  get diagnostics removed = row_count;

  -- 날짜별 정원 예외(class_capacity_overrides)는 수업과 함께 자동으로 지워집니다. (on delete cascade)
  delete from public.class_slots where id = p_slot_id;

  return removed;
end;
$$;

revoke execute on function public.admin_delete_class_slot(bigint) from public, anon;
grant execute on function public.admin_delete_class_slot(bigint) to authenticated;

-- 예전 "사용 안 함 처리" 함수는 더 쓰지 않으므로 지웁니다.
drop function if exists public.admin_deactivate_class_slot(bigint);
