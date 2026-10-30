import type { FocusEvent, KeyboardEvent } from "react";

import { cellDomId } from "@/lib/time/grid";
import {
  cellAside,
  cellFigure,
  describeCell,
  isWorked,
  NOTHING_LOGGED,
  NOTHING_LOGGED_LABEL,
  type TimesheetCell,
  type TimesheetProject,
} from "@/lib/time/timesheet";
import { isWeekend } from "@/lib/time/week";

/**
 * One cell of the grid: what a project came to on one day.
 *
 * Focusable, and the whole point of the day. A table of forty cells reached by
 * Tab is thirty-nine presses from Monday on the first row to Monday on the
 * second, so the grid keeps one tab stop and the arrows move between cells
 * inside it — which means exactly one cell carries a usable tab index at a
 * time and the rest are reachable only from it.
 *
 * The focus ring is on the cell itself rather than on something inside it.
 * There is nothing inside it yet: Day 027 puts an input here, and the cursor
 * arriving at the right box is the same cursor arriving at the right cell.
 *
 * The dash in an empty cell is hidden from assistive technology and replaced
 * with words. "Dash" is what a screen reader says for it, which is a
 * punctuation mark rather than an answer.
 */
export function SheetCell({
  project,
  cell,
  isCursor,
  onFocus,
  onKeyDown,
}: {
  project: TimesheetProject;
  cell: TimesheetCell;
  /** Whether this is the cell the cursor is on, and so the grid's tab stop. */
  isCursor: boolean;
  onFocus: (event: FocusEvent<HTMLTableCellElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => void;
}) {
  const worked = isWorked(cell);
  const aside = cellAside(cell);

  return (
    <td
      id={cellDomId(project.id, cell.workedOn)}
      tabIndex={isCursor ? 0 : -1}
      title={describeCell(project, cell)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={`py-2.5 pr-4 text-right align-top tabular-nums last:pr-0 focus:outline-2 focus:outline-offset-2 focus:outline-zinc-900 dark:focus:outline-zinc-100 ${
        worked
          ? "text-zinc-900 dark:text-zinc-100"
          : isWeekend(cell.workedOn)
            ? "text-zinc-300 dark:text-zinc-700"
            : "text-zinc-400 dark:text-zinc-600"
      }`}
    >
      {worked ? (
        cellFigure(cell)
      ) : (
        <>
          <span aria-hidden="true">{NOTHING_LOGGED}</span>
          <span className="sr-only">{NOTHING_LOGGED_LABEL}</span>
        </>
      )}
      {/*
        Under the figure and in smaller type, on the rare cell that has
        something to add. Most cells are one entry that will be invoiced, and a
        note on every one of them would be a second column of text inside each
        of seven columns.
      */}
      {aside !== null && (
        <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {aside}
        </span>
      )}
    </td>
  );
}
