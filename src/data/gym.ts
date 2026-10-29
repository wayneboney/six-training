// 체육관 정보는 이 파일 한 곳에서만 관리합니다.
// 화면 컴포넌트는 여기 값을 읽어서 보여주기만 하므로, 가격이나 시간표가 바뀌면 이 파일만 고치면 됩니다.

// type = 데이터의 모양 정의. Java의 DTO 클래스와 같은 역할입니다.
// 정의와 다른 모양의 값을 넣으면 저장하는 순간 VS Code에 빨간 밑줄이 생깁니다.
export type InfoCard = {
  title: string;
  description: string;
};

export type Coach = {
  name: string;
  role: string;
  instagram: string; // 인스타그램 아이디 (@ 없이). 화면에서 프로필 링크로 바뀝니다.
};

export const gym = {
  name: "SIX Training",
  slogan: "Wake up your Sixth Sense",
  // 대표 소개 문구 (네이버 플레이스 소개와 같은 내용). 홈 첫 화면과 푸터에 나옵니다.
  highlights: ["마포구 유일 하이록스 박스", "독일 본사 하이록스 정식 지부", "크로스핏 레벨 1, 2 코치진 구성"],
  intro:
    "SIX Training은 마포구 유일의 하이록스 박스입니다. 독일 본사 하이록스 정식 지부이며, " +
    "크로스핏 레벨 1, 2 코치진이 함께합니다.",
  // 박스를 연 해. 푸터 저작권 표기와 소개 페이지의 "SINCE 2024"에 씁니다.
  // (정적 페이지를 빌드할 때는 new Date()를 쓸 수 없어서 연도를 고정값으로 둡니다)
  foundedYear: 2024,

  // satisfies = "이 배열이 InfoCard[] 모양을 지키는지 검사해 줘"라는 뜻입니다.
  philosophy: [
    {
      title: "하이록스 정식 지부",
      description: "독일 본사 하이록스 정식 지부로, 마포구에서 하이록스를 제대로 배우고 훈련할 수 있는 유일한 박스입니다.",
    },
    {
      title: "자격을 갖춘 코치진",
      description: "크로스핏 레벨 1, 2 코치진이 동작부터 강도 조절까지 수업을 이끕니다.",
    },
    {
      title: "크로스핏 · 하이록스 · 오픈짐",
      description: "수업 시간표에 맞춰 크로스핏과 하이록스 수업을 듣고, 오픈짐 시간에는 자유롭게 훈련할 수 있습니다.",
    },
  ] satisfies InfoCard[],

  // 비어 있으면 소개 페이지에서 "시설" 영역이 나오지 않습니다. 장비가 바뀌면 이 목록만 고치면 됩니다.
  facilities: [
    { title: "하이록스 스테이션", description: "슬레드 푸시, 슬레드 풀, 스키에르그, 로잉" },
    { title: "유산소 머신", description: "로잉, 스키에르그, 바이크, 에어바이크, 트레드밀" },
    { title: "프리웨이트", description: "바벨, 덤벨, 케틀벨, 메디신볼" },
  ] satisfies InfoCard[],

  coaches: [
    { name: "윤효용", role: "헤드 코치", instagram: "steel.yoon" },
    { name: "김성희", role: "코치", instagram: "sjy_shee" },
    { name: "이정인", role: "코치", instagram: "mambaleee" },
  ] satisfies Coach[],

  // 수업 시간표는 src/data/timetable.ts, 가격표는 src/data/pricing.ts로 분리했습니다.

  contact: {
    phone: "0507-1333-6632",
    address: "서울 마포구 독막로22길 9 B1층",
    instagram: "https://www.instagram.com/six__training/",
    // 네이버 지도 장소 페이지 (식스트레이닝, 장소 ID 1692057510)
    naverPlace: "https://map.naver.com/p/entry/place/1692057510",
  },
};

// 인스타그램 아이디로 프로필 주소를 만듭니다. 예: "steel.yoon" → "https://www.instagram.com/steel.yoon/"
// encodeURIComponent = 아이디에 특수문자가 섞여도 안전한 URL이 되도록 인코딩 (Java의 URLEncoder.encode)
export function instagramUrl(id: string): string {
  return `https://www.instagram.com/${encodeURIComponent(id)}/`;
}
