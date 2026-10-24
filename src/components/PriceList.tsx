import { formatPrice, membershipPlans, pricingNotes, ticketPlans } from "@/data/pricing";

// PriceList = 회원권 표 + 횟수권 + 안내 문구
export default function PriceList() {
  return (
    <div className="space-y-8">
      {/* 회원권: 기간 / 정상가 / 재등록가 3열 표. 3열이라 휴대폰에서도 그대로 보입니다. */}
      <div>
        <h3 className="mb-3 text-lg font-bold">회원권</h3>
        <table className="w-full table-fixed border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="w-1/3" />
              <th className="rounded bg-surface py-3 font-bold text-accent">정상가</th>
              <th className="rounded bg-surface py-2 font-bold text-accent">
                {/* block = 줄바꿈해서 작은 안내 문구를 위에 표시 */}
                <span className="block text-xs font-normal text-muted">회원권 만료 전</span>
                재등록가
              </th>
            </tr>
          </thead>
          <tbody>
            {membershipPlans.map((plan) => (
              <tr key={plan.name}>
                <th className="rounded bg-accent py-4 font-bold text-white">{plan.name}</th>
                <td className="rounded border border-line py-4 font-black">
                  {formatPrice(plan.regularPrice)}
                </td>
                <td className="rounded border border-line py-4 font-black">
                  {formatPrice(plan.renewalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 횟수권 */}
      <div>
        <h3 className="mb-3 text-lg font-bold">횟수권</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ticketPlans.map((plan) => (
            <div
              key={plan.name}
              className="flex items-center justify-between rounded-lg border border-line p-5"
            >
              <div>
                <p className="font-bold">
                  {plan.name}
                  {/* subLabel이 있을 때만 표시 (예: 드랍인) */}
                  {plan.subLabel && (
                    <span className="ml-2 text-sm font-normal text-muted">{plan.subLabel}</span>
                  )}
                </p>
                {plan.validity && (
                  <p className="mt-1 text-sm text-muted">사용 기간 {plan.validity}</p>
                )}
              </div>
              <p className="text-xl font-black">{formatPrice(plan.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <ul className="space-y-1 text-sm text-muted">
        {pricingNotes.map((note) => (
          <li key={note}>* {note}</li>
        ))}
      </ul>
    </div>
  );
}
