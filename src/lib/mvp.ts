// 월간 MVP 순위(지난달 출석 일수 1~3위) → 프로필 사진에 다는 메달. 순위 밖이거나 값이 없으면 undefined
export type Medal = "gold" | "silver" | "bronze";

export function medalOf(rank: number | null | undefined): Medal | undefined {
  return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined;
}

export const medalEmoji: Record<Medal, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
export const medalLabel: Record<Medal, string> = { gold: "지난달 MVP 1위", silver: "지난달 MVP 2위", bronze: "지난달 MVP 3위" };
