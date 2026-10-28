// 로그아웃 전원 버튼. 누르면 "로그아웃할까요?" 확인 팝업을 먼저 보여주고, 확인하면 로그아웃합니다.
// 로그아웃은 데이터를 바꾸는 동작이라 링크(GET)가 아니라 폼(POST)으로 보냅니다.
"use client";

import { useRef, useState } from "react";
import { memberLogout } from "@/app/auth/actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import PowerIcon from "@/components/PowerIcon";

export default function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <form ref={formRef} action={memberLogout}>
        <button
          type="button"
          title="로그아웃"
          aria-label="로그아웃"
          onClick={() => setAsking(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
        >
          <PowerIcon />
        </button>
      </form>
      <ConfirmDialog
        open={asking}
        title="로그아웃"
        message="로그아웃 할까요?"
        confirmLabel="로그아웃"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
