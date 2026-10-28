// 생년월일 / 성별 / 전화번호 입력칸. 회원가입과 내 정보 수정에서 같이 씁니다.
// 여기 검사(required, max)는 편의용이고, 진짜 검사는 서버(contact.ts)와 DB 제약이 다시 합니다.
import { seoulTodayKey } from "@/lib/date";
import { genderLabels, type Gender } from "@/lib/profile/contact";

const inputClass = "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none";

type ContactFieldsProps = {
  idPrefix: string; // 한 화면에 두 번 쓰일 때 id 충돌 방지
  birthDate?: string | null;
  gender?: string | null;
  phone?: string | null; // 화면에 보여줄 값 (하이픈 있어도 됨)
};

export default function ContactFields({ idPrefix, birthDate, gender, phone }: ContactFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-birthDate`} className="mb-1 block text-sm font-bold">
          생년월일
        </label>
        <input
          id={`${idPrefix}-birthDate`}
          name="birthDate"
          type="date"
          required
          min="1900-01-01"
          max={seoulTodayKey()}
          defaultValue={birthDate ?? undefined}
          autoComplete="bday"
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="mb-1 block text-sm font-bold">성별</legend>
        <div className="flex gap-4">
          {(Object.keys(genderLabels) as Gender[]).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="gender" value={value} required defaultChecked={gender === value} />
              {genderLabels[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-phone`} className="mb-1 block text-sm font-bold">
          전화번호
        </label>
        <input
          id={`${idPrefix}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          required
          maxLength={13}
          placeholder="010-1234-5678"
          autoComplete="tel"
          defaultValue={phone ?? undefined}
          className={inputClass}
        />
      </div>
    </>
  );
}
