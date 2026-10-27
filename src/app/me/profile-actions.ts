// 내 정보(이름, 프로필 사진) 수정 Server Action.
// 순서: ① 로그인 확인 → ② 입력값 검증 → ③ 사진 업로드 → ④ 프로필 저장 → ⑤ 예전 사진 정리
// 사진 업로드/저장 권한은 DB(Storage 규칙, RLS, 트리거)가 한 번 더 막습니다. (본인 폴더만, 본인 프로필만)
"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/member";
import { validateName } from "@/lib/auth/validation";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, avatarPathFromUrl, sniffAvatarType } from "@/lib/profile/avatar";
import { toFailure, type ActionResult } from "@/lib/members/rpc-error";
import { createAuthSupabase } from "@/lib/supabase/auth";

export type ProfileActionState = ActionResult | undefined;

export async function updateProfileAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const member = await requireMember();

  // ② 이름 검증
  const name = validateName(formData.get("name"));
  if (!name.ok) {
    return { ok: false, message: name.error };
  }

  // 사진: 새로 올린 파일이 있으면 교체, 삭제 요청이면 비우기, 둘 다 아니면 그대로
  const file = formData.get("avatar");
  const removeAvatar = formData.get("removeAvatar") === "1";
  const supabase = await createAuthSupabase();

  let newAvatarUrl: string | null | undefined; // undefined = 사진은 바꾸지 않음
  let uploadedPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > AVATAR_MAX_BYTES) {
      return { ok: false, message: "사진 용량이 너무 큽니다. 다른 사진으로 시도해 주세요." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffAvatarType(bytes);
    if (!type) {
      return { ok: false, message: "jpg, png, webp 사진만 올릴 수 있습니다." };
    }

    // 경로 = <내 user_id>/<시각>-<무작위>.<확장자>. 파일 이름은 서버가 만들어서, 사용자가 보낸 이름은 쓰지 않습니다.
    // 이름이 매번 달라서 사진을 바꾸면 주소도 바뀌고, 브라우저가 예전 사진을 캐시로 보여주는 문제가 없습니다.
    uploadedPath = `${member.userId}/${Date.now()}-${randomBytes(4).toString("hex")}.${type.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(uploadedPath, bytes, { contentType: type.mime, cacheControl: "31536000", upsert: false });
    if (uploadError) {
      console.error("[profile] 사진 업로드 실패", uploadError.message);
      return { ok: false, message: "사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    newAvatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
  } else if (removeAvatar) {
    newAvatarUrl = null;
  }

  // ④ 프로필 저장. select()를 붙여서 실제로 1줄이 바뀌었는지 확인합니다. (RLS 때문에 0줄이면 에러 없이 지나가기도 함)
  const changes: { name: string; avatar_url?: string | null } = { name: name.value };
  if (newAvatarUrl !== undefined) {
    changes.avatar_url = newAvatarUrl;
  }
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("user_id", member.userId)
    .select("user_id");

  if (error || !updated || updated.length !== 1) {
    // 저장에 실패하면 방금 올린 사진은 쓸모없으므로 지웁니다. (찌꺼기 방지)
    if (uploadedPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]);
    }
    if (error) {
      return toFailure(error, "내 정보 저장");
    }
    return { ok: false, message: "저장하지 못했습니다. 다시 로그인한 뒤 시도해 주세요." };
  }

  // ⑤ 예전 사진 파일 정리 (실패해도 저장은 이미 끝났으므로 로그만 남김)
  if (newAvatarUrl !== undefined) {
    const oldPath = avatarPathFromUrl(member.avatarUrl, member.userId);
    if (oldPath && oldPath !== uploadedPath) {
      const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      if (removeError) {
        console.error("[profile] 예전 사진 삭제 실패", removeError.message);
      }
    }
  }

  // 헤더(모든 화면 위쪽)의 이름과 사진도 새로 그리도록 합니다.
  revalidatePath("/", "layout");
  return { ok: true, message: "저장했습니다." };
}
