// 가격표 데이터. 가격이 바뀌면 이 파일만 고치면 됩니다.

// 기간 회원권 (정상가 / 회원권 만료 전 재등록가)
export type MembershipPlan = {
  name: string;
  regularPrice: number; // 원 단위 정수
  renewalPrice: number; // 회원권이 끝나기 전에 재등록할 때 가격
};

// 횟수권
export type TicketPlan = {
  name: string;
  subLabel?: string; // 예: "드랍인"
  price: number;
  validity?: string; // 사용 기간. 예: "2개월"
};

export const membershipPlans: MembershipPlan[] = [
  { name: "1개월", regularPrice: 250000, renewalPrice: 240000 },
  { name: "3개월", regularPrice: 690000, renewalPrice: 650000 },
  { name: "6개월", regularPrice: 1250000, renewalPrice: 1150000 },
];

export const ticketPlans: TicketPlan[] = [
  { name: "1회", subLabel: "드랍인", price: 25000 },
  { name: "10회권", price: 225000, validity: "2개월" },
];

export const pricingNotes = [
  "경찰관, 소방관, 대학생은 상시 20% 할인됩니다. (일반 회원권, 정상가 기준)",
  "드랍인은 1회당 가격입니다. 크로스핏/하이록스 수업을 연속으로 신청하는 경우 40,000원입니다.",
  "10회권 사용 기간은 2개월이며, 크로스핏/하이록스 수업을 연속으로 듣는 경우 2회 차감됩니다.",
];

// 가격을 "250,000원" 형태로 바꿉니다. (Java의 DecimalFormat("#,###")과 같은 역할)
export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
