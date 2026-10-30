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
 * a modifier they mean the sheet's ends instead, which is the same escalation
 * Ctrl+Home performs in a document.
 *
 * Either modifier will do. Requiring Ctrl specifically would leave the
 * shortcut unreachable on a Mac keyboard, and no other binding on this page
 * claims Cmd+Home.
 */
export function gridMove(press: GridPress): GridMove | null {
  const whole = press.ctrlKey === true || press.metaKey === true;

  switch (press.key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
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
