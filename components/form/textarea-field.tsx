import { controlClassName } from "./control";
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
};

export function TextAreaField({
  name,
  label,
  hint,
  error,
  defaultValue,
  rows = 4,
  maxLength,
}: TextAreaFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          name={name}
          autoComplete="off"
          rows={rows}
          maxLength={maxLength}
          defaultValue={defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClassName(invalid)}
        />
      )}
    </Field>
  );
}
