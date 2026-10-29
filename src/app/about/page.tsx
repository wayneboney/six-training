import type { Metadata } from "next";
import Image from "next/image";
import PriceList from "@/components/PriceList";
import Section from "@/components/Section";
import Timetable from "@/components/timetable/Timetable";
import { gym, instagramUrl } from "@/data/gym";

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
          <p className="mt-2 max-w-2xl text-muted">{gym.nameStory}</p>
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
        {/* 네이버 지도 캡처 이미지. 누르면 네이버 지도 장소 페이지가 새 탭으로 열립니다.
            group = 마우스를 올렸을 때 안쪽 요소(안내 문구)의 모양을 함께 바꾸기 위한 표시 */}
        <a
          href={gym.contact.naverPlace}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative mb-4 block overflow-hidden rounded-lg border border-line"
        >
          {/* width/height = 원본 크기(2000x1163). 실제 표시 크기는 w-full로 화면 너비에 맞추고 높이는 비율대로 자동 계산
              sizes = 화면 너비별로 실제 표시되는 크기를 알려 줘서, Next.js가 알맞은 크기의 이미지를 골라 보내게 합니다 */}
          <Image
            src="/map.webp"
            alt={`${gym.name} 위치 지도 (6호선 광흥창역 근처)`}
            width={2000}
            height={1163}
            // 모바일은 1.6배로 확대해서 보여주므로 화면 너비의 160% 크기 이미지를 받아야 선명합니다.
            sizes="(min-width: 1024px) 992px, (min-width: 640px) 100vw, 160vw"
            // 모바일: 마커(가로 42% 지점)를 중심으로 1.6배 확대, PC(sm 이상): 원본 그대로 + 마우스 올리면 살짝 확대
            className="aspect-[4/3] h-auto w-full origin-[42%_50%] scale-[1.6] object-cover object-[42%_50%] sm:aspect-auto sm:scale-100 sm:transition sm:group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-3 py-1.5 text-xs font-bold shadow group-hover:text-accent">
            네이버 지도에서 크게 보기 ↗
          </span>
        </a>
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
