import { isCalendarDate } from "@/lib/dates";

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
 * Whether a value would satisfy `wholeCents`, as an answer rather than an
 * exception — the same arrangement as `isPresentText` and `isWholeMinutes`,
 * and for the same kind of caller: code asking, before it writes, whether a
 * stored amount can be written again.
 *
 * Both halves of the guard in one predicate, because nothing asking the
 * question cares which half a stored amount failed. A contract value of minus
 * one and one of 1.5 cents are equally unwritable, and either way the fix is
 * the same — open the project and correct the amount.
 */
export function isWholeCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Whether a nullable money column's value would satisfy `optionalCents`.
 *
 * Absent passes, because absent is a meaning rather than a missing value: a
 * project with no rate override bills at its client's rate, and a copy of it
 * should too.
 *
 * `undefined` is accepted alongside `null` for the single reason this pair
 * exists: the predicate has to take what the guard takes and answer what the
 * guard decides. `optionalCents` treats the two the same, so a predicate that
 * refused one of them would be a second opinion about the column rather than
 * a reading of it — which is the drift the pair is meant to make impossible.
 */
export function isOptionalWholeCents(
  value: number | null | undefined,
): boolean {
  return value === undefined || value === null || isWholeCents(value);
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

/**
 * A duration column that records what another column held, rather than
 * accepting a new one.
 *
 * `wholeMinutes` refuses a negative, because nothing in the app should ever
 * write one. A scope snapshot is the exception that proves the rule: it copies
 * a deliverable's estimate as it stood, and a row somebody hand-edited to
 * minus two hours is exactly the row a reader needs the snapshot to have
 * recorded. Refusing it would make the one project with a bad line the one
 * project that cannot be compared.
 *
 * The safe-integer half of the guard stays, and for the reason it exists:
 * past 2^53 SQLite accepts the write and the driver then fails decoding it
 * back, leaving a row that poisons every later read of the table. A record of
 * an unreadable number is not worth a table nobody can read.
 */
export function recordedMinutes(value: number, field: string): number {
  // Through the predicate rather than a second `isSafeInteger` written here.
  // The pair exists so the two cannot drift, which two spellings of one rule
  // would undo — and the predicate is declared below because a caller asks it
  // before the write, where this throws during one.
  if (!isRecordableMinutes(value)) {
    throw new Error(`${field} must be whole minutes, got ${value}`);
  }
  return value;
}

/**
 * Whether a duration could be recorded by `recordedMinutes`, as an answer
 * rather than an exception — the same arrangement as `isWholeMinutes`, and
 * for the same kind of caller: code asking, before it writes, whether a stored
 * value can be written again.
 */
export function isRecordableMinutes(value: number): boolean {
  return Number.isSafeInteger(value);
}

/**
 * A column that holds a day rather than a moment: `2026-10-16`, with no time
 * of day on it.
 *
 * Trims first, like `requiredText`, so a date with a stray space around it
 * stores as the date. A timestamp is refused rather than truncated to its
 * first ten characters: the stored string is UTC, so truncating one written at
 * 23:00 would file the work under a day its author did not work it, and the
 * caller is the only thing that knows which day they meant.
 */
export function calendarDate(value: string, field: string): string {
  const trimmed = value.trim();
  if (!isCalendarDate(trimmed)) {
    throw new Error(`${field} must be a calendar date, got ${value}`);
  }
  return trimmed;
}

/**
 * A duration column that records work done rather than work estimated: whole
 * minutes, never negative, and never zero.
 *
 * `wholeMinutes` allows zero because an estimate of zero is an honest
 * statement that nobody has sized the thing yet, which the scope summaries
 * flag. A stretch of work of zero minutes is not the same kind of value: it
 * records nothing that happened, totals as nothing, and is a row every later
 * reading of the table has to skip. Refused at the column, so no rollup has to
 * decide what it meant.
 */
export function positiveMinutes(value: number, field: string): number {
  const minutes = wholeMinutes(value, field);
  if (minutes === 0) throw new Error(`${field} cannot be zero`);
  return minutes;
}
