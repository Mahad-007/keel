/**
 * The shape every form validator in the codebase speaks.
 *
 * A field either yields a clean value or a message written for the person who
 * typed it — never an exception. Throwing on the first bad field would show
 * one error at a time and make the user resubmit to discover the next one;
 * `collect` instead runs every field and reports all of them together.
 */

export type FieldResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

export function valid<T>(value: T): FieldResult<T> {
  return { ok: true, value };
}

export function invalid<T>(message: string): FieldResult<T> {
  return { ok: false, message };
}

/** One message per bad field, keyed by the field's form name. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ParseResult<T, K extends string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: FieldErrors<K> };

type FieldResults = Record<string, FieldResult<unknown>>;

type ValuesOf<F extends FieldResults> = {
  [K in keyof F]: F[K] extends FieldResult<infer T> ? T : never;
};

/**
 * Turns an object of per-field results into one result for the whole form.
 * Every field is evaluated, so a submission with three problems comes back
 * with three messages.
 */
export function collect<F extends FieldResults>(
  fields: F,
): ParseResult<ValuesOf<F>, Extract<keyof F, string>> {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [name, result] of Object.entries(fields)) {
    if (result.ok) {
      values[name] = result.value;
    } else {
      errors[name] = result.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as FieldErrors<Extract<keyof F, string>> };
  }
  return { ok: true, value: values as ValuesOf<F> };
}
