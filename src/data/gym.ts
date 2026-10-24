// 체육관 정보는 이 파일 한 곳에서만 관리합니다.
// 화면 컴포넌트는 여기 값을 읽어서 보여주기만 하므로, 가격이나 시간표가 바뀌면 이 파일만 고치면 됩니다.
// TODO: 아래 값은 모두 예시입니다. 실제 체육관 정보로 바꿔 주세요.

// type = 데이터의 모양 정의. Java의 DTO 클래스와 같은 역할입니다.
// 정의와 다른 모양의 값을 넣으면 저장하는 순간 VS Code에 빨간 밑줄이 생깁니다.
export type InfoCard = {
  title: string;
  description: string;
};

export type Coach = {
  name: string;
  role: string;
  certifications: string[]; // string[] = 문자열 배열 (Java의 List<String>)
  bio: string;
};

export type PricePlan = {
  name: string;
  price: number; // 원 단위 정수. 화면에 보여줄 때 formatPrice로 "200,000원" 형태로 바꿉니다.
  description: string;
  highlight?: boolean; // ? = 생략 가능 (Java의 null 허용 필드). true면 추천 상품으로 강조
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
    { title: "유산소 머신", description: "로잉, 에어바이크, 스키에르그" },
    { title: "샤워실 & 락커", description: "남녀 분리 샤워실, 개인 락커" },
  ] satisfies InfoCard[],

  coaches: [
    {
      name: "김코치",
      role: "헤드 코치",
      certifications: ["CrossFit Level 2 Trainer", "생활스포츠지도사 2급"],
      bio: "10년 차 코치. 초보자 기초 동작 지도를 전문으로 합니다.",
    },
    {
      name: "이코치",
      role: "코치",
      certifications: ["CrossFit Level 1 Trainer"],
      bio: "HYROX 선수 출신. 체력과 지구력 향상 프로그램을 담당합니다.",
    },
  ] satisfies Coach[],

  // 수업 시간표는 양이 많아서 src/data/timetable.ts로 분리했습니다.

  pricing: [
    { name: "1회 체험", price: 20000, description: "처음 오시는 분 대상 1회 수업" },
    { name: "1개월", price: 200000, description: "주 횟수 제한 없음" },
    { name: "3개월", price: 540000, description: "월 18만 원, 10% 할인", highlight: true },
  ] satisfies PricePlan[],

  contact: {
    phone: "010-0000-0000",
    address: "서울특별시 OO구 OO로 123, 지하 1층",
    instagram: "https://www.instagram.com/",
    kakaoChannel: "https://pf.kakao.com/",
  },
};

// 가격을 "200,000원" 형태로 바꿉니다. (Java의 DecimalFormat("#,###")과 같은 역할)
export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

// 지도 API 키 없이 쓸 수 있도록 네이버 지도 검색 링크를 만듭니다.
// 주소에 한글과 공백이 있어서 encodeURIComponent로 URL 인코딩해야 합니다. (Java의 URLEncoder.encode)
export function mapSearchUrl(address: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
}
