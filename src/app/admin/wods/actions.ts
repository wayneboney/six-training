// WOD 등록/수정 Server Action (Spring의 @PostMapping 컨트롤러 역할)
// 순서: ① 권한 확인 → ② 입력값 검증 → ③ 저장 → ④ 목록으로 이동
// 액션은 얇게 유지하고, 실제 저장과 권한 확인은 admin-repository.ts에 둡니다.
"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createWod, updateWod, type WodSaveError } from "@/lib/wods/admin-repository";
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

// 저장 후 돌아갈 목록 주소: 저장한 WOD의 달 + 저장 완료 표시
function listUrl(date: string): string {
  return `/admin?month=${date.slice(0, 7)}&saved=1`;
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
