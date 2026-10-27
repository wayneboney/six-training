// 공휴일 조회. 공공데이터포털의 "한국천문연구원 특일 정보" API에서 가져옵니다. (설날/추석/대체공휴일/임시공휴일 포함)
// 서버에서만 호출하고, 서비스 키(HOLIDAY_API_KEY)는 브라우저에 절대 내려가지 않습니다.
//
// 동작 요약
//   - 연도별로 API를 1번 호출하고, 결과를 하루 동안 서버에 저장(캐시)해서 방문자가 몰려도 API는 하루 몇 번만 부릅니다.
//   - 키가 없거나 API가 실패하면 공휴일 없이 달력만 보여줍니다. (달력이 깨지지 않게 하고, 실패한 결과는 캐시하지 않음)
import "server-only";
import { cacheLife } from "next/cache";

// 기본 주소는 공공데이터포털입니다. HOLIDAY_API_URL은 테스트용 가짜 서버로 바꿀 때만 씁니다. (운영에서는 설정하지 않음)
const DEFAULT_API_URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const REQUEST_TIMEOUT_MS = 5000;

// API가 돌려주는 공식 명칭 중 일상에서 잘 안 쓰는 이름을 화면용 이름으로 바꿉니다. 목록에 없는 이름은 그대로 보여줍니다.
const DISPLAY_NAMES: Record<string, string> = {
  기독탄신일: "성탄절",
  "1월1일": "신정",
};

type ApiItem = { dateName?: unknown; locdate?: unknown; isHoliday?: unknown };

// 서비스 키: 공공데이터포털은 "인코딩된 키"와 "디코딩된 키" 두 가지를 줍니다.
// 우리는 URLSearchParams가 알아서 인코딩하므로 디코딩된 키가 필요한데, 인코딩된 키(%가 들어 있음)를 넣어도 동작하도록 풀어 줍니다.
function readServiceKey(): string | null {
  const raw = process.env.HOLIDAY_API_KEY?.trim();
  if (!raw) {
    return null;
  }
  try {
    return raw.includes("%") ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
}

// 응답의 item은 0개면 없고, 1개면 객체, 2개 이상이면 배열로 오는 API라서 항상 배열로 맞춥니다.
function toItems(body: unknown): ApiItem[] {
  const items = (body as { response?: { body?: { items?: unknown } } })?.response?.body?.items;
  if (!items || typeof items !== "object") {
    return []; // 공휴일이 하나도 없는 해는 items가 빈 문자열로 옵니다.
  }
  const item = (items as { item?: unknown }).item;
  if (Array.isArray(item)) {
    return item as ApiItem[];
  }
  return item && typeof item === "object" ? [item as ApiItem] : [];
}

// 20261003 → "2026-10-03"
function toDateKey(locdate: unknown): string | null {
  const text = String(locdate ?? "");
  return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : null;
}

// 한 해의 공휴일을 API에서 가져옵니다. 실패하면 에러를 던지고, 에러 결과는 캐시되지 않습니다.
async function fetchYear(year: number, serviceKey: string): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days"); // 하루 단위로 갱신. 키/연도가 같으면 저장된 결과를 재사용

  const params = new URLSearchParams({
    serviceKey,
    solYear: String(year),
    numOfRows: "100",
    _type: "json",
  });
  const response = await fetch(`${process.env.HOLIDAY_API_URL ?? DEFAULT_API_URL}?${params}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`공휴일 API 응답 오류 (HTTP ${response.status})`);
  }

  // 키가 잘못되면 JSON이 아니라 XML 오류 문서가 와서 json() 단계에서 에러가 납니다. (키 값은 로그에 남기지 않음)
  const body: unknown = await response.json();
  const code = (body as { response?: { header?: { resultCode?: unknown } } })?.response?.header?.resultCode;
  if (code !== undefined && String(code) !== "00") {
    throw new Error(`공휴일 API 오류 코드 ${String(code)}`);
  }

  const result: Record<string, string> = {};
  for (const item of toItems(body)) {
    const key = toDateKey(item.locdate);
    if (key && item.isHoliday === "Y" && typeof item.dateName === "string") {
      result[key] = DISPLAY_NAMES[item.dateName] ?? item.dateName;
    }
  }
  return result;
}

// 여러 해의 공휴일을 합쳐서 돌려줍니다. { "2026-10-03": "개천절", ... }
// 어떤 이유로든 실패한 해는 건너뛰고(로그만 남김) 나머지는 보여줍니다.
export async function getHolidays(years: number[]): Promise<Record<string, string>> {
  const serviceKey = readServiceKey();
  if (!serviceKey) {
    console.warn("[holidays] HOLIDAY_API_KEY가 없어서 공휴일을 표시하지 않습니다.");
    return {};
  }

  const settled = await Promise.allSettled([...new Set(years)].map((year) => fetchYear(year, serviceKey)));
  const merged: Record<string, string> = {};
  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      Object.assign(merged, outcome.value);
    } else {
      console.error(`[holidays] ${years[index]}년 공휴일 조회 실패`, outcome.reason instanceof Error ? outcome.reason.message : "");
    }
  }
  return merged;
}
