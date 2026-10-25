// WOD 등록/수정 Server Action (Spring의 @PostMapping 컨트롤러 역할)
// 순서: ① 권한 확인 → ② 입력값 검증 → ③ 저장 → ④ 목록으로 이동
// 액션은 얇게 유지하고, 실제 저장과 권한 확인은 admin-repository.ts에 둡니다.
"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createWod, deleteWod, updateWod, type WodSaveError } from "@/lib/wods/admin-repository";
import {
  parseWodId,
  validateWodForm,
  type WodFieldErrors,
  type WodFormValues,
} from "@/lib/wods/validation";

// 폼에 돌려줄 결과
export type WodFormState =
  | {
      formError?: string; // 폼 전체에 대한 에러 (중복, 권한 등)
      errors?: WodFieldErrors; // 칸별 에러
      values: WodFormValues; // 다시 채워 넣을 입력값
    }
  | undefined;

// 저장 실패 원인 → 화면 안내 문구
function messageFor(error: WodSaveError): string {
  switch (error.kind) {
    case "duplicate":
      return error.message;
    case "unauthorized":
      return "관리자 권한이 없습니다. 다시 로그인해 주세요.";
    case "not_found":
      return "이미 삭제된 WOD입니다. 목록에서 다시 확인해 주세요.";
    case "unknown":
      return "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

// 저장/삭제 후 돌아갈 목록 주소: 그 WOD의 달 + 완료 표시(saved 또는 deleted)
function listUrl(date: string, done: "saved" | "deleted" = "saved"): string {
  return `/admin?month=${date.slice(0, 7)}&${done}=1`;
}

export async function createWodAction(_prev: WodFormState, formData: FormData): Promise<WodFormState> {
  // ① 로그인이 풀렸으면 로그인 화면으로 (액션도 직접 호출될 수 있어서 매번 확인)
  await requireAdmin();

  // ② 검증
  const result = validateWodForm(formData);
  if (!result.ok) {
    return { errors: result.errors, values: result.values };
  }

  // ③ 저장
  const saved = await createWod(result.value);
  if (!saved.ok) {
    return { formError: messageFor(saved.error), values: result.values };
  }

  // ④ 성공: 목록으로 (redirect는 try/catch 밖에서)
  redirect(listUrl(saved.wod.date));
}

// 수정은 어떤 WOD인지(id)가 필요해서, 화면에서 .bind(null, id)로 id를 붙여서 넘겨줍니다.
// 이 id는 브라우저를 거쳐 돌아오므로 조작될 수 있다고 보고 다시 검사합니다.
// (조작해서 다른 WOD를 가리켜도, 관리자가 아니면 DB의 RLS가 막습니다)
export async function updateWodAction(
  id: number,
  _prev: WodFormState,
  formData: FormData,
): Promise<WodFormState> {
  await requireAdmin();

  const result = validateWodForm(formData);
  const wodId = parseWodId(id);
  if (wodId === null) {
    return { formError: "잘못된 요청입니다. 목록에서 다시 선택해 주세요.", values: result.values };
  }
  if (!result.ok) {
    return { errors: result.errors, values: result.values };
  }

  const saved = await updateWod(wodId, result.value);
  if (!saved.ok) {
    return { formError: messageFor(saved.error), values: result.values };
  }

  redirect(listUrl(saved.wod.date));
}

// 삭제 결과 (실패했을 때만 메시지를 돌려줌. 성공하면 목록으로 이동)
export type WodDeleteState = { error: string } | undefined;

// 삭제도 수정처럼 id를 .bind로 붙여서 받고, 다시 검사합니다.
// (입력값이 없어서 이전 상태나 폼 데이터는 받지 않습니다)
export async function deleteWodAction(id: number): Promise<WodDeleteState> {
  await requireAdmin();

  const wodId = parseWodId(id);
  if (wodId === null) {
    return { error: "잘못된 요청입니다. 목록에서 다시 선택해 주세요." };
  }

  const deleted = await deleteWod(wodId);
  if (!deleted.ok) {
    switch (deleted.error.kind) {
      case "not_found":
        return { error: "이미 삭제된 WOD입니다. 목록에서 다시 확인해 주세요." };
      case "unauthorized":
        return { error: "관리자 권한이 없습니다. 다시 로그인해 주세요." };
      case "unknown":
        return { error: "삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
  }

  redirect(listUrl(deleted.date, "deleted"));
}
