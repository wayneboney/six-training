// 수업 예약 데이터 조회. 로그인한 사용자 권한으로 조회하므로 DB의 접근 규칙(본인 예약만, 관리자는 전체)이 그대로 적용됩니다.
import "server-only";
import { createAuthSupabase } from "@/lib/supabase/auth";

// 시간표 한 칸(날짜별): 정원, 예약/대기 인원, 내 예약 상태
export type ClassSession = {
  slotId: number;
  classDate: string; // YYYY-MM-DD
  startTime: string; // "HH:MM"
  endTime: string | null; // "HH:MM" (종료 시각을 아직 정하지 않은 수업은 null)
  classType: "CROSSFIT" | "HYROX" | "OPEN_GYM" | "COACH_TRAINING";
  capacity: number;
  confirmedCount: number;
  waitingCount: number;
  myReservationId: number | null;
  myStatus: "confirmed" | "waiting" | null;
};

export type MyReservation = {
  id: number;
  slotId: number;
  classDate: string;
  startTime: string;
  classType: string;
  status: "confirmed" | "waiting";
};

// 수업의 예약자/대기자 한 명. 이름과 프로필 사진만 담고, 이메일 등 다른 정보는 받지 않습니다.
export type Attendee = {
  slotId: number;
  classDate: string;
  status: "confirmed" | "waiting";
  queueNo: number; // 예약 순서 또는 대기 순서 (1부터)
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  reservationId: number | null; // 관리자에게만 값이 있음 (대신 취소 버튼용)
  guestLabel: string | null; // 회원이 아닌 예약자(드랍인/체험)의 구분. 회원이면 null
};

type ScheduleRow = {
  slot_id: number;
  class_date: string;
  start_time: string;
  end_time: string | null;
  class_type: ClassSession["classType"];
  capacity: number;
  confirmed_count: number;
  waiting_count: number;
  my_reservation_id: number | null;
  my_status: "confirmed" | "waiting" | null;
};

// "03:33:00" → "03:33"
const hhmm = (time: string) => time.slice(0, 5);

export async function getSchedule(from: string, to: string): Promise<ClassSession[]> {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("get_class_schedule", { p_from: from, p_to: to });
  if (error) {
    throw error;
  }
  // 이 DB 함수는 표(여러 줄)를 돌려주는데, 타입 정보가 없어서 직접 타입을 지정합니다.
  const rows = (data ?? []) as ScheduleRow[];
  return rows.map((row) => ({
    slotId: row.slot_id,
    classDate: row.class_date,
    startTime: hhmm(row.start_time),
    endTime: row.end_time ? hhmm(row.end_time) : null,
    classType: row.class_type,
    capacity: row.capacity,
    confirmedCount: row.confirmed_count,
    waitingCount: row.waiting_count,
    myReservationId: row.my_reservation_id,
    myStatus: row.my_status,
  }));
}

// 내 예약/대기 (from 날짜부터. 이번 주 월요일부터 넘기면 이번 주 지난 수업도 포함)
export async function getMyReservations(from: string): Promise<MyReservation[]> {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, slot_id, class_date, status, class_slots(start_time, class_type)")
    .neq("status", "cancelled")
    .gte("class_date", from)
    .order("class_date", { ascending: true })
    .overrideTypes<
      {
        id: number;
        slot_id: number;
        class_date: string;
        status: "confirmed" | "waiting";
        class_slots: { start_time: string; class_type: string } | null;
      }[],
      { merge: false }
    >();
  if (error) {
    throw error;
  }
  return data
    .filter((row) => row.class_slots !== null)
    .map((row) => ({
      id: row.id,
      slotId: row.slot_id,
      classDate: row.class_date,
      startTime: hhmm(row.class_slots!.start_time),
      classType: row.class_slots!.class_type,
      status: row.status,
    }))
    .sort((a, b) => (a.classDate + a.startTime).localeCompare(b.classDate + b.startTime));
}

// 기간 내 예약자(예약 + 대기). 회원/관리자 모두 볼 수 있습니다. (DB 함수가 이름, 사진, 순번만 돌려줌)
export async function getAttendees(from: string, to: string): Promise<Attendee[]> {
  const supabase = await createAuthSupabase();
  const { data, error } = await supabase.rpc("get_class_attendees", { p_from: from, p_to: to });
  if (error) {
    throw error;
  }
  // 이 DB 함수는 표(여러 줄)를 돌려주는데, 타입 정보가 없어서 직접 타입을 지정합니다.
  const rows = (data ?? []) as {
    slot_id: number;
    class_date: string;
    status: "confirmed" | "waiting";
    queue_no: number;
    name: string;
    avatar_url: string | null;
    is_me: boolean;
    reservation_id: number | null;
    guest_label: string | null;
  }[];
  return rows.map((row) => ({
    slotId: row.slot_id,
    classDate: row.class_date,
    status: row.status,
    queueNo: row.queue_no,
    name: row.name,
    avatarUrl: row.avatar_url,
    isMe: row.is_me,
    reservationId: row.reservation_id,
    guestLabel: row.guest_label,
  }));
}
