import type { FocusEvent, KeyboardEvent } from "react";

import {
  cellAside,
  cellFigure,
  isWorked,
  type TimesheetCell,
  type TimesheetProject,
} from "@/lib/time/timesheet";
import { isWeekend } from "@/lib/time/week";

import { CellBox } from "./cell-box";

/**
 * One cell of the grid: what a project came to on one day, and a box for
 * adding to it.
 *
 * Two things in one cell, stacked, and the order is deliberate. The figure is
 * the answer — what the day already came to — and the box underneath is what
 * changes it, so a reader's eye meets what is true before what they are about
 * to do about it.
 *
 * The tab stop is inside the box rather than on this cell. Day 026 put it
 * here, when there was nothing to type into and the cursor was for reading;
 * now that a cell holds an editor, a `<td>` that took the focus would leave a
 * reader pressing Tab again to get into the input, forty times across a week.
 *
 * The figure is hidden from assistive technology and the box's own label
 * carries it instead. A `<td>` that focus lands on is announced as its
 * contents, but focus lands on the input now, and an input is announced by its
 * label — so the sentence naming the project, the day and the figure belongs
 * there. Rendering it here as well would read the cell out twice.
 *
 * Hiding the figure also takes care of the dash in an empty cell, which a
 * screen reader reads as "dash": a punctuation mark rather than an answer.
 */
export function SheetCell({
  project,
  cell,
  value,
  error,
  isCursor,
  onFocus,
  onKeyDown,
}: {
  project: TimesheetProject;
  cell: TimesheetCell;
  /** What is in the cell's box: blank, or what was typed into a refused sheet. */
  value: string;
  /** Why this cell was refused, or null if it was not. */
  error: string | null;
  /** Whether this is the cell the cursor is on, and so the grid's tab stop. */
  isCursor: boolean;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const worked = isWorked(cell);
  const aside = cellAside(cell);

  return (
    <td className="py-2.5 pr-4 align-top last:pr-0">
      <span
        aria-hidden="true"
        className={`block text-right tabular-nums ${
          worked
            ? "text-zinc-900 dark:text-zinc-100"
            : isWeekend(cell.workedOn)
              ? "text-zinc-300 dark:text-zinc-700"
              : "text-zinc-400 dark:text-zinc-600"
        }`}
      >
        {cellFigure(cell)}
      </span>
      {/*
        Under the figure and in smaller type, on the rare cell that has
        something to add. Most cells are one entry that will be invoiced, and a
        note on every one of them would be a second column of text inside each
        of seven columns. Hidden rather than read, because the box's own label
        already carries both of these facts.
      */}
      {aside !== null && (
        <span
          aria-hidden="true"
          className="block text-right text-xs font-normal text-zinc-500 dark:text-zinc-400"
        >
          {aside}
        </span>
      )}
      <div className="mt-1.5">
        <CellBox
          project={project}
          cell={cell}
          value={value}
          error={error}
          isCursor={isCursor}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
      </div>
    </td>
  );
}
