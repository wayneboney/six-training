import { gym } from "@/data/gym";

// 시행일: 내용을 바꾸면 이 날짜도 함께 바꿉니다.
const EFFECTIVE_DATE = "2026-10-28";

// 항목별 표. 문구만 바꾸면 되도록 데이터로 분리했습니다.
const collected = [
  { item: "이름, 이메일, 비밀번호", purpose: "회원 확인, 로그인", keep: "삭제 시까지" },
  { item: "생년월일, 성별, 전화번호", purpose: "회원 확인, 연령 확인(만 14세 이상), 공지·안내 연락", keep: "삭제 시까지" },
  { item: "회원권·홀딩·수업 예약 기록", purpose: "회원권 관리, 수업 예약 및 출석 확인", keep: "삭제 시까지" },
  { item: "프로필 사진 (선택)", purpose: "수업 예약자 목록 등에서 본인 표시", keep: "삭제 요청 또는 회원 정보 삭제 시까지" },
];

// 방침 본문. PrivacyModal(팝업) 안에서 보여줍니다. 문구를 고치면 푸터와 회원가입 화면 양쪽에 반영됩니다.
export default function PrivacyPolicy() {
  return (
    <>
      <p className="mt-2 text-sm text-muted">시행일 {EFFECTIVE_DATE}</p>
      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-bold">1. 수집하는 개인정보와 이용 목적</h2>
          <p className="mt-2 text-muted">
            {gym.name}(이하 &ldquo;박스&rdquo;)는 아래 정보를 회원가입과 서비스 제공에 필요한 범위에서만 수집합니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-bold">항목</th>
                  <th className="py-2 pr-3 font-bold">이용 목적</th>
                  <th className="py-2 font-bold">보유 기간</th>
                </tr>
              </thead>
              <tbody>
                {collected.map((row) => (
                  <tr key={row.item} className="border-b border-line align-top">
                    <td className="py-2 pr-3">{row.item}</td>
                    <td className="py-2 pr-3">{row.purpose}</td>
                    <td className="py-2">{row.keep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-muted">위 필수 항목에 동의하지 않으시면 회원가입을 할 수 없습니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold">2. 누가 볼 수 있나요</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>생년월일, 성별, 전화번호, 이메일은 회원 본인과 박스 관리자(코치)만 볼 수 있습니다.</li>
            <li>
              수업 예약자 목록에는 같은 박스 회원에게 <strong className="text-foreground">이름과 프로필 사진</strong>이
              표시됩니다. 사진을 등록하지 않으면 기본 이미지가 보입니다.
            </li>
            <li>법령에 근거가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">3. 처리 위탁 및 국외 보관</h2>
          <p className="mt-2 text-muted">
            서비스 운영을 위해 회원 정보는 클라우드 데이터베이스(Supabase)에 저장되며, 해당 서버는 국외에 있을 수
            있습니다. 정보는 암호화된 통신으로 전송되고, 접근 권한은 본인과 관리자로 제한됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">4. 보유 기간과 파기</h2>
          <p className="mt-2 text-muted">
            회원권 기간이 끝나면 비활성 회원으로 전환되며, 마지막 회원권 종료 후 3년이 지나면 개인정보와 프로필
            사진을 삭제합니다. 탈퇴를 원하시면 코치에게 요청해 주세요. 요청 시 관리자가 지체 없이 삭제합니다. 다만
            법령에서 보관을 요구하는 정보는 그 기간 동안 따로 보관한 뒤 파기합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">5. 이용자의 권리</h2>
          <p className="mt-2 text-muted">
            회원은 언제든지 &ldquo;내 정보&rdquo; 화면에서 이름, 생년월일, 성별, 전화번호, 프로필 사진을 확인하고
            수정할 수 있습니다. 열람·정정·삭제·처리 정지, 탈퇴는 아래 문의처로 요청해 주세요.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">6. 만 14세 미만</h2>
          <p className="mt-2 text-muted">만 14세 미만은 직접 가입할 수 없습니다. 법정대리인이 코치에게 문의해 주세요.</p>
        </section>

        <section>
          <h2 className="text-base font-bold">7. 문의처</h2>
          <p className="mt-2 text-muted">
            {gym.name} · {gym.contact.address}
            <br />
            전화 {gym.contact.phone}
          </p>
        </section>
      </div>
    </>
  );
}
