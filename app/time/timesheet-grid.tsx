"use client";

import {
  useActionState,
  useEffect,
  useState,
  type KeyboardEvent,
} from "react";

import { FormSummary, SubmitButton } from "@/components/form";
import { bulkCellName } from "@/lib/time/bulk";
import {
  caretIn,
  cellDomId,
  clampToGrid,
  GRID_KEYBOARD_HINT,
  isSameCell,
  moveInGrid,
  pressLeavesEditor,
  type GridPosition,
} from "@/lib/time/grid";
import {
  BULK_NO_ANSWER,
  failedBulkState,
  initialBulkState,
  readBulkFields,
  savedBulkNotice,
  type BulkTimeState,
} from "@/lib/time/bulk-form";
import {
  describeColumnTotal,
  describeRowTotal,
  describeSheetTotal,
  SHEET_COLUMNS,
  SHEET_TOTAL_ROW,
  sheetCaption,
  refusedCells,
  sheetCellNames,
  sheetSize,
  startingCursor,
  type Timesheet,
} from "@/lib/time/timesheet";

import { CellProblems } from "./cell-problems";
import { DayHeading } from "./day-heading";
import { ProjectHeading } from "./project-heading";
import { SheetCell } from "./sheet-cell";
import { TotalCell } from "./total-cell";

/** One cell's field name, from the pair it stands for. */
function cellName(projectId: string, workedOn: string): string {
  return bulkCellName({ projectId, workedOn });
}

/** What the table points `aria-describedby` at. One grid to a page. */
const KEYBOARD_HINT_ID = "timesheet-keys";

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
 * between arithmetic in `lib/` and markup in a component. Nor are they decided
 * here: every cell holds a box, and what a typed sheet means is settled by the
 * pure functions in `bulk.ts` before anything is written.
 */
export function TimesheetGrid({
  sheet,
  today,
  save,
}: {
  sheet: Timesheet;
  /** The reader's today, for marking a column and placing the cursor. */
  today: string;
  /**
   * The write, with the cells this sheet offered already captured by the page
   * that served it. Captured there rather than bound here: a `.bind` in a
   * client component only prepends its arguments to the POST body, which would
   * make the list of allowed cells part of the submission — and a list the
   * caller sends is no bound on the submission at all.
   */
  save: (
    previous: BulkTimeState,
    formData: FormData,
  ) => Promise<BulkTimeState>;
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

  /*
    The cells the sheet offers, and what is in them. The names bound what a
    submission may say — see `sheetCellNames` — and the state is what each box
    renders from: blank on a fresh sheet, what was typed on a refused one.
  */
  const names = sheetCellNames(sheet);

  /*
    Computed here rather than handed down as a prop, which is the one place
    this form differs from the others. A grid's initial state is forty empty
    strings keyed by cell name, and a prop is serialised into the page — so
    passing it would put the whole list in the markup twice, once as the boxes
    and once as the state they started from. It is only read on the first
    render anyway.
  */
  /*
    The write has to come back with a state even when the call itself never
    completes.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would
    throw away a week somebody had just typed into forty boxes. A dropped
    connection, a tab suspended mid-request and an aborted request all reject,
    and the cell list is captured by an encrypted closure, so a page left open
    across a deploy that rotated the key rejects too.

    What it says is not "try again", which is the instruction that would log
    the week twice — see `BULK_NO_ANSWER`. The fields come from the submission
    rather than from the previous state, so the boxes come back holding what
    was in them when the press was made.
  */
  async function attempt(
    previous: BulkTimeState,
    formData: FormData,
  ): Promise<BulkTimeState> {
    try {
      return await save(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why sheets are failing.
      console.error("save sheet: the server never answered", error);
      return failedBulkState(readBulkFields(formData, names), BULK_NO_ANSWER);
    }
  }

  const [state, formAction] = useActionState(attempt, initialBulkState(names));

  /*
    The cursor to the first refused cell after a press that was refused.

    Without it the page looks unchanged from the keyboard: focus is still on
    the Save button, the messages are under a sheet of forty boxes, and the one
    that needs fixing is somewhere in the middle of it. Landing on the box
    rather than on the message is what lets the figure be retyped straight
    away, and the box points at its own message so the reason is read with it.

    First in reading order, which is what `refusedCells` walks — not whichever
    error happened to be keyed first. Focusing the box fires its `onFocus`, so
    the grid's tab stop moves with the cursor and Tab leaves from where the
    reader actually is.

    Nothing moves after a press that landed. Focus is on the Save button, which
    is still there and still the thing a reader who has more to type will come
    back past; throwing the cursor into a cell would be the page deciding where
    they go next.
  */
  useEffect(() => {
    const first = refusedCells(sheet, state.errors)[0];
    if (first === undefined) return;
    document
      .getElementById(cellDomId(first.project.id, first.cell.workedOn))
      ?.focus();
  }, [state, sheet]);

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
   * at Sunday rather than scrolling the page sideways; Tab, a modified arrow
   * and everything else returns null above and goes to the browser untouched.
   */
  function moveCursor(
    from: GridPosition,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    /*
      The box gets the keypress first, and only gives it up at the edge of its
      own text: ArrowLeft with the caret mid-figure is a correction, and the
      same press with the caret at the start is "back a day". Without this the
      arrows would make a typed duration uncorrectable except by deleting it —
      see `pressLeavesEditor`, which is where the rule is.
    */
    if (!pressLeavesEditor(event, caretIn(event.currentTarget))) return;

    const next = moveInGrid(from, size, event);
    if (next === null) return;
    event.preventDefault();

    const row = sheet.rows[next.row];
    const day = sheet.week.days[next.column];
    if (row === undefined || day === undefined) return;
    document.getElementById(cellDomId(row.project.id, day))?.focus();
  }

  return (
    <form action={formAction} noValidate>
      {/*
        Above the grid, because the field that failed may be a long way down a
        sheet of forty boxes — and on this form the summary carries the one
        fact that matters most: nothing was saved. The whole sheet is one
        transaction, so a reader who reads this knows there is nothing
        half-written to go and find.
      */}
      <FormSummary state={state} />
      {/*
        `role="grid"` is what makes the arrows below reach this table at all.
        A screen reader reads a plain `<table>` in browse mode, where it owns
        the arrow keys for moving its own cursor through the document and the
        keypress never arrives at a cell's `onKeyDown` — so the whole keyboard
        pattern this component exists for would work for a reader using a mouse
        or Tab and silently not for the one who needs it. A grid is announced
        as a widget instead, and the reader's own navigation hands the arrows
        over once focus is inside it.

        Nothing else has to be spelled out: a `<td>` inside a table exposed as
        a grid is a `gridcell`, a `<tr>` is a row and a `<th>` is a column or
        row header, so the markup underneath is already the pattern. Declaring
        each of those by hand would be three more places for the shape of the
        sheet to drift from the shape of its markup.

        Not `aria-readonly` any more: every cell now holds a box, and a grid
        that announced itself as read-only would be telling a reader not to
        bother typing into the thing the day was built for.
      */}
      <table
        role="grid"
        aria-describedby={KEYBOARD_HINT_ID}
        className="mt-4 w-full border-collapse text-sm"
      >
        {/*
          The caption is the table's name, so it says which week this is and
          which way it runs. The keys are a description rather than a name — a
          table announced as "the arrow keys move between cells" is one whose
          reader never finds out what is in it — so they sit in a paragraph of
          their own underneath, pointed at from here.
        */}
        <caption className="sr-only">{sheetCaption(sheet)}</caption>
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
                  value={state.fields[cellName(row.project.id, cell.workedOn)] ?? ""}
                  error={
                    state.errors[cellName(row.project.id, cell.workedOn)] ??
                    null
                  }
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
          reading an answer before the working. It also keeps them where a
          reader who has scrolled the rows expects to find them.
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
      <p
        id={KEYBOARD_HINT_ID}
        className="mt-3 text-xs text-zinc-500 dark:text-zinc-400"
      >
        {GRID_KEYBOARD_HINT}
      </p>
      {/*
        The reasons, under the sheet rather than in the cells — see
        `CellProblems` for why — with each box pointing at its own line. The
        refused cells are read off the sheet in reading order rather than off
        the error object, so the list runs down the rows the way a reader
        checking it against the grid does.
      */}
      <CellProblems refused={refusedCells(sheet, state.errors)} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save sheet</SubmitButton>
        {/*
          Rendered empty rather than conditionally, because a live region has
          to be in the document before the text arrives for a screen reader to
          notice it appearing. `status` rather than `alert`: the sheet saved as
          asked, which is worth saying and not worth interrupting for.

          A press changes the page in ways a reader may be looking at none of —
          a dozen boxes empty and figures appearing in the cells above them —
          so the sentence says what landed, where, and that the boxes are blank
          again. Keyed on the first entry written, because two presses that
          each logged two hours would render identical text, and unchanged text
          is no change at all: the second would go unannounced.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.saved === null ? null : (
            <span key={state.saved.entryIds[0]}>{savedBulkNotice(state)}</span>
          )}
        </p>
      </div>
    </form>
  );
}
