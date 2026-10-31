/**
 * Moving around a grid with the keyboard, as arithmetic on a position.
 *
 * A timesheet is the first thing in Keel that is read in two directions, and
 * two directions is what makes tabbing through it useless: forty cells in
 * reading order means thirty-nine presses to get from Monday on the first row
 * to Monday on the second. So the grid holds one tab stop and the arrows move
 * between cells inside it — the ARIA grid pattern, and the one a reader
 * already knows from every spreadsheet they have used.
 *
 * All of it pure, over a row and a column. Nothing here touches the DOM or a
 * React event: the component hands over which key was pressed and where the
 * cursor is, and gets back where it should be. That is what makes the edge
 * cases — the ends of a row, an empty sheet, a week that got shorter while the
 * cursor was in it — testable without a browser.
 */

/** Which cell the cursor is in: both zero-based, the row first. */
export type GridPosition = {
  readonly row: number;
  readonly column: number;
};

/** How big the grid is. A sheet's columns are its week, so this is seven. */
export type GridSize = {
  readonly rows: number;
  readonly columns: number;
};

/**
 * The part of a keypress a move is decided from.
 *
 * Its own type rather than a React `KeyboardEvent`, so the rules can be tested
 * without one and so nothing in here can reach for `preventDefault` — whether
 * the browser keeps the keypress is the component's decision, made from what
 * this returns.
 *
 * Both modifiers, because the shortcut for "the first cell of the sheet" is
 * Ctrl+Home on Windows and Linux and Cmd+Home where there is no Ctrl to hand.
 */
export type GridPress = {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};

/** The moves a keypress can ask for. */
export type GridMove =
  | "left"
  | "right"
  | "up"
  | "down"
  | "row-start"
  | "row-end"
  | "sheet-start"
  | "sheet-end";

/**
 * Which move a keypress asks for, or null if it asks for none.
 *
 * Null is the important answer: it is what leaves every other key alone.
 * A grid that swallowed keys it had no use for would break Tab out of itself,
 * and the first thing a reader does when the arrows stop working is press Tab.
 *
 * Home and End are the row's ends, which is what they mean in a spreadsheet
 * and in a text field — the nearest edge in the direction the line runs. With
 * Ctrl or Cmd they mean the sheet's ends instead, which is the same escalation
 * Ctrl+Home performs in a document. Either of those two will do: requiring
 * Ctrl specifically would leave the shortcut unreachable on a Mac keyboard.
 *
 * A modified arrow is not the grid's. Cmd+Left is Back on a Mac and Alt+Left
 * is Back everywhere else, and a grid that swallowed those would break the
 * back button exactly on the page whose whole state is in the URL — the week
 * somebody stepped to is a history entry, and stepping back out of it is the
 * first thing they will try. Alt is left alone entirely for the same reason:
 * the browser has bindings on it that this page has no business claiming.
 */
export function gridMove(press: GridPress): GridMove | null {
  if (press.altKey === true) return null;
  const whole = press.ctrlKey === true || press.metaKey === true;

  switch (press.key) {
    case "ArrowLeft":
      return whole ? null : "left";
    case "ArrowRight":
      return whole ? null : "right";
    case "ArrowUp":
      return whole ? null : "up";
    case "ArrowDown":
      return whole ? null : "down";
    case "Home":
      return whole ? "sheet-start" : "row-start";
    case "End":
      return whole ? "sheet-end" : "row-end";
    default:
      return null;
  }
}

/** A number held inside a range, both ends included. */
function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

/**
 * A position brought back inside the grid.
 *
 * Needed because the cursor outlives the sheet under it. Stepping to the
 * previous week leaves the same component mounted with different rows, and a
 * cursor that was on the eleventh row of a sheet that now has four would be
 * pointing at nothing — no cell would be tabbable, and the grid would have
 * quietly dropped out of the tab order.
 *
 * Clamped rather than reset to the corner, so a reader who was looking at
 * Thursday is still looking at Thursday after the week moves. An empty grid
 * clamps to the corner, which no cell occupies; nothing renders there, and the
 * component's own emptiness check is what keeps that from mattering.
 */
export function clampToGrid(
  position: GridPosition,
  size: GridSize,
): GridPosition {
  return {
    row: clamp(position.row, 0, Math.max(size.rows - 1, 0)),
    column: clamp(position.column, 0, Math.max(size.columns - 1, 0)),
  };
}

/**
 * Where a keypress moves the cursor, or null if the keypress is not one of
 * the grid's.
 *
 * Null means "the browser can have it", which is how Tab still leaves the grid
 * and how typing still reaches anything inside a cell. Every other answer is a
 * position — including the one the cursor is already in, when the press was
 * for a move the edge of the grid refuses. That is deliberate: the component
 * takes any position as a reason to keep the keypress, so ArrowRight on
 * Sunday stops at Sunday rather than scrolling the page sideways.
 *
 * Nothing wraps. ArrowRight off the end of a row does not come back on the
 * next one, because the next row is a different project and the press was
 * about a day: a cursor that jumped engagement would be one a reader has to
 * look for after every press. The edges of a grid are where a reader's hand
 * learns the shape of it.
 */
export function moveInGrid(
  from: GridPosition,
  size: GridSize,
  press: GridPress,
): GridPosition | null {
  const move = gridMove(press);
  if (move === null) return null;

  const lastRow = Math.max(size.rows - 1, 0);
  const lastColumn = Math.max(size.columns - 1, 0);

  switch (move) {
    case "left":
      return clampToGrid({ ...from, column: from.column - 1 }, size);
    case "right":
      return clampToGrid({ ...from, column: from.column + 1 }, size);
    case "up":
      return clampToGrid({ ...from, row: from.row - 1 }, size);
    case "down":
      return clampToGrid({ ...from, row: from.row + 1 }, size);
    case "row-start":
      return clampToGrid({ ...from, column: 0 }, size);
    case "row-end":
      return clampToGrid({ ...from, column: lastColumn }, size);
    case "sheet-start":
      return { row: 0, column: 0 };
    case "sheet-end":
      return { row: lastRow, column: lastColumn };
  }
}

/** Whether two positions are the same cell. What decides which cell is tabbable. */
export function isSameCell(left: GridPosition, right: GridPosition): boolean {
  return left.row === right.row && left.column === right.column;
}

/**
 * The DOM id of one cell, derived from the row and the column it sits in
 * rather than generated.
 *
 * Derived because focus has to be moved from outside the cell: the keypress
 * lands on whichever cell the cursor is in, and the cell it should move to is
 * a different element that may not have rendered its new tab index yet.
 * Knowing the id from the position means the handler can reach it without a
 * ref for every cell on the sheet.
 *
 * The project id and the date together, because that pair is what makes a cell
 * unique — a project appears on one row and a day in one column. Row and
 * column numbers would be shorter and wrong: they change when the week moves
 * under the cursor, so a stale id would focus somebody else's Tuesday.
 */
export function cellDomId(projectId: string, workedOn: string): string {
  return `timesheet-cell-${projectId}-${workedOn}`;
}

/**
 * What the grid says about its own keys.
 *
 * Said rather than left to be discovered, because a grid with one tab stop is
 * the one widget on the page that does not behave the way the rest of it does:
 * a reader who presses Tab expecting the next cell gets the next control after
 * the whole sheet, and without a sentence they conclude the page is broken.
 *
 * "The day cells" rather than "the cells", because the totals along the edges
 * are not in the cursor's path and a reader who arrows right off Sunday
 * expecting the week's total needs telling why nothing happened. They are
 * derived from the cells beside them and there is never anything to do to one,
 * so visiting them would be an eighth press to cross a week and a stop that
 * does nothing when it arrives — but a reader hunting for a stop that is not
 * there is worse than a clause saying so.
 *
 * Above the grid rather than in a title on each cell, so it is read once by
 * somebody arriving and not forty times by somebody crossing a row.
 */
export const GRID_KEYBOARD_HINT =
  "The arrow keys move between the day cells; the totals along the edges are read rather than stepped onto. Home and End jump to the ends of a row, and with Ctrl or Cmd to the ends of the sheet.";
