import { controlAttributes } from "./control";
import { Field } from "./field";

/**
 * A day, with its label, hint and error already wired up.
 *
 * A native date input rather than three selects or a text box. The browser
 * knows the reader's locale, so it renders the day in whatever order they read
 * dates in and still submits `YYYY-MM-DD` — which is exactly what the columns
 * holding a calendar date want, and the one format a text box would have to
 * teach somebody to type.
 *
 * It has no `placeholder` and no `maxLength`, which is why it is not
 * `TextField` with another `type`: a date input shows neither, and offering
 * them would be offering props that silently do nothing. What it has instead
 * is `max`, because the dates a form wants are usually bounded on one side —
 * work cannot have been done tomorrow.
 *
 * `autoComplete` is off for the reason it is off everywhere here: what the
 * browser has stored under a date is the user's own birthday or card expiry,
 * and neither is the day anything in this app happened on.
 */
export type DateFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** `YYYY-MM-DD`. Blank leaves the input empty. */
  defaultValue?: string;
  /** The earliest day the input offers, as `YYYY-MM-DD`. */
  min?: string;
  /** The latest day the input offers, as `YYYY-MM-DD`. */
  max?: string;
  /**
   * Which of several forms on the page this field belongs to, so two forms
   * asking for the same thing do not render two controls with one id. Omitted
   * on a page with one form — see `fieldId`.
   */
  scope?: string;
};

export function DateField({
  name,
  label,
  hint,
  error,
  defaultValue,
  min,
  max,
  scope,
}: DateFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error} scope={scope}>
      {(description) => (
        <input
          {...controlAttributes(description)}
          name={name}
          type="date"
          autoComplete="off"
          min={min}
          max={max}
          defaultValue={defaultValue}
        />
      )}
    </Field>
  );
}
