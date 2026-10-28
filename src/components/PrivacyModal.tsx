// 버튼을 누르면 페이지 이동 없이 개인정보처리방침을 팝업으로 보여줍니다. (개인정보처리방침은 별도 페이지 없이 모두 이 팝업으로 봅니다)
// 쓰는 곳: 푸터, 회원가입 동의 문구. 버튼 글자와 모양은 children / className으로 정합니다.
// <dialog>의 showModal()을 쓰면 배경이 어두워지고, Esc 키와 포커스 가두기를 브라우저가 처리해 줍니다.
"use client";

import { useRef, type ReactNode } from "react";
import PrivacyPolicy from "@/components/PrivacyPolicy";

export default function PrivacyModal({
  children = "자세히 보기",
  className = "font-bold text-accent underline",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-label="개인정보처리방침"
        // 배경(dialog 자신) 클릭 시 닫기: 안쪽 내용을 눌렀을 때는 target이 안쪽 요소라서 닫히지 않음
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-lg border border-line bg-background p-0 text-foreground backdrop:bg-black/50"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-bold">개인정보처리방침</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-line px-3 py-1 text-sm font-bold hover:bg-surface"
            >
              닫기
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            <PrivacyPolicy />
          </div>
        </div>
      </dialog>
    </>
  );
}
