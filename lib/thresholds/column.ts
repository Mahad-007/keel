import type { ThresholdOverrides } from "./resolve";
import {
  THRESHOLD_KEYS,
  THRESHOLD_SETTINGS,
  type ThresholdKey,
} from "./settings";

/**
 * The guard a threshold passes on its way into a column, and the question it
 * answers without throwing.
 *
 * The arrangement every number in `lib/data/fields.ts` is written in, and for
 * the same reason: by the time a value reaches the data layer a form has
 * already turned mistakes into messages, so anything out of range here is a
 * programming error and should be loud. The predicate is the condition the
 * guard throws on, so code asking *before* a write — a duplicate carrying a
 * stored setting over, say — cannot be refused by the column it just asked
 * about.
 *
 * Here rather than in `lib/data/fields.ts` because the range is the spec's and
 * not the column's: every setting has a different one, and a guard that took
 * its bounds as arguments would be a guard each caller could get wrong. The
 * data layer passes the key and this reads the bounds off the same record the
 * form validates against.
 */

/**
 * Whether a figure could be stored as this setting: whole, and inside the
 * spec's bounds.
 *
 * Both halves in one predicate, because nothing asking the question cares
 * which it failed — a threshold of 400% and one of 82.5% are equally
 * unwritable, and either way the answer is that somebody has to open the form
 * and correct it.
 *
 * Safely whole rather than merely integral, like every other number guard in
 * this repo: past 2^53 SQLite takes the write and the driver then fails
 * decoding it back, poisoning every later read of the table. No threshold
 * range reaches anywhere near it, so this is the half of the check that can
 * never fire — and it costs nothing to be the kind of guard that could not be
 * got round.
 */
export function isThresholdValue(key: ThresholdKey, value: number): boolean {
  const { min, max } = THRESHOLD_SETTINGS[key];
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * A nullable threshold column, where NULL is the answer that means "not set
 * here".
 *
 * Absent and null are the same answer, as they are for `optionalCents`: the
 * resolution chain reads either as a row with nothing to say, and a patch that
 * leaves a setting out has not thereby cleared it. Only an explicit null
 * clears a column, which is what makes "inherit from my client again" a thing
 * a form can express.
 *
 * The message names the setting as the form names it and quotes the bounds,
 * because the two readers of a thrown error here are a developer and a log: a
 * message saying "pace_shift_percent out of range" sends neither of them to
 * the field somebody typed into.
 */
export function thresholdColumn(
  key: ThresholdKey,
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null) return null;
  if (!isThresholdValue(key, value)) {
    const { label, min, max } = THRESHOLD_SETTINGS[key];
    throw new Error(
      `${label} must be a whole number between ${min} and ${max}, got ${value}`,
    );
  }
  return value;
}

/**
 * The threshold columns one write sets: the keys that were mentioned, mapped to
 * what the column will hold.
 *
 * Mutable and partial, unlike `ThresholdOverrides`, because it is the object a
 * data-layer function hands to Drizzle: built a key at a time and then spread
 * into the values of an insert or the set of an update.
 */
export type ThresholdColumns = {
  [K in ThresholdKey]?: number | null;
};

/**
 * The threshold columns a write should set, guarded, with the ones nobody
 * mentioned left out.
 *
 * Both halves of that matter, and together they are why one function serves an
 * insert and an update alike:
 *
 *   - **Guarded.** Every figure goes through `thresholdColumn`, so a value out
 *     of range throws at the boundary rather than landing in a row that then
 *     classifies a project at a threshold no form shows.
 *   - **Omitted when absent.** A key that is not present is not written, which
 *     on an insert leaves the column NULL — the "not set here" the chain reads
 *     — and on a patch leaves whatever was there alone. An explicit null is a
 *     different instruction and is kept: it clears the column, which is how a
 *     project says "inherit from my client again".
 *
 * Driven off `THRESHOLD_KEYS`, so a sixth setting is written by every caller
 * the day it is added to the spec. The alternative is five `if (x !==
 * undefined)` blocks per table, which is ten places to forget it.
 */
export function thresholdColumns(
  overrides: ThresholdOverrides,
): ThresholdColumns {
  const columns: Record<string, number | null> = {};
  for (const key of THRESHOLD_KEYS) {
    if (overrides[key] === undefined) continue;
    columns[key] = thresholdColumn(key, overrides[key]);
  }
  return columns;
}

/**
 * Whether every threshold a row holds could be written again.
 *
 * The question a copy asks before it writes. `thresholdColumns` throws, which
 * is right at the boundary of a form-checked write and wrong here: duplicating
 * a project reads a stored row, and a row somebody hand-edited to a threshold
 * of 400% is a situation to report rather than a bug to crash on. The pair is
 * the arrangement `isWholeCents` and `wholeCents` keep, for exactly this
 * caller.
 *
 * NULL passes, because NULL is a meaning rather than a missing value: a
 * project with no override is judged by its client, and so should its copy be.
 *
 * One answer for the whole row rather than one per setting, because nothing
 * asking can act on which of the five is at fault — the reader's next move is
 * to open the settings and correct them, and that is one sentence whichever
 * column it was.
 */
export function hasUsableThresholds(row: ThresholdOverrides): boolean {
  return THRESHOLD_KEYS.every((key) => {
    const value = row[key];
    return value === undefined || value === null || isThresholdValue(key, value);
  });
}

/**
 * The settings that moved between a stored row and what a form submitted.
 *
 * An edit form's patch, as small as it can honestly be. The data layer writes
 * nothing for an empty patch, which is what keeps Save on an untouched form
 * from bumping `updatedAt` and jumping a project to the top of a list sorted by
 * it — and a patch that always carried all five would defeat that for every
 * project on the books, since most of them have five NULLs nobody has touched.
 *
 * Absent and null are the same figure on both sides, because they mean the same
 * thing to the chain: a row that holds no setting and a box that was left empty
 * are both "inherit", and the day they are compared as different values is the
 * day every save writes five columns to no effect.
 *
 * A setting that moved is carried even when it moved *to* null, which is the
 * half that matters. Clearing a box is an instruction — judge this project by
 * its client again — and an omitted key would leave the old figure in the row
 * while the form that submitted the clearance redirected as though it had
 * worked.
 */
export function movedThresholds(
  current: ThresholdOverrides,
  submitted: ThresholdOverrides,
): ThresholdColumns {
  const moved: ThresholdColumns = {};
  for (const key of THRESHOLD_KEYS) {
    const before = current[key] ?? null;
    const after = submitted[key] ?? null;
    if (before !== after) moved[key] = after;
  }
  return moved;
}
