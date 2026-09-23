import type { ReactNode } from "react";

import { describeField, type FieldDescription } from "./describe";
import { FieldError } from "./field-error";
import { FieldHint } from "./field-hint";

/**
 * A label above a control, and the accessible wiring between them.
 *
 * Every field on every form in this app goes through here, which is the point:
 * a label that is merely next to an input is not a label, and getting that
 * wrong once per form is how a form ends up unusable from the keyboard.
 *
 * The control is a render prop rather than plain children because the shell
 * has to hand it the ids it just derived — an input, a textarea, or a select
 * this file has never heard of can all be wired the same way.
 */
export type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: (description: FieldDescription) => ReactNode;
};

export function Field({ name, label, hint, error, children }: FieldProps) {
  const description = describeField({ name, hint, error });

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={description.id}
        className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        {label}
      </label>
      {children(description)}
      {description.error === null ? null : (
        <FieldError id={description.error.id}>
          {description.error.text}
        </FieldError>
      )}
      {description.hint === null ? null : (
        <FieldHint id={description.hint.id}>{description.hint.text}</FieldHint>
      )}
    </div>
  );
}
