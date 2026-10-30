import {
  cellAside,
  cellFigure,
  type CellTotals,
} from "@/lib/time/timesheet";

/**
 * A total: at the end of a row, under a column, or in the corner where the two
 * meet.
 *
 * One component for all three, because they are the same figure read in
 * different directions and a reader checks them against each other. Three
 * components would be three chances for the corner to format a duration
 * differently from the row totals it is the sum of.
 *
 * Not focusable, unlike the cells. A total is derived from the cells beside it
 * — there will never be anything to do to one — and putting it in the cursor's
 * path would mean an eighth press to cross a week and a stop on a cell that
 * does nothing when it gets there.
 *
 * `label` is what the figure is called when it is not being looked at, since a
 * total's whole meaning is its position. It replaces the figure for assistive
 * technology rather than adding to it, because the sentence already contains
 * the number.
 */
export function TotalCell({
  total,
  label,
  className = "",
}: {
  total: CellTotals;
  /** The whole figure as a sentence: which row or column, and what it came to. */
  label: string;
  className?: string;
}) {
  const aside = cellAside(total);

  return (
    <td
      className={`py-2.5 pr-4 text-right align-top tabular-nums last:pr-0 ${className}`}
    >
      <span aria-hidden="true">{cellFigure(total)}</span>
      <span className="sr-only">{label}</span>
      {aside !== null && (
        <span
          aria-hidden="true"
          className="block text-xs font-normal text-zinc-500 dark:text-zinc-400"
        >
          {aside}
        </span>
      )}
    </td>
  );
}
