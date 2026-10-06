/**
 * Which line of a scope list is open, and for what.
 *
 * A row reads as one line of the list until it is asked to do something that
 * needs more room: an edit form, or the step in front of a deletion. One row at
 * a time is open, and that is a rule rather than an accident —
 *
 *   - two open editors are two half-finished forms competing for one reader's
 *     attention, and whichever they forget about loses its work silently;
 *   - a deletion step is a question, and a page holding two questions at once
 *     has to be read twice before either can be answered;
 *   - the list is what the reader came for, and a list where half the rows have
 *     unfolded into forms is no longer a list anybody can scan.
 *
 * So opening anything closes whatever was open, which is this module's whole
 * job: pure, because what is open is the one piece of state the row components
 * and their tests both have to agree about.
 */

/** The two things a row can be open for. */
export type ScopeRowMode = "edit" | "confirm";

/** The open row, or null when the list is just a list. */
export type OpenScopeRow = {
  readonly id: string;
  readonly mode: ScopeRowMode;
} | null;

/** Nothing open — what a freshly rendered list starts from. */
export const NO_OPEN_ROW: OpenScopeRow = null;

/**
 * Open one row for one thing, which closes anything else that was open.
 *
 * It takes no previous state, and that is the point: there is only ever one, so
 * opening is a statement rather than a transition. The same row can be opened
 * for the other mode — pressing Delete while editing replaces the form with the
 * step, which is what the reader asked for.
 */
export function openScopeRow(id: string, mode: ScopeRowMode): OpenScopeRow {
  return { id, mode };
}

/**
 * What a given row is open for, or null if it is closed.
 *
 * The row asks about itself rather than being told, so adding a third mode
 * later does not mean passing a third flag down to every line.
 */
export function scopeRowMode(
  open: OpenScopeRow,
  id: string,
): ScopeRowMode | null {
  if (open === null || open.id !== id) return null;
  return open.mode;
}

/**
 * Close a row, as asked by that row.
 *
 * It takes the id and checks it, rather than simply returning null, because the
 * asking is asynchronous. A save answers some time after the press, and by then
 * the reader may have cancelled and opened a different line; the answer still
 * belongs to the row that sent it, and a blind close would shut the editor they
 * are now typing in. The same goes for an editor closing itself on an effect
 * one render after something else opened.
 *
 * A row that is not the open one closes nothing, which is the honest answer:
 * it is already closed.
 */
export function closeScopeRow(open: OpenScopeRow, id: string): OpenScopeRow {
  if (open === null || open.id !== id) return open;
  return null;
}

/**
 * The open row, dropped if the list no longer has it.
 *
 * A deliverable can leave the list while a row is open on it: somebody else
 * deleted it, or this reader deleted the line they were being asked about and
 * the question has now been answered. Either way the form or the step is open
 * on nothing — it would keep the reader's focus inside a line the list cannot
 * show and offer to save a row that is not there.
 *
 * Nothing open stays nothing open without looking at the list, which is the
 * common case on every render.
 */
export function openRowStillThere(
  open: OpenScopeRow,
  ids: readonly string[],
): OpenScopeRow {
  if (open === null) return open;
  return ids.includes(open.id) ? open : null;
}
