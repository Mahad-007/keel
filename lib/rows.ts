/**
 * Which row of a list is open, and where the cursor goes when one leaves.
 *
 * A list of rows that can be edited and deleted in place has two pieces of
 * state that are not about the rows at all: which one has unfolded into
 * something bigger than a line, and — once a row is gone — which of the rows
 * that are left the reader should find themselves on.
 *
 * Both are pure, and both are here rather than in the component because they
 * are the state the rows and their tests have to agree about. They are also
 * shared: the scope tab's deliverables and the time tab's entries are
 * different things that behave identically in this one respect, and two copies
 * of the rule would be two chances for a list to behave one way and its
 * neighbour another.
 *
 * Nothing in here knows what a row *is*. Ids and a mode are the whole of it,
 * so a list passes the ids it is rendering and gets an answer about them.
 */

/**
 * The two things a row can be open for: a form that edits it, or the step that
 * asks whether to delete it.
 */
export type RowMode = "edit" | "confirm";

/** The open row, or null when the list is just a list. */
export type OpenRow = {
  readonly id: string;
  readonly mode: RowMode;
} | null;

/** Nothing open — what a freshly rendered list starts from. */
export const NO_OPEN_ROW: OpenRow = null;

/**
 * Open one row for one thing, which closes anything else that was open.
 *
 * One row at a time, and that is a rule rather than an accident —
 *
 *   - two open editors are two half-finished forms competing for one reader's
 *     attention, and whichever they forget about loses its work silently;
 *   - a deletion step is a question, and a page holding two questions at once
 *     has to be read twice before either can be answered;
 *   - the list is what the reader came for, and a list where half the rows
 *     have unfolded into forms is no longer a list anybody can scan.
 *
 * It takes no previous state, and that is the point: there is only ever one, so
 * opening is a statement rather than a transition. The same row can be opened
 * for the other mode — pressing Delete while editing replaces the form with
 * the step, which is what the reader asked for.
 */
export function openedRow(id: string, mode: RowMode): OpenRow {
  return { id, mode };
}

/**
 * What a given row is open for, or null if it is closed.
 *
 * The row asks about itself rather than being told, so adding a third mode
 * later does not mean passing a third flag down to every line.
 */
export function rowMode(open: OpenRow, id: string): RowMode | null {
  if (open === null || open.id !== id) return null;
  return open.mode;
}

/**
 * Close a row, as asked by that row.
 *
 * It takes the id and checks it, rather than simply returning null, because
 * the asking is asynchronous. A save answers some time after the press, and by
 * then the reader may have cancelled and opened a different line; the answer
 * still belongs to the row that sent it, and a blind close would shut the
 * editor they are now typing in. The same goes for an editor closing itself on
 * an effect one render after something else opened.
 *
 * A row that is not the open one closes nothing, which is the honest answer:
 * it is already closed.
 */
export function closedRow(open: OpenRow, id: string): OpenRow {
  if (open === null || open.id !== id) return open;
  return null;
}

/**
 * The open row, dropped if the list no longer has it.
 *
 * A row can leave the list while something is open on it: somebody else
 * deleted it, or this reader deleted the row they were being asked about and
 * the question has now been answered. Either way the form or the step is open
 * on nothing — it would keep the reader's focus inside a line the list cannot
 * show and offer to save a row that is not there.
 *
 * Nothing open stays nothing open without looking at the list, which is the
 * common case on every render.
 */
export function openRowStillThere(
  open: OpenRow,
  ids: readonly string[],
): OpenRow {
  if (open === null) return open;
  return ids.includes(open.id) ? open : null;
}

/**
 * Which row the cursor should move to once one is removed, or null when the
 * list has none left.
 *
 * Deleting a row removes the button the press was made from, and a press that
 * destroys its own control leaves the focus on nothing: the browser falls back
 * to the document, so the reader's next Tab starts again from the top of the
 * page. On a list of eight that is a hunt back to where they were, every time.
 *
 * The row that takes the deleted one's place, because that is where the eye
 * already is — the list closed up, and the row now under the cursor's old
 * position is the next thing to act on. Deleting the last row has nothing
 * below it, so the cursor goes to the row above instead.
 *
 * A row the list does not have gets null rather than a guess. There is nothing
 * to move to and nothing was deleted.
 */
export function rowAfterRemoval(
  ids: readonly string[],
  removed: string,
): string | null {
  const index = ids.indexOf(removed);
  if (index === -1) return null;
  const left = ids.filter((id) => id !== removed);
  if (left.length === 0) return null;
  return left[Math.min(index, left.length - 1)];
}

/**
 * What was last said about a press, and which press said it.
 *
 * The number is not shown anywhere. It is there because a live region only
 * announces text that has *changed*, and two presses running can say the same
 * thing — marking a line done, reopening it, marking it done again. Keying the
 * sentence on the press makes the second one a new node rather than the same
 * words, which is the difference between being told and not.
 *
 * It is also what lets a press withdraw its own sentence and nobody else's,
 * which matters because presses are sent one at a time and answered in that
 * order: by the time one is refused, a later press may already have said
 * something true.
 */
export type Announcement = {
  readonly text: string;
  readonly press: number;
};

/**
 * The live region's contents once the press numbered `press` takes back what it
 * said — because the server refused it, so the sentence claiming it worked is
 * no longer true.
 *
 * Only that press's own sentence goes. Presses are sent one at a time and
 * answered in the order they were made, so a press that is refused can be
 * answered *after* a later press has already announced something that did
 * happen: "Start" then "Mark done" on one line is two presses in under a
 * second, and the first can fail while the second succeeds. Clearing whatever
 * the region happens to hold would wipe the later sentence moments after it was
 * inserted, and the later press has no reason to say it twice — so a reader
 * working from a screen reader would simply never hear it.
 *
 * A number no sentence was said under leaves the region alone, which is the
 * answer for a press that had nothing to announce in the first place.
 */
export function withdrawAnnouncement(
  said: Announcement | null,
  press: number,
): Announcement | null {
  if (said === null || said.press !== press) return said;
  return null;
}
