import { controlAttributes } from "./control";
import { Field } from "./field";

/**
 * A picker with its label, hint and error already wired up — the third
 * control, after the input and the textarea, and the first one whose value
 * has to come from a set the form decides.
 *
 * One option per line, and the line is all there is: a `<select>` collapses to
 * its selected option, so whatever distinguishes two options has to be in the
 * text. Working out that text is the caller's job, not this component's.
 */
export type SelectOption = {
  readonly value: string;
  readonly label: string;
};

export type SelectFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Blank, or absent, leaves the placeholder showing. */
  defaultValue?: string;
  options: readonly SelectOption[];
  /**
   * The first line, standing for "nothing picked yet". It submits an empty
   * value, so a form the user skipped comes back as a required-field message
   * rather than as whatever option happened to sort first — the difference
   * between a project filed under nobody and a project filed under the wrong
   * client without anyone saying so.
   */
  placeholder?: string;
};

export function SelectField({
  name,
  label,
  hint,
  error,
  defaultValue,
  options,
  placeholder,
}: SelectFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {(description) => (
        <select
          {...controlAttributes(description)}
          name={name}
          autoComplete="off"
          defaultValue={defaultValue ?? ""}
        >
          {placeholder === undefined ? null : (
            <option value="">{placeholder}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
