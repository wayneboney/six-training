// 수업 시간표(class_slots)를 DB에서 읽어 오는 곳.
//   getPublicTimetable : 박스 소개 페이지의 시간표 표 (로그인 없이 읽음. DB 규칙이 사용 중인 수업만 보여줌)
//   listAdminSlots     : 관리자 시간표 관리 화면 (수업 목록 + 오늘 이후 예약 건수)
import "server-only";
import { days, openingHours, type ClassType, type DayKey, type TimeSlot } from "@/data/timetable";
import { createAuthSupabase } from "@/lib/supabase/auth";
import { createServerSupabase } from "@/lib/supabase/server";

// DB의 요일 번호(1=월 ... 6=토) → 화면의 요일 키
const dayKeyByWeekday: Record<number, DayKey> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" };

// "06:45:00" → "06:45"
function hhmm(time: string): string {
  return time.slice(0, 5);
}

type SlotRow = { weekday: number; start_time: string; class_type: string };

// 박스 소개의 시간표: 시작 시각마다 한 줄, 요일마다 한 칸.
//   수업이 없는 칸은 CLOSE로 보여줍니다. 브레이크 타임 줄은 운영 시간 설정(openingHours)에서 넣습니다.
//   오픈짐만 있는 줄은 "08:00~"처럼 시각 뒤에 ~를 붙입니다. (그 시각부터 자유롭게 이용)
export async function getPublicTimetable(): Promise<TimeSlot[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("class_slots")
    .select("weekday, start_time, class_type")
    .order("start_time", { ascending: true })
    .overrideTypes<SlotRow[], { merge: false }>();
  if (error) {
    throw error;
  }

  const rows = new Map<string, Partial<Record<DayKey, ClassType>>>();
  for (const slot of data) {
    const dayKey = dayKeyByWeekday[slot.weekday];
    const type = slot.class_type;
    if (!dayKey || (type !== "CROSSFIT" && type !== "HYROX" && type !== "OPEN_GYM")) {
      console.warn("[schedule] 시간표에 보여주지 않는 수업 종류/요일 제외", slot);
      continue;
    }
    const time = hhmm(slot.start_time);
    rows.set(time, { ...rows.get(time), [dayKey]: type });
  }

  // 브레이크 타임 줄 (예: 13:30). 수업이 없는 시간대라서 운영 시간 설정에서 가져옵니다.
  const breakStart = openingHours.breakTime.split(" ")[0];
  if (!rows.has(breakStart)) {
    rows.set(breakStart, { MON: "BREAK", TUE: "BREAK", WED: "BREAK", THU: "BREAK", FRI: "BREAK" });
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, cells]) => {
      const classes = Object.fromEntries(days.map((d) => [d.key, cells[d.key] ?? "CLOSE"])) as Record<DayKey, ClassType>;
      const used = Object.values(cells);
      const openGymOnly = used.length > 0 && used.every((type) => type === "OPEN_GYM");
      const breakOnly = used.length > 0 && used.every((type) => type === "BREAK");
      return { time: openGymOnly || breakOnly ? `${time}~` : time, classes };
    });
}

export type AdminSlot = {
  id: number;
  weekday: number; // 1=월 ... 6=토
  startTime: string; // "HH:MM"
  classType: string;
  capacity: number;
  booked: number; // 오늘 이후 예약/대기 건수
};

export async function listAdminSlots(): Promise<AdminSlot[]> {
  const supabase = await createAuthSupabase();

  const { data: slots, error } = await supabase
    .from("class_slots")
    .select("id, weekday, start_time, class_type, capacity")
    .eq("is_active", true)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true })
    .overrideTypes<{ id: number; weekday: number; start_time: string; class_type: string; capacity: number }[], { merge: false }>();
  if (error) {
    throw error;
  }

  const { data: counts, error: countError } = await supabase.rpc("admin_class_slot_booking_counts");
  if (countError) {
    throw countError;
  }
  const bookedBySlot = new Map(((counts ?? []) as { slot_id: number; booked: number }[]).map((c) => [c.slot_id, c.booked]));

  return slots.map((s) => ({
    id: s.id,
    weekday: s.weekday,
    startTime: hhmm(s.start_time),
    classType: s.class_type,
    capacity: s.capacity,
    booked: bookedBySlot.get(s.id) ?? 0,
  }));
}
