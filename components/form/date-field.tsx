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
 * them would be offering props that silently do nothing. It has no bounds
 * either. A `max` of today looks obvious and is a trap in a server-rendered
 * form — today is the browser's, so the attribute would have to be written
 * after mount, and a page left open overnight would then refuse the day it is
 * now. A date that looks implausible is better questioned than prevented.
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
          defaultValue={defaultValue}
        />
      )}
    </Field>
  );
}
