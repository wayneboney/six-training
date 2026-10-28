// 내 정보 수정 폼: 이름 + 프로필 사진
// 사진은 브라우저에서 먼저 256x256 정사각형으로 줄여서 올립니다. (용량이 작아지고, 사진에 들어 있는 촬영 위치 등 정보가 지워짐)
"use client";

import { useEffect, useRef, useState } from "react";
import MemberActionForm from "@/components/admin/MemberActionForm";
import ContactFields from "@/components/auth/ContactFields";
import { formatPhone } from "@/lib/profile/contact";
import Avatar from "@/components/Avatar";
import { updateProfileAction, type ProfileActionState } from "@/app/me/profile-actions";
import { NAME_MAX } from "@/lib/auth/validation";

const AVATAR_SIZE = 256; // 줄인 사진의 가로/세로(px)
const ORIGINAL_MAX_BYTES = 15 * 1024 * 1024; // 고르는 원본 사진 최대 용량 (줄이기 전)
const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

// 사진을 가운데 기준 정사각형으로 잘라서 256x256 webp(지원 안 하면 png)로 줄입니다.
async function resizeAvatar(file: File): Promise<File> {
  // createImageBitmap = 사진 파일을 그림으로 읽음. 휴대폰 사진의 회전 정보도 반영됩니다.
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas를 사용할 수 없습니다.");
    }
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob) {
      throw new Error("사진을 변환하지 못했습니다.");
    }
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    return new File([blob], `avatar.${ext}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

type ProfileFormProps = {
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
};

export default function ProfileForm({ name, avatarUrl, phone, birthDate, gender }: ProfileFormProps) {
  const [newAvatar, setNewAvatar] = useState<File | null>(null); // 새로 고른(줄여 둔) 사진
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false); // 현재 사진을 지우기로 했는지
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 미리보기 주소는 쓰고 나면 해제합니다. (브라우저 메모리 정리)
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPhotoError(null);
    if (!ACCEPT_TYPES.includes(file.type)) {
      setPhotoError("jpg, png, webp 사진만 올릴 수 있습니다.");
      event.target.value = "";
      return;
    }
    if (file.size > ORIGINAL_MAX_BYTES) {
      setPhotoError("사진 용량이 너무 큽니다. (15MB 이하)");
      event.target.value = "";
      return;
    }
    setResizing(true);
    try {
      const resized = await resizeAvatar(file);
      setNewAvatar(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setRemoveAvatar(false);
    } catch (error) {
      console.error("[profile] 사진 변환 실패", error);
      setPhotoError("사진을 읽지 못했습니다. 다른 사진으로 시도해 주세요.");
      event.target.value = "";
    } finally {
      setResizing(false);
    }
  }

  function onRemove() {
    setNewAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    setPhotoError(null);
    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  // 폼이 제출되면 줄여 둔 사진을 폼 데이터에 넣어서 서버로 보냅니다. (파일 선택칸의 원본은 name이 없어서 보내지지 않음)
  async function submit(prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
    if (newAvatar) {
      formData.set("avatar", newAvatar);
    } else if (removeAvatar) {
      formData.set("removeAvatar", "1");
    }
    const result = await updateProfileAction(prev, formData);
    if (result?.ok) {
      // 저장되면 화면의 임시 상태를 비웁니다. (서버가 준 새 사진/이름이 props로 들어옴)
      setNewAvatar(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
    return result;
  }

  // 지금 화면에 보여줄 사진: 새로 고른 것 > (삭제 예정이면 없음) > 현재 사진
  const shownUrl = previewUrl ?? (removeAvatar ? null : avatarUrl);
  const hasPhoto = shownUrl !== null;

  return (
    <MemberActionForm action={submit} submitLabel="저장" pendingLabel="저장 중…">
      <div className="flex items-center gap-4">
        <Avatar url={shownUrl} name={name} size={72} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor="avatarFile"
              className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-bold hover:bg-surface"
            >
              {resizing ? "처리 중…" : "사진 선택"}
            </label>
            {hasPhoto && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-line px-3 py-1.5 text-sm font-bold text-muted hover:bg-surface"
              >
                사진 삭제
              </button>
            )}
          </div>
          {/* 이 입력칸에는 name이 없어서 원본 파일은 서버로 보내지지 않습니다. 줄여 둔 사진만 submit에서 넣어 보냅니다. */}
          <input
            ref={fileInput}
            id="avatarFile"
            type="file"
            accept={ACCEPT_TYPES.join(",")}
            onChange={onPickFile}
            className="sr-only"
          />
          <p className="text-xs text-muted">jpg, png, webp · 자동으로 정사각형으로 잘라서 올립니다.</p>
          {(newAvatar || removeAvatar) && (
            <p className="text-xs font-bold text-accent">
              {newAvatar ? "새 사진이 선택되었습니다. 저장을 눌러야 적용됩니다." : "사진을 삭제합니다. 저장을 눌러야 적용됩니다."}
            </p>
          )}
          {photoError && (
            <p role="alert" className="text-xs font-bold text-accent">
              {photoError}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="profileName" className="mb-1 block text-sm font-bold">
          이름
        </label>
        <input
          id="profileName"
          name="name"
          type="text"
          required
          maxLength={NAME_MAX}
          defaultValue={name}
          autoComplete="name"
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <ContactFields idPrefix="profile" birthDate={birthDate} gender={gender} phone={formatPhone(phone)} />
    </MemberActionForm>
  );
}
