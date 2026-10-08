import type { ScopeFigure } from "@/lib/projects/scope-summary";

/**
 * One line of the scope summary: what it is called, what it says, and how to
 * read it.
 *
 * A definition list for the same reason the overview tab uses one — these are
 * one project's figures, not a set of rows to compare — and the label column
 * is wide enough for "Implied hourly rate" so that the four values line up
 * down a single edge. A reader comparing the delivered figure with the one
 * still to do is comparing two numbers an inch apart, and an indent that moved
 * per row would make them hunt.
 *
 * The note sits under the value rather than beside it, in secondary text. It
 * is a sentence where the value is a figure, and a sentence in the right-hand
 * column of a two-column grid ends up a tall narrow block beside a short one.
 *
 * `tabular-nums` on the value, so the digits in a column of durations and
 * money line up even though none of these rows is the same kind of quantity.
 */
export function SummaryFigure({ label, value, note }: ScopeFigure) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 border-b border-zinc-100 py-2.5 sm:grid-cols-[11rem_1fr] dark:border-zinc-900">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd>
        <p className="tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
        {note === null ? null : (
          <p className="mt-0.5 max-w-prose leading-6 text-zinc-500 dark:text-zinc-400">
            {note}
          </p>
        )}
      </dd>
    </div>
  );
}
