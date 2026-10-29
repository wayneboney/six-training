// 회원 이름 정렬 규칙: 한글 이름(가나다순) → 영어 이름(ABC순, 대소문자 무시) → 그 밖(숫자, 기호로 시작)
// 같은 이름이면 먼저 가입한 사람이 위에 옵니다.

// 이름의 첫 글자로 분류: 0 = 한글, 1 = 영어, 2 = 그 밖
function nameGroup(name: string): number {
  const first = name.trim().charAt(0);
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(first)) {
    return 0;
  }
  if (/[A-Za-z]/.test(first)) {
    return 1;
  }
  return 2;
}

const koCollator = new Intl.Collator("ko");
const enCollator = new Intl.Collator("en", { sensitivity: "base" }); // 대소문자, 악센트 무시

export function compareNames(a: string, b: string): number {
  const groupA = nameGroup(a);
  const groupB = nameGroup(b);
  if (groupA !== groupB) {
    return groupA - groupB;
  }
  return groupA === 1 ? enCollator.compare(a.trim(), b.trim()) : koCollator.compare(a.trim(), b.trim());
}

// 관리자 계정을 맨 위에 두고, 그 아래로 일반 회원을 이름순으로 정렬합니다. (관리자끼리도 이름순)
export function sortMembersByName<T extends { role: string; name: string; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const adminA = a.role === "admin" ? 0 : 1;
    const adminB = b.role === "admin" ? 0 : 1;
    if (adminA !== adminB) {
      return adminA - adminB;
    }
    return compareNames(a.name, b.name) || a.createdAt.localeCompare(b.createdAt);
  });
}
