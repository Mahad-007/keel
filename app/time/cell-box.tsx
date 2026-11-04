import type { FocusEvent, KeyboardEvent } from "react";

import { useFormPending } from "@/components/form";
import { bulkCellName } from "@/lib/time/bulk";
import { cellDomId, cellErrorDomId } from "@/lib/time/grid";
import {
  describeCellEditor,
  type TimesheetCell,
  type TimesheetProject,
} from "@/lib/time/timesheet";

/**
 * The box inside one cell of the grid: how long to add to that project on
 * that day.
 *
 * Its own component rather than an input typed into the cell, because a cell
 * is now two things — the figure already logged and the box that adds to it —
 * and they are read by different people in different ways. The figure is for
 * the eye; everything here is for the keyboard.
 *
 * The box carries the cell's whole sentence as its accessible name. A box in a
 * grid has no visible label — the row says which project and the column
 * heading says which day — and a focused input is announced by its label
 * rather than by the text sitting above it, so without this a reader crossing
 * a row hears "edit, blank" seven times.
 *
 * It is the grid's tab stop rather than the cell around it. One tab stop to a
 * sheet is what Day 026 built, and now that focus has somewhere to type the
 * tabbable thing has to be the box: a `<td>` that took the focus would leave a
 * reader pressing Tab again to reach the input inside it, forty times across a
 * week.
 *
 * Nothing here is controlled. Forty controlled inputs would re-render the
 * sheet on every keystroke, and the state they would be kept in is already
 * kept by the browser; what comes back from a refused submission is rendered
 * as `defaultValue`, which React restores when the action settles.
 */
export function CellBox({
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
  /** What is in the box: blank on a fresh sheet, what was typed after a refusal. */
  value: string;
  /** Why this cell was refused, or null if it was not. */
  error: string | null;
  /** Whether this is the cell the cursor is on, and so the grid's tab stop. */
  isCursor: boolean;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const name = bulkCellName({
    projectId: project.id,
    workedOn: cell.workedOn,
  });
  const errorId = cellErrorDomId(project.id, cell.workedOn);

  /*
    Read-only while the sheet is on its way to the server, which is not
    decoration either. React resets a form with a function action once the
    action settles, restoring every box to the value it has just re-rendered —
    so anything typed during the flight is thrown away without a word. Saying
    so with the attribute is better than letting somebody fill in Thursday and
    watch it vanish.

    Read-only rather than disabled: a disabled input loses the focus it is
    holding, and the browser drops focus to the document when it does — which
    on this page means the reader's place in a forty-box grid. A read-only box
    keeps the cursor, keeps the arrows working, and comes back the moment the
    press is answered.
  */
  const pending = useFormPending();

  return (
    <input
      type="text"
      id={cellDomId(project.id, cell.workedOn)}
      name={name}
      defaultValue={value}
      aria-label={describeCellEditor(project, cell)}
      /*
        The message is pointed at rather than only rendered under the box, so a
        reader who arrows onto a refused cell hears why it was refused with the
        box they typed it into. A sentence in a list somewhere else on the page
        is a sentence they have to go and find.

        `aria-invalid` is undefined rather than false on a cell that is fine,
        the same as every other control in the app: forty inputs each saying
        they are valid is noise to read past.
      */
      aria-invalid={error !== null || undefined}
      aria-describedby={error === null ? undefined : errorId}
      tabIndex={isCursor ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      /*
        No `maxLength`, for the reason written out in `bulk.ts`: the parser
        reads `1 hour 30 minutes`, and a cap would cut that down to `1 hour 3`
        — a duration it still accepts, worth 63 minutes instead of 90, logged
        without a word.

        `autoComplete` off because a browser offering last week's figures under
        a cell is offering to log them again, and `spellCheck` off because
        `1h30m` is not a word.
      */
      readOnly={pending}
      autoComplete="off"
      spellCheck={false}
      className={`w-full rounded border ${
        error === null
          ? "border-zinc-300 dark:border-zinc-700"
          : "border-red-500 dark:border-red-500"
      } bg-white px-1.5 py-1 text-right text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700`}
    />
  );
}
