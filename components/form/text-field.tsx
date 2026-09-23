import { controlAttributes } from "./control";
import { Field } from "./field";

/**
 * A single-line input with its label, hint and error already wired up.
 *
 * `autoComplete` defaults to `off` because the forms in this app describe
 * somebody other than the person filling them in: what the browser has stored
 * under `name` or `email` is the user's own, and offering it here is wrong by
 * construction.
 *
 * `maxLength` is not optional in spirit — every stored string has a ceiling in
 * the validator, and the input should stop at the same number rather than let
 * someone type past a limit they will only hear about after submitting.
 */
export type TextFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  type?: "text" | "email";
  inputMode?: "text" | "email" | "decimal";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
};

export function TextField({
  name,
  label,
  hint,
  error,
  defaultValue,
  type = "text",
  inputMode,
  autoComplete = "off",
  placeholder,
  maxLength,
}: TextFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {(description) => (
        <input
          {...controlAttributes(description)}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          defaultValue={defaultValue}
        />
      )}
    </Field>
  );
}
