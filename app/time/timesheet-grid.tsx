"use client";

import { useState, type KeyboardEvent } from "react";

import {
  cellDomId,
  clampToGrid,
  GRID_KEYBOARD_HINT,
  isSameCell,
  moveInGrid,
  type GridPosition,
} from "@/lib/time/grid";
import {
  describeColumnTotal,
  describeRowTotal,
  describeSheetTotal,
  SHEET_COLUMNS,
  SHEET_TOTAL_ROW,
  sheetSize,
  startingCursor,
  type Timesheet,
} from "@/lib/time/timesheet";

import { DayHeading } from "./day-heading";
import { ProjectHeading } from "./project-heading";
import { SheetCell } from "./sheet-cell";
import { TotalCell } from "./total-cell";

/**
 * The week as a grid: a row per project, a column per day, totals down the
 * right and along the bottom.
 *
 * A client component, which the rest of this page is not. The reason is the
 * cursor: a grid holds one tab stop and the arrows move between cells inside
 * it, so exactly one cell carries a usable tab index and which one that is
 * changes as the reader moves. Nothing that renders on the server can know
 * that, and a grid that put all forty cells in the tab order would be
 * thirty-nine presses from Monday on the first row to Monday on the second.
 *
 * The figures are not computed here. `buildTimesheet` did that on the server,
 * and this maps over what it produced — the division the rest of the app keeps
 * between arithmetic in `lib/` and markup in a component. Nothing in this
 * component writes, either: Day 027 is what puts an editor in a cell, and
 * until then the cursor is for reading.
 */
export function TimesheetGrid({
  sheet,
  today,
}: {
  sheet: Timesheet;
  /** The reader's today, for marking a column and placing the cursor. */
  today: string;
}) {
  /*
    Where the cursor is. Clamped on every render rather than corrected when the
    sheet changes: stepping to another week leaves this component mounted with
    different rows under it, and a cursor left pointing past the end would mean
    no cell carried a tab index and the grid had quietly dropped out of the tab
    order.
  */
  const [cursor, setCursor] = useState<GridPosition>(() =>
    startingCursor(sheet, today),
  );
  const size = sheetSize(sheet);
  const at = clampToGrid(cursor, size);

  /**
   * A keypress inside a cell, answered by moving focus to another one.
   *
   * Focus is moved by id rather than through a ref, for the reason
   * `cellDomId` gives: the cell to move to is a different element, and its own
   * tab index has not been re-rendered yet at the moment the key is handled.
   * The move is what triggers that cell's `onFocus`, which is the only thing
   * that writes the cursor down — so the state always says where focus
   * actually is, including after a click.
   *
   * `preventDefault` only for a press the grid claimed. An arrow that the edge
   * of the grid refuses still counts as claimed, so ArrowRight on Sunday stops
   * at Sunday rather than scrolling the page sideways; Tab and everything else
   * returns null above and goes to the browser untouched.
   */
  function moveCursor(
    from: GridPosition,
    event: KeyboardEvent<HTMLTableCellElement>,
  ) {
    const next = moveInGrid(from, size, event);
    if (next === null) return;
    event.preventDefault();

    const row = sheet.rows[next.row];
    const day = sheet.week.days[next.column];
    if (row === undefined || day === undefined) return;
    document.getElementById(cellDomId(row.project.id, day))?.focus();
  }

  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <caption className="caption-bottom pt-3 text-left text-xs text-zinc-500 dark:text-zinc-400">
        {GRID_KEYBOARD_HINT}
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            {SHEET_COLUMNS.project}
          </th>
          {sheet.week.days.map((day) => (
            <DayHeading key={day} day={day} today={today} />
          ))}
          <th scope="col" className="py-2 text-right font-medium">
            {SHEET_COLUMNS.week}
          </th>
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, rowIndex) => (
          <tr
            key={row.project.id}
            className="border-b border-zinc-100 align-top dark:border-zinc-900"
          >
            <ProjectHeading project={row.project} />
            {row.cells.map((cell, column) => (
              <SheetCell
                key={cell.workedOn}
                project={row.project}
                cell={cell}
                isCursor={isSameCell(at, { row: rowIndex, column })}
                onFocus={() => setCursor({ row: rowIndex, column })}
                onKeyDown={(event) =>
                  moveCursor({ row: rowIndex, column }, event)
                }
              />
            ))}
            <TotalCell
              total={row}
              label={describeRowTotal(row)}
              className="pr-0 font-medium text-zinc-900 dark:text-zinc-100"
            />
          </tr>
        ))}
      </tbody>
      {/*
        The column totals in a footer rather than a heading row, because they
        are the sum of what is above them and reading them first would be
        reading an answer before the working. It also keeps them where a reader
        who has scrolled the rows expects to find them.
      */}
      <tfoot>
        <tr className="border-t border-zinc-300 dark:border-zinc-700">
          <th
            scope="row"
            className="py-2.5 pr-6 text-left font-medium text-zinc-900 dark:text-zinc-100"
          >
            {SHEET_TOTAL_ROW}
          </th>
          {sheet.dayTotals.map((cell) => (
            <TotalCell
              key={cell.workedOn}
              total={cell}
              label={describeColumnTotal(cell)}
              className="font-medium text-zinc-900 dark:text-zinc-100"
            />
          ))}
          <TotalCell
            total={sheet}
            label={describeSheetTotal(sheet)}
            className="pr-0 font-semibold text-zinc-900 dark:text-zinc-100"
          />
        </tr>
      </tfoot>
    </table>
  );
}
