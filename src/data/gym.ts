// 체육관 기본 정보는 이 파일 한 곳에서만 관리합니다.
// 화면 컴포넌트는 여기 값을 읽어서 보여주기만 하므로, 주소나 전화번호가 바뀌면 이 파일만 고치면 됩니다.
// TODO: 아래 값은 예시입니다. 실제 체육관 정보로 바꿔 주세요.

export const gym = {
  name: "SIX Training",
  slogan: "어제보다 강한 오늘",
  // 정적 페이지를 빌드할 때는 new Date()를 쓸 수 없어서 저작권 표기 연도를 고정값으로 둡니다.
  copyrightYear: 2026,
  contact: {
    phone: "010-0000-0000",
    address: "서울특별시 OO구 OO로 123, 지하 1층",
    instagram: "https://www.instagram.com/",
    kakaoChannel: "https://pf.kakao.com/",
  },
};
