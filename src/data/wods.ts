// WOD(Workout Of the Day) 데이터.
// 지금은 이 파일에 직접 적지만, 나중에 DB로 옮기면 이 파일 대신 DB에서 같은 모양(Wod 타입)으로 읽어 오면 됩니다.
// 화면(WodCalendar)은 데이터를 어디서 가져오는지 모르게 만들어 두어서, 그때 화면 코드는 고칠 필요가 없습니다.
// TODO: 아래 WOD는 화면 확인용 예시입니다. 실제 WOD로 바꿔 주세요.

// WOD 종류 목록. 종류를 추가하려면 여기와 아래 wodTypeLabels,
// 그리고 화면 색상(src/components/wod/wodTypeStyles.ts)에 한 줄씩 추가합니다.
// DB 테이블의 check 제약(wod_type in (...))에도 같은 값을 넣어야 합니다.
export const wodTypes = ["CROSSFIT", "HYROX", "COACH_TRAINING"] as const;

// "CROSSFIT" | "HYROX" | "COACH_TRAINING" (위 목록에서 자동으로 만들어지는 타입)
export type WodType = (typeof wodTypes)[number];

export type Wod = {
  date: string; // "YYYY-MM-DD" 형식 (예: "2026-10-26")
  type: WodType;
  title: string; // WOD 이름 (예: "Fran")
  format: string; // 진행 방식 (예: "For Time", "AMRAP 20min")
  movements: string[]; // 동작 목록, 한 줄에 하나
  note?: string; // 코치 메모 (생략 가능)
};

// Record<WodType, string> = 종류마다 이름이 하나씩 반드시 있어야 합니다. 빠뜨리면 컴파일 에러
export const wodTypeLabels: Record<WodType, string> = {
  CROSSFIT: "CROSSFIT",
  HYROX: "HYROX",
  COACH_TRAINING: "COACH TRAINING",
};

export const wods: Wod[] = [
  {
    date: "2026-10-19",
    type: "CROSSFIT",
    title: "Fran",
    format: "For Time (21-15-9)",
    movements: ["Thruster (43/30kg)", "Pull-up"],
    note: "목표 기록 8분 이내. 스케일: 밴드 풀업 또는 링로우",
  },
  {
    date: "2026-10-20",
    type: "HYROX",
    title: "Run & Sled",
    format: "4 Rounds For Time",
    movements: ["Run 1km", "Sled Push 50m", "Sled Pull 50m", "Wall Ball 20회"],
  },
  {
    date: "2026-10-21",
    type: "CROSSFIT",
    title: "Cindy",
    format: "AMRAP 20min",
    movements: ["Pull-up 5회", "Push-up 10회", "Air Squat 15회"],
  },
  {
    date: "2026-10-22",
    type: "HYROX",
    title: "Erg Ladder",
    format: "For Time",
    movements: ["SkiErg 1000m", "Row 1000m", "Sandbag Lunge 80m", "Burpee Broad Jump 40m"],
    note: "페이스 조절이 핵심입니다. 첫 에르그에서 무리하지 마세요.",
  },
  {
    date: "2026-10-23",
    type: "CROSSFIT",
    title: "EMOM Engine",
    format: "EMOM 16min",
    movements: ["홀수 분: Row 12/10cal", "짝수 분: Burpee 10회"],
  },
  {
    date: "2026-10-24",
    type: "CROSSFIT",
    title: "Saturday Partner WOD",
    format: "2인 1팀, 30min Cap",
    movements: ["Run 400m (함께)", "Kettlebell Swing 100회", "Box Jump 80회", "Run 400m (함께)"],
  },
  {
    date: "2026-10-24",
    type: "HYROX",
    title: "Saturday Simulation",
    format: "For Time",
    movements: ["Run 500m", "Farmers Carry 100m", "Run 500m", "Wall Ball 50회"],
  },
  {
    date: "2026-10-26",
    type: "CROSSFIT",
    title: "Deadlift Day",
    format: "Strength + Metcon",
    movements: ["Deadlift 5-5-3-3-1 (무게 올리기)", "이후 AMRAP 8min: Deadlift 5회, Box Jump Over 10회"],
  },
  {
    date: "2026-10-27",
    type: "HYROX",
    title: "Station Practice",
    format: "3 Rounds",
    movements: ["SkiErg 500m", "Sled Push 25m x 2", "Row 500m", "Farmers Carry 50m"],
  },
  {
    date: "2026-10-27",
    type: "COACH_TRAINING",
    title: "Olympic Lifting Technique",
    format: "Skill Session",
    movements: ["Snatch Balance 5 x 3", "Hang Power Snatch 5 x 2", "Overhead Squat 4 x 5"],
    note: "코치 트레이닝 예시입니다.",
  },
];
