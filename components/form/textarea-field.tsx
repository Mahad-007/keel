import { controlAttributes } from "./control";
import { Field } from "./field";

/**
 * The multi-line equivalent of `TextField`, for the fields someone writes a
 * paragraph into rather than a value.
 *
 * `rows` sets the box's resting height, not a limit: a textarea that starts
 * one line tall reads as an input and invites one line of text, which is not
 * what a notes field is for.
 */
export type TextAreaFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
  /**
   * Which of several forms on the page this field belongs to, so two forms
   * asking for the same thing do not render two controls with one id. Omitted
   * on a page with one form — see `fieldId`.
   */
  scope?: string;
};

export function TextAreaField({
  name,
  label,
  hint,
  error,
  defaultValue,
  rows = 4,
  maxLength,
  scope,
}: TextAreaFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error} scope={scope}>
      {(description) => (
        <textarea
          {...controlAttributes(description)}
          name={name}
          autoComplete="off"
          rows={rows}
          maxLength={maxLength}
          defaultValue={defaultValue}
        />
      )}
    </Field>
  );
}
