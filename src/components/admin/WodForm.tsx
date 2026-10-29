// Program 등록/수정 폼 (두 화면이 같이 씁니다)
// 제출 중 표시, 칸별 에러 표시가 필요해서 브라우저에서 실행되는 컴포넌트로 만듭니다.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { WodFormState } from "@/app/admin/programs/actions";
import { wodTypeStyles } from "@/components/wod/wodTypeStyles";
import { wodTypeLabels, wodTypes } from "@/data/wods";
import { WOD_LIMITS, type WodFormValues } from "@/lib/wods/validation";

type WodFormProps = {
  // 제출하면 실행할 서버 함수 (등록: createWodAction, 수정: updateWodAction.bind(null, id))
  action: (prev: WodFormState, formData: FormData) => Promise<WodFormState>;
  initialValues: WodFormValues;
  submitLabel: string;
  cancelHref: string;
};

const inputClass =
  "w-full rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none aria-[invalid=true]:border-accent";

export default function WodForm({ action, initialValues, submitLabel, cancelHref }: WodFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  // 에러로 돌아왔으면 방금 입력한 값, 처음이면 초기값
  const values = state?.values ?? initialValues;
  const errors = state?.errors ?? {};

  return (
    // noValidate를 붙이지 않아서 브라우저 기본 검사(required 등)도 함께 동작합니다.
    // 브라우저 검사는 편의 기능일 뿐이고, 실제 검사는 서버(validation.ts)에서 다시 합니다.
    <form action={formAction} className="space-y-6">
      {/* 폼 전체 에러 (중복, 권한 등) */}
      {state?.formError && (
        <p role="alert" className="rounded-md bg-accent-soft px-4 py-3 text-sm font-bold text-accent">
          {state.formError}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="날짜" htmlFor="date" error={errors.date}>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={values.date}
            aria-invalid={Boolean(errors.date)}
            className={inputClass}
          />
        </Field>

        {/* 종류: 라디오 버튼 (fieldset + legend = 묶음 이름을 화면 낭독기에 알려 줌) */}
        <fieldset>
          <legend className="mb-1 block text-sm font-bold">종류</legend>
          <div className="flex flex-wrap gap-2">
            {wodTypes.map((type) => (
              <label key={type} className="cursor-pointer">
                {/* peer = 옆의 span이 이 라디오의 선택 상태에 따라 모양을 바꿀 수 있게 하는 표시 */}
                <input
                  type="radio"
                  name="type"
                  value={type}
                  required
                  defaultChecked={values.type === type}
                  className="peer sr-only"
                />
                <span
                  className={`inline-block rounded-md border border-line px-3 py-2 text-sm font-bold peer-checked:border-transparent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${wodTypeStyles[type].checked}`}
                >
                  {wodTypeLabels[type]}
                </span>
              </label>
            ))}
          </div>
          {errors.type && <p className="mt-1 text-sm text-accent">{errors.type}</p>}
        </fieldset>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Program 이름" htmlFor="title" error={errors.title}>
          <input
            id="title"
            name="title"
            required
            maxLength={WOD_LIMITS.title}
            placeholder="예: Fran"
            defaultValue={values.title}
            aria-invalid={Boolean(errors.title)}
            className={inputClass}
          />
        </Field>

        <Field label="진행 방식" htmlFor="format" error={errors.format}>
          <input
            id="format"
            name="format"
            required
            maxLength={WOD_LIMITS.format}
            placeholder="예: For Time (21-15-9), AMRAP 20min"
            defaultValue={values.format}
            aria-invalid={Boolean(errors.format)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="동작 (한 줄에 하나씩)" htmlFor="movements" error={errors.movements}>
        <textarea
          id="movements"
          name="movements"
          required
          rows={6}
          placeholder={"Thruster (43/30kg)\nPull-up"}
          defaultValue={values.movements}
          aria-invalid={Boolean(errors.movements)}
          className={inputClass}
        />
      </Field>

      <Field label="코치 메모 (선택)" htmlFor="note" error={errors.note}>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={WOD_LIMITS.note}
          placeholder="스케일 옵션, 목표 기록 등"
          defaultValue={values.note}
          aria-invalid={Boolean(errors.note)}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-6 py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
        <Link href={cancelHref} className="rounded-md border border-line px-6 py-3 font-bold hover:bg-surface">
          취소
        </Link>
      </div>
    </form>
  );
}

// 칸 이름 + 입력칸 + 에러 메시지를 묶은 작은 컴포넌트
function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-bold">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-accent">{error}</p>}
    </div>
  );
}
