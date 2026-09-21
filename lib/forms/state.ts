import type { FieldErrors } from "./result";

/**
 * What a server action hands back to a form that failed, and what the form
 * renders from. Three parts, each doing a distinct job:
 *
 *   - `fields`: what the user typed, echoed back. A rejected submission that
 *     clears the form is the fastest way to lose someone's work.
 *   - `errors`: one message per bad field, rendered beside that field.
 *   - `formError`: a problem with the submission as a whole — the database was
 *     unreachable — that belongs to no single input.
 *
 * A successful submission never produces one of these: the action redirects.
 */
export type FormState<K extends string> = {
  readonly fields: Record<K, string>;
  readonly errors: FieldErrors<K>;
  readonly formError: string | null;
};

/** An untouched form: the blank (or prefilled) fields, nothing wrong yet. */
export function initialFormState<K extends string>(
  fields: Record<K, string>,
): FormState<K> {
  return { fields, errors: {}, formError: null };
}

/** Validation rejected the submission. Nothing was written. */
export function rejectedFormState<K extends string>(
  fields: Record<K, string>,
  errors: FieldErrors<K>,
): FormState<K> {
  return { fields, errors, formError: null };
}

/** The submission was valid but could not be saved. */
export function failedFormState<K extends string>(
  fields: Record<K, string>,
  formError: string,
): FormState<K> {
  return { fields, errors: {}, formError };
}

export function fieldErrorCount<K extends string>(state: FormState<K>): number {
  return Object.keys(state.errors).length;
}

export function hasErrors<K extends string>(state: FormState<K>): boolean {
  return state.formError !== null || fieldErrorCount(state) > 0;
}

/**
 * The first field with an error, in the order the form lays them out rather
 * than the order the errors happen to be keyed in. That ordering is the whole
 * point: it is what lets the form move the cursor to the problem the user
 * will reach first.
 */
export function firstErrorField<K extends string>(
  state: FormState<K>,
  order: readonly K[],
): K | null {
  for (const name of order) {
    if (state.errors[name] !== undefined) return name;
  }
  return null;
}

/**
 * One sentence at the top of the form saying what happened, because the
 * field that failed may be scrolled off the screen. Null when there is
 * nothing to say, so the form renders no empty banner.
 */
export function formSummary<K extends string>(state: FormState<K>): string | null {
  if (state.formError !== null) return state.formError;

  const count = fieldErrorCount(state);
  if (count === 0) return null;
  if (count === 1) return "Nothing was saved. One field needs fixing.";
  return `Nothing was saved. ${count} fields need fixing.`;
}
