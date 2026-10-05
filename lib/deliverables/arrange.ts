import { readField } from "@/lib/forms/form-data";

import { isMoveDirection, moveOne, type MoveDirection } from "./order";
import {
  deliverableStatusPhrase,
  deliverableStatusVerb,
  isDeliverableStatus,
  type DeliverableStatus,
} from "./status";

/**
 * Rearranging a scope list: the two changes a row's controls can ask for, and
 * what the list looks like once one of them has been asked for.
 *
 * It exists because the list on screen has to change before the server has
 * agreed to it. A move that waits for a round trip is a list that jumps a
 * beat after the press, and pressing Up three times to lift a deliverable to
 * the top would be three waits. So the page applies the change locally and
 * sends it, and these are the functions that say what "applies the change"
 * means — pure, so the answer cannot differ between the optimistic list and
 * the one that comes back.
 */

/**
 * What rearranging needs to know about a deliverable, which is less than a row
 * holds: who it is, what it says, and where it stands. The functions here are
 * generic over anything carrying those three, so the page can pass whole rows
 * and a test can pass three fields.
 */
export type ArrangedDeliverable = {
  readonly id: string;
  readonly title: string;
  readonly status: DeliverableStatus;
};

/**
 * One press of one control.
 *
 * A move carries the direction rather than a destination position, because
 * that is what the control means — a press of Up is a step towards the front
 * from wherever the row currently is, and a position computed on the client
 * would be a guess about a list somebody else may have changed.
 *
 * A status change carries where the row is as well as where it is going. The
 * destination is what the list shows immediately; `from` is what lets the
 * write refuse a status the reader was not looking at when they pressed.
 *
 * `from` is a plain string because it is only ever compared. A row holding a
 * status this app does not recognise — the column is TEXT, so one can — still
 * renders a control offering to press it back into the cycle, and narrowing the
 * status it came from would turn that offer into a button that does nothing.
 */
export type ScopeChange =
  | {
      readonly kind: "move";
      readonly id: string;
      readonly direction: MoveDirection;
    }
  | {
      readonly kind: "status";
      readonly id: string;
      readonly from: string;
      readonly status: DeliverableStatus;
    };

/**
 * The list as it reads once a change has been asked for.
 *
 * The move goes through `moveOne`, the same function the data layer reorders
 * with, so the list on screen and the list in the database are rearranged by
 * one piece of arithmetic rather than two that have to agree. A press at the
 * end of the list in the direction pressed leaves the order alone, and so does
 * a change naming a deliverable this list does not have — a row somebody else
 * deleted while the page was open.
 *
 * Nothing renumbers `sortOrder`. The number beside each line is its index in
 * the list as rendered, and the stored position is the data layer's business;
 * writing a guess at it here would put a second, briefly-wrong copy of the
 * order in the same array as the real one.
 */
export function applyScopeChange<T extends ArrangedDeliverable>(
  rows: readonly T[],
  change: ScopeChange,
): readonly T[] {
  if (change.kind === "status") {
    return rows.map((row) =>
      row.id === change.id ? { ...row, status: change.status } : row,
    );
  }

  const order = moveOne(
    rows.map((row) => row.id),
    change.id,
    change.direction,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  return order.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
}

/**
 * The names a row's controls submit under.
 *
 * Written down once because they are read in two places that cannot see each
 * other: the hidden inputs and buttons in the row, and the parser below. A
 * typo in one of them would not fail to compile — it would make every press on
 * that row do nothing.
 *
 * `id` is in the form rather than bound into an action per row because one form
 * carries all of a row's controls: a press has to say which deliverable it was
 * aimed at, and the direction or status says what to do with it. The project is
 * *not* in the form — the page closes it over before the list ever sees it, so
 * neither a submitted field nor a forged argument can name a project the reader
 * was not looking at.
 */
export const SCOPE_FIELD_NAMES = {
  id: "id",
  direction: "direction",
  status: "status",
  from: "from",
} as const;

/**
 * What a press of one of a row's controls asked for, or null if the submission
 * does not describe a change this list can make.
 *
 * A browser sends the pressed button's name and value and nobody else's, which
 * is what lets one form per row carry three controls: a move button contributes
 * a direction, the status button a destination status, and whichever was pressed
 * is the only one in the submission.
 *
 * Null rather than a thrown error, because every cause is the same kind of
 * thing — a form submitted some other way, a direction that is not one of the
 * two, a status the list does not know. There is nothing for the reader to fix
 * and nothing to tell them: the honest response to a press that says nothing is
 * to do nothing.
 */
export function readScopeChange(formData: FormData): ScopeChange | null {
  const id = readField(formData, SCOPE_FIELD_NAMES.id).trim();
  if (id === "") return null;

  const direction = readField(formData, SCOPE_FIELD_NAMES.direction);
  if (direction !== "") {
    if (!isMoveDirection(direction)) return null;
    return { kind: "move", id, direction };
  }

  const status = readField(formData, SCOPE_FIELD_NAMES.status);
  const from = readField(formData, SCOPE_FIELD_NAMES.from);
  // The destination has to be a status, because it is about to be written. Where
  // the row came from only has to be something: it is checked against the row
  // rather than stored, and a row can be holding anything.
  if (!isDeliverableStatus(status) || from === "") return null;
  return { kind: "status", id, from, status };
}

/**
 * Whether a press would actually change the list it was made against.
 *
 * It is what stops a press at the end of the list becoming a write. A move
 * control the list cannot act on — Up on the first line — is offered rather
 * than taken away, so that a reader pressing it keeps the focus they have and
 * gets told why nothing happened; this is how the list knows that is the case
 * before it sends anything.
 *
 * A deliverable the list no longer has changes nothing either, and so does a
 * status press that names the status the row already holds. Both are a page
 * describing a scope list that has moved on, and neither is worth a round trip.
 */
export function changesScope<T extends ArrangedDeliverable>(
  rows: readonly T[],
  change: ScopeChange,
): boolean {
  const row = rows.find((one) => one.id === change.id);
  if (row === undefined) return false;
  if (change.kind === "status") return row.status !== change.status;
  return applyScopeChange(rows, change).indexOf(row) !== rows.indexOf(row);
}

/** Which end of the list a press that moved nothing had already reached. */
const END_OF_LIST: Record<MoveDirection, string> = {
  up: "first",
  down: "last",
};

/**
 * What to say out loud once a change has been applied, or null when there is
 * nothing to say.
 *
 * The list rearranges itself under the reader without the page reloading. On
 * screen that is the whole message — the line is visibly one place higher —
 * and to anyone working from a screen reader it is silence, because moving a
 * node does not announce anything. So each press gets a sentence, and the
 * sentence names the deliverable and where it ended up: "moved up" is no use
 * on a press that was the third in a row.
 *
 * `rows` is the list as it reads *before* the press, which is what the page
 * has. The position announced is counted in the list the change produces, by
 * the same function that produces it, so the number said out loud cannot
 * disagree with the number drawn down the left.
 *
 * A press that moved nothing says so rather than claiming a move. The controls
 * at the ends of the list are disabled, so it takes a stale page to get here —
 * and a reader who has just pressed Up deserves better than silence followed
 * by a list that did not change.
 */
export function announceScopeChange<T extends ArrangedDeliverable>(
  rows: readonly T[],
  change: ScopeChange,
): string | null {
  const row = rows.find((one) => one.id === change.id);
  if (row === undefined) return null;

  if (change.kind === "status") {
    return `“${row.title}” is now ${deliverableStatusPhrase(change.status)}.`;
  }

  const moved = applyScopeChange(rows, change);
  const was = rows.indexOf(row) + 1;
  const now = moved.indexOf(row) + 1;
  if (now === was) {
    return `“${row.title}” is already ${END_OF_LIST[change.direction]}.`;
  }
  return `Moved “${row.title}” to position ${now} of ${moved.length}.`;
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

/**
 * What a scope write hands back: nothing to say, or the one sentence worth
 * saying about why the list did not change.
 *
 * Not a form state, because these presses are not a form being filled in.
 * There is no field to put a message under and nothing the reader typed to
 * render back — a press either happened or it did not, and if it did not, the
 * list on screen has already snapped back to what the database says. The
 * sentence is there to explain that snap.
 */
export type ScopeWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: string };

/** The write landed. The revalidated page is the rest of the answer. */
export const SCOPE_WRITE_DONE: ScopeWriteResult = { ok: true };

export function scopeWriteProblem(problem: string): ScopeWriteResult {
  return { ok: false, problem };
}

/**
 * The sentences a refused press comes back with.
 *
 * Each one says what to do next, because "something went wrong" leaves a
 * reader pressing the same button again. Two of these end in "reload": the page
 * is describing a scope list that has since changed, and no amount of pressing
 * will make it describe the current one.
 */
export const SCOPE_PROBLEMS = {
  /** The row is gone, or belongs to a project this page is not showing. */
  missing:
    "That deliverable is not on this project any more, so nothing was changed. Reload to see what the scope list says now.",
  /** The press described a direction or a status that is not one of ours. */
  unknown:
    "That is not a change this list can make, so nothing was changed. Reload to see what the scope list says now.",
  /**
   * The row changed between the check that let the press through and the write
   * itself. A race rather than a mistake, and a different sentence from the
   * stale press below: that one can say what the row says instead, while this
   * one only knows that it is no longer what was read a moment ago.
   */
  raced:
    "That deliverable changed while the press was on its way, so nothing was written. Reload to see what the scope list says now.",
  /** The write itself failed — the driver, the disk, the network. */
  failed: "Could not save that change. Nothing was written — try again.",
} as const;

/**
 * What to say about a press whose answer never arrived.
 *
 * Deliberately not one of `SCOPE_PROBLEMS`, and the difference is the one thing
 * this sentence has to get right. Every one of those comes back *from* the
 * action, which means the action ran and decided: nothing was written, and the
 * sentence can say so. This one is the case where the action never answered —
 * the connection dropped, the tab was suspended mid-request, the request was
 * aborted — and then there is no way to know from here whether the write
 * happened. The request may have been lost on the way out, or the answer lost
 * on the way back with the row already written.
 *
 * So it does not claim either. A sentence saying "nothing was written" would be
 * a guess, and the guess is wrong exactly when it matters — a reader told their
 * press did not land, who presses again, cycling a status they had already set.
 * Reloading is the only honest instruction: the server knows, and the page can
 * go and ask it.
 */
export const SCOPE_NO_ANSWER =
  "Could not tell whether that change was saved — the answer never arrived. Reload to see what the scope list says now.";

/**
 * The two writes a row's controls can ask for, as the list sees them: the
 * project is already bound, so a press only has to say which line it was aimed
 * at and what it asked for.
 *
 * Captured by a `"use server"` closure in the server component that renders the
 * list, and handed down as props — rather than the list holding a project id
 * and passing it as an argument. The difference is not tidiness. An argument to
 * a server action is wire data: the call is a POST, and every argument in it is
 * whatever the caller put there, so a project id passed that way is supplied by
 * the page's holder and comparing a deliverable against it proves nothing.
 *
 * It has to be that exact shape. `.bind` is *not* enough and the fact that it
 * reads like binding is the trap — it concatenates onto the reference's
 * `$$bound` and those values are serialised in the clear, on the server side as
 * much as the client. Only a `"use server"` function declared inside a server
 * component is rewritten to encrypt what it captures. That encryption is what
 * makes "is this deliverable one of this project's" a check rather than a
 * tautology, so if these ever go back to being `.bind`-ed the check quietly
 * stops being one.
 *
 * It still is not an ownership check. It says the press names a deliverable of
 * the project the page was served for; whether the reader was entitled to that
 * page is a question about a session, and Phase 8 has to ask it in the action
 * itself, against the session rather than against anything that arrived here.
 */
export type MoveScopeAction = (
  id: string,
  direction: MoveDirection,
) => Promise<ScopeWriteResult>;

export type StatusScopeAction = (
  id: string,
  from: string,
  status: DeliverableStatus,
) => Promise<ScopeWriteResult>;

/**
 * Why a status press cannot be applied to the row as it now stands, or null
 * when it can.
 *
 * A press says where the row was as well as where it is going, and this is what
 * that is for. The button said "Mark done" because the row said "In progress";
 * if the row says something else by the time the press arrives, the reader was
 * looking at a list that had already moved and the press is not the one they
 * would make now. Writing it anyway would silently overrule whoever changed it.
 *
 * The sentence names the status the row actually holds, because that is the
 * thing the reader cannot see — their page still shows the old one, and the
 * difference is the whole explanation.
 */
export function staleStatusProblem(
  row: ArrangedDeliverable,
  from: string,
): string | null {
  if (row.status === from) return null;
  return `“${row.title}” is already ${deliverableStatusPhrase(row.status)}, so nothing was changed. Reload to see what the scope list says now.`;
}

/**
 * What a move control is called, with the deliverable it acts on in the name.
 *
 * A scope list of eight lines holds eight buttons that say "Up", and to anyone
 * who cannot see which line they are on that is one control repeated eight
 * times. The title is what makes each one a different button.
 *
 * The direction appears in the sentence as itself: the two values of
 * `MoveDirection` are the English words, so there is nothing to translate and
 * nothing that can fall out of step with the label on the button.
 */
export function moveButtonLabel(title: string, direction: MoveDirection): string {
  return `Move “${title}” ${direction}`;
}

/**
 * What the status control is called, which is the verb on its face plus the
 * line it acts on: "Mark done “Wireframes”".
 *
 * Slightly odd read aloud and the right trade: the verb has to come first
 * because it is what the button does, and a screen reader walking a list of
 * controls reads the name from the front.
 */
export function statusButtonLabel(
  title: string,
  status: DeliverableStatus,
): string {
  return `${deliverableStatusVerb(status)} “${title}”`;
}
