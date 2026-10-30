// 누르면 프로필 사진을 크게 보여주는 팝업(모달)이 열리는 프로필 사진. 사진이 없으면(기본 실루엣) 눌러도 열리지 않는 일반 프로필 사진입니다.
// <dialog>의 showModal()을 쓰면 배경이 어두워지고 Esc 키 닫기를 브라우저가 처리해 줍니다. 배경을 눌러도 닫힙니다.
"use client";

import { useRef } from "react";
import Avatar from "@/components/Avatar";

export default function AvatarZoom({
  url,
  name,
  size = 72,
  mark,
}: {
  url: string | null;
  name: string;
  size?: number;
  mark?: React.ComponentProps<typeof Avatar>["mark"];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!url) {
    return <Avatar url={null} name={name} size={size} mark={mark} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`${name} 프로필 사진 크게 보기`}
        title="눌러서 크게 보기"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Avatar url={url} name={name} size={size} mark={mark} />
      </button>
      <dialog
        ref={dialogRef}
        aria-label={`${name} 프로필 사진`}
        // 배경(dialog 자신) 클릭 시 닫기: 사진이나 버튼을 눌렀을 때는 target이 안쪽 요소라서 닫히지 않음
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
        className="m-auto max-h-[90vh] max-w-[92vw] overflow-hidden rounded-lg border border-line bg-background p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-6 border-b border-line px-4 py-2">
            <p className="truncate font-bold">{name}</p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="shrink-0 rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface"
            >
              닫기
            </button>
          </div>
          {/* 사진 주소가 사용자가 올린 외부 주소라서 next/image 대신 일반 img를 씁니다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${name} 프로필 사진`}
            referrerPolicy="no-referrer"
            className="block max-h-[75vh] max-w-[92vw] bg-surface object-contain"
            style={{ minWidth: "min(20rem, 85vw)" }}
          />
        </div>
      </dialog>
    </>
  );
}
