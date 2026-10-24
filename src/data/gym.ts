// 체육관 정보는 이 파일 한 곳에서만 관리합니다.
// 화면 컴포넌트는 여기 값을 읽어서 보여주기만 하므로, 가격이나 시간표가 바뀌면 이 파일만 고치면 됩니다.
// TODO: 철학(philosophy), 시설(facilities) 문구와 박스 인스타그램, 카카오톡 채널은 아직 예시 값입니다.

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
  slogan: "어제보다 강한 오늘",
  intro:
    "SIX Training은 다양한 기능성 움직임을 높은 강도로 수행하는 그룹 트레이닝 박스입니다. " +
    "처음 오시는 분도 코치가 동작부터 차근차근 지도하니 체력에 상관없이 시작할 수 있습니다.",
  // 정적 페이지를 빌드할 때는 new Date()를 쓸 수 없어서 저작권 표기 연도를 고정값으로 둡니다.
  copyrightYear: 2026,

  // satisfies = "이 배열이 InfoCard[] 모양을 지키는지 검사해 줘"라는 뜻입니다.
  philosophy: [
    {
      title: "안전이 먼저",
      description: "무게보다 정확한 자세가 우선입니다. 모든 수업에 코치가 함께합니다.",
    },
    {
      title: "누구나 시작",
      description: "운동 경험이 없어도 강도를 조절해서 같은 운동을 함께 수행합니다.",
    },
    {
      title: "함께하는 커뮤니티",
      description: "혼자서는 못 할 것 같던 운동도 함께라면 끝까지 해낼 수 있습니다.",
    },
  ] satisfies InfoCard[],

  facilities: [
    { title: "리그 & 풀업바", description: "8인 동시 사용 가능한 리그" },
    { title: "바벨 & 플레이트", description: "올림픽 바벨, 범퍼 플레이트 완비" },
    { title: "유산소 머신", description: "로잉, 에어바이크, 스키에르그, 트레드밀" },
    { title: "샤워실 & 락커", description: "남녀 분리 샤워실, 개인 락커" },
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
    // TODO: 박스 인스타그램, 카카오톡 채널은 아직 예시 값입니다.
    instagram: "https://www.instagram.com/",
    kakaoChannel: "https://pf.kakao.com/",
    // 네이버 지도 장소 페이지 (식스트레이닝, 장소 ID 1692057510)
    naverPlace: "https://map.naver.com/p/entry/place/1692057510",
  },
};

// 인스타그램 아이디로 프로필 주소를 만듭니다. 예: "steel.yoon" → "https://www.instagram.com/steel.yoon/"
// encodeURIComponent = 아이디에 특수문자가 섞여도 안전한 URL이 되도록 인코딩 (Java의 URLEncoder.encode)
export function instagramUrl(id: string): string {
  return `https://www.instagram.com/${encodeURIComponent(id)}/`;
}
