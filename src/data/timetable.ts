// 수업 시간표 데이터. 시간표가 바뀌면 이 파일만 고치면 됩니다.
// 화면에서는 같은 수업이 이어지는 요일 칸을 자동으로 합쳐서 보여줍니다. (월~금 모두 CROSSFIT이면 한 칸으로)

// as const = 값을 바꿀 수 없는 상수로 고정합니다. 덕분에 아래 DayKey 타입을 이 목록에서 자동으로 뽑아낼 수 있습니다.
export const days = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
  { key: "SAT", label: "토" },
] as const;

// "MON" | "TUE" | ... | "SAT" 중 하나만 허용하는 타입 (Java의 enum과 비슷)
export type DayKey = (typeof days)[number]["key"];

export type ClassType = "CROSSFIT" | "HYROX" | "OPEN_GYM" | "BREAK" | "CLOSE";

// 화면에 보여줄 이름
export const classLabels: Record<ClassType, string> = {
  CROSSFIT: "CROSSFIT",
  HYROX: "HYROX",
  OPEN_GYM: "OPEN GYM",
  BREAK: "BREAK TIME",
  CLOSE: "CLOSE",
};

// 수업 예약 화면에서 쓰는 한글 이름
export const classLabelsKo: Record<"CROSSFIT" | "HYROX" | "OPEN_GYM" | "COACH_TRAINING", string> = {
  CROSSFIT: "크로스핏",
  HYROX: "하이록스",
  OPEN_GYM: "오픈짐",
  COACH_TRAINING: "코치트레이닝",
};

export type TimeSlot = {
  time: string;
  // Record<DayKey, ClassType> = 요일마다 수업 하나씩. 요일이 하나라도 빠지면 컴파일 에러가 납니다. (Java의 Map<DayKey, ClassType>)
  classes: Record<DayKey, ClassType>;
};

// 월~금이 같은 수업일 때 반복을 줄이기 위한 도우미 함수
function weekdays(type: ClassType, saturday: ClassType): Record<DayKey, ClassType> {
  return { MON: type, TUE: type, WED: type, THU: type, FRI: type, SAT: saturday };
}

export const timetable: TimeSlot[] = [
  { time: "06:45", classes: weekdays("CROSSFIT", "CLOSE") },
  { time: "08:00~", classes: weekdays("OPEN_GYM", "CLOSE") },
  { time: "10:30", classes: weekdays("CROSSFIT", "CROSSFIT") },
  { time: "12:00", classes: weekdays("HYROX", "HYROX") },
  { time: "13:30~", classes: weekdays("BREAK", "CLOSE") },
  {
    time: "15:30~",
    classes: {
      MON: "OPEN_GYM",
      TUE: "OPEN_GYM",
      WED: "CLOSE",
      THU: "OPEN_GYM",
      FRI: "OPEN_GYM",
      SAT: "CLOSE",
    },
  },
  { time: "17:50", classes: weekdays("CROSSFIT", "CLOSE") },
  {
    time: "19:00",
    classes: {
      MON: "CROSSFIT",
      TUE: "HYROX",
      WED: "CROSSFIT",
      THU: "HYROX",
      FRI: "CROSSFIT",
      SAT: "CLOSE",
    },
  },
  {
    time: "20:10",
    classes: {
      MON: "HYROX",
      TUE: "CROSSFIT",
      WED: "HYROX",
      THU: "CROSSFIT",
      FRI: "HYROX",
      SAT: "CLOSE",
    },
  },
  { time: "21:20", classes: weekdays("CROSSFIT", "CLOSE") },
];

export const openingHours = {
  open: "06:30",
  close: "23:00",
  breakTime: "13:30 - 15:30",
};

export const timetableNotes = [
  "일요일은 휴무입니다.",
  "토요일은 10:30 크로스핏, 12:00 하이록스 수업만 진행하며 13:30에 마감합니다.",
  "매주 수요일, 토요일은 오픈짐을 쉬어갑니다.",
  "브레이크 타임은 청소 및 장비 정비 시간입니다.",
];
