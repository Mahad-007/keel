/**
 * Comparing a scope snapshot against the scope list as it reads now.
 *
 * The deliverables table only ever holds what is agreed today, which is why
 * "that was not in the original scope" is a conversation nobody can win: the
 * list has already been edited. A snapshot supplies the other side, and this
 * file is the arithmetic between them — every line added since, every line
 * dropped, every estimate and title that moved, and what the totals did.
 *
 * Pure functions over plain fields, like `lib/scope.ts`: no row is read here,
 * nothing is formatted, and nothing knows what a page looks like. The
 * sentences a reader sees are `lib/snapshots/describe.ts`.
 *
 * Two things are deliberately **not** compared:
 *
 *   - **Position.** A reorder is not a change to what was promised, only to
 *     the order it is read in — and positions move on their own, because
 *     deleting a line renumbers the ones after it. Reporting that would fill
 *     the table with rows nobody touched.
 *   - **Timestamps.** `updatedAt` moves when a line is edited, which is
 *     exactly what the field comparisons already say, and it moves on a line
 *     whose edit put the old value back.
 */

/**
 * What a comparison can say about one line of scope.
 *
 * Four kinds, and `changed` is the one the day exists for: a deliverable that
 * is in both lists under the same id but says something different now. The
 * other three are the ones a diff is usually assumed to be — gained, lost,
 * untouched.
 *
 * `unchanged` is a kind rather than an absence because the rows have to be
 * countable: "nine of twelve lines are exactly as agreed" is the sentence that
 * makes the other three readable, and a comparison that dropped them could
 * only say how many things were wrong.
 *
 * The order is the order they are worth reading in, which is also the order a
 * table groups them under: what is new, what is gone, what moved, what stood
 * still.
 */
export const SCOPE_CHANGE_KINDS = [
  "added",
  "removed",
  "changed",
  "unchanged",
] as const;

export type ScopeChangeKind = (typeof SCOPE_CHANGE_KINDS)[number];
