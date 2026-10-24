import type { Metadata } from "next";
import PriceList from "@/components/PriceList";
import Section from "@/components/Section";
import Timetable from "@/components/timetable/Timetable";
import { gym, googleMapEmbedUrl, instagramUrl } from "@/data/gym";

// 탭 제목이 layout.tsx의 template 규칙에 따라 "체육관 소개 | SIX Training"이 됩니다.
export const metadata: Metadata = {
  title: "체육관 소개",
};

// /about 주소의 화면. app/about 폴더 이름이 곧 URL이 됩니다. (Spring의 @GetMapping("/about") 역할)
// 데이터는 전부 src/data/gym.ts에서 가져오므로, 이 파일은 "어떻게 보여줄지"만 담당합니다.
export default function AboutPage() {
  return (
    // <>...</> = 여러 요소를 감싸기만 하고 실제 HTML 태그는 만들지 않는 빈 묶음(Fragment)
    <>
      {/* 상단 소개 영역 */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="text-sm font-bold tracking-widest text-accent">SINCE {gym.foundedYear}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">체육관 소개</h1>
          <p className="mt-4 max-w-2xl text-muted">{gym.intro}</p>
        </div>
      </div>

      <Section title="우리의 철학">
        {/* grid sm:grid-cols-3 = 모바일은 1열, PC는 3열 */}
        <div className="grid gap-4 sm:grid-cols-3">
          {gym.philosophy.map((item) => (
            <div key={item.title} className="rounded-lg border border-line p-6">
              <h3 className="text-lg font-bold text-accent">{item.title}</h3>
              <p className="mt-2 text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="시설">
        <ul className="grid gap-4 sm:grid-cols-2">
          {gym.facilities.map((item) => (
            <li key={item.title} className="rounded-lg bg-surface p-5">
              <p className="font-bold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="코치진">
        <div className="grid gap-4 sm:grid-cols-3">
          {gym.coaches.map((coach) => (
            <div key={coach.name} className="rounded-lg border border-line p-6">
              <p className="text-sm font-bold text-accent">{coach.role}</p>
              <h3 className="mt-1 text-xl font-black">{coach.name}</h3>
              {/* 인스타그램 아이디를 프로필 링크로. 외부 사이트라 새 탭 + 보안 설정(rel) */}
              <a
                href={instagramUrl(coach.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-muted hover:text-accent hover:underline"
              >
                @{coach.instagram}
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section title="수업 시간표">
        <Timetable />
      </Section>

      <Section title="가격">
        <PriceList />
      </Section>

      <Section title="오시는 길">
        {/* iframe = 다른 사이트(구글 지도)의 화면을 우리 페이지 안에 끼워 넣는 태그
            title = 화면 낭독기가 읽어 주는 이름, loading="lazy" = 지도 근처까지 스크롤했을 때 불러와서 첫 화면이 빨라짐
            aspect-[4/3] sm:aspect-[16/7] = 모바일은 4:3, PC는 가로로 넓게 */}
        <iframe
          title={`${gym.name} 위치 지도`}
          src={googleMapEmbedUrl(gym.contact.mapQuery)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mb-4 aspect-[4/3] w-full rounded-lg border border-line sm:aspect-[16/7]"
        />
        <div className="rounded-lg bg-surface p-6">
          <p>{gym.contact.address}</p>
          <p className="mt-1 text-muted">전화 {gym.contact.phone}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {/* 외부 사이트 링크: 새 탭 + 보안 설정(rel) */}
            <a
              href={gym.contact.naverPlace}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              네이버 지도에서 보기
            </a>
            <a
              href={gym.contact.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-line px-4 py-2 text-sm font-bold hover:bg-background"
            >
              인스타그램
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
