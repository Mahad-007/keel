/**
 * The validators the data layer applies on the way into a column. They throw
 * rather than returning a result: by the time a value reaches `lib/data/`, a
 * form has already checked it and turned mistakes into messages, so anything
 * wrong here is a programming error and should be loud.
 *
 * `lib/forms/` is the other half of this — same rules, but phrased for a
 * person and collected into field errors instead of thrown.
 */

/**
 * Whether a value would satisfy `requiredText`, as an answer rather than an
 * exception.
 *
 * The guards here throw because a bad value reaching them is a bug. That is
 * the wrong shape for code asking *before* the write whether a stored row
 * could be written again — copying a project's scope list, say, where a row
 * somebody hand-edited is a situation to report rather than a bug to crash
 * on. The predicate is the condition the guard throws on, so the two cannot
 * drift: a caller that checks this and then writes cannot be refused by the
 * column it just asked about.
 */
export function isPresentText(value: string): boolean {
  return value.trim() !== "";
}

/**
 * A column that must hold something. Trims first, so a value of only spaces
 * counts as absent rather than being stored as whitespace.
 */
export function requiredText(value: string, field: string): string {
  if (!isPresentText(value)) throw new Error(`${field} is required`);
  return value.trim();
}

/**
 * A nullable column. Absent, null, and blank all collapse to NULL, so that
 * "no value" has exactly one representation in the database and a query for it
 * does not have to test for `''` as well.
 */
export function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A money column: whole cents, never negative. Fractional cents mean a float
 * got into a currency value somewhere upstream, which is worth stopping at the
 * column rather than discovering in an invoice total.
 *
 * "Whole" means safely whole: past 2^53 an integer is no longer exact, and such
 * a value is written to SQLite before the driver fails decoding it back, leaving
 * a row that every later read of the table throws on. The guard is the only
 * place that can catch it, so it catches the whole range and not just fractions.
 */
export function wholeCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be whole cents, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${field} cannot be negative, got ${value}`);
  }
  return value;
}

/**
 * A nullable money column, for an amount that has a meaning when absent —
 * a project's rate override, where NULL is "use the client's default" and 0 is
 * the deliberate choice to bill nothing. The two are not the same, so a blank
 * override must not collapse to zero the way blank text collapses to NULL.
 */
export function optionalCents(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  return wholeCents(value, field);
}

/**
 * A duration column: whole minutes, never negative. Minutes are the repo's
 * unit of time everywhere, so a fractional value means somebody divided hours
 * somewhere upstream and the remainder is about to be rounded away silently.
 *
 * Safely whole for the same reason as `wholeCents`: past 2^53 the integer is
 * no longer exact, and SQLite accepts the write before the driver fails
 * decoding it back, leaving a row that poisons every later read of the table.
 */
export function wholeMinutes(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be whole minutes, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${field} cannot be negative, got ${value}`);
  }
  return value;
}

/**
 * Whether a value would satisfy `wholeMinutes`, as an answer rather than an
 * exception — the same arrangement as `isPresentText`, and for the same
 * caller.
 *
 * Both halves of the guard in one predicate, because nothing asking the
 * question cares which half a bad row failed: a duration that is fractional
 * and one that is negative are equally unwritable, and the sentence shown for
 * either names the row rather than the rule.
 */
export function isWholeMinutes(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
