import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";

import { isBilled, type BillingSubject } from "./billing";

/**
 * How one logged stretch of work reads in a list.
 *
 * A time entry has no title. That is the thing that makes it different from
 * everything else listed in this app: a client has a name, a project has a
 * name, a deliverable has a title, and an entry is forty minutes on a Tuesday.
 * So every sentence about one has to be built — out of the duration, the day
 * and what it went against — and the buttons beside it have to be named the
 * same way, or a list of nine entries holds nine controls that all say
 * "Delete".
 *
 * Pure, and all of it exported, because the same sentences are needed in three
 * places that cannot see each other: the row, the step in front of a deletion,
 * and the live region that says what happened after a press.
 */

/**
 * What a listed entry is, which is the row minus the columns a list does not
 * read: the project, because the list is already one project's, and the
 * timestamps, because when a record of Tuesday was typed up is not what
 * anybody came to the page for.
 */
export type ListedTimeEntry = {
  readonly id: string;
  readonly minutes: number;
  /** What was done, in a person's words, or null when they did not say. */
  readonly note: string | null;
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  readonly workedOn: string;
  /** The line of scope it went against, or null for project-level work. */
  readonly deliverableId: string | null;
  readonly billable: boolean;
  readonly billedInvoiceId: string | null;
};

/**
 * What a row can say about where an entry went, which is three things and not
 * two.
 *
 * `project` is a real answer: the call, the invoicing, the afternoon of email
 * that the scope list has no line for. It is not a missing attribution, and
 * wording it as one would push a reader towards attributing work to whichever
 * line looked closest.
 *
 * `unknown` should not happen. Deleting a deliverable nulls the attribution
 * through the foreign key, so a non-null `deliverableId` is a line the project
 * still has — but the titles come from the list the page read, and a line
 * added or dropped between that read and this render would not be in it.
 * Rendering that as `project` would be the one wrong answer: it would tell the
 * reader this hour went against nothing in particular, which is a claim about
 * the work rather than about the page.
 */
export type EntryAttribution =
  | { readonly kind: "project" }
  | { readonly kind: "deliverable"; readonly title: string }
  | { readonly kind: "unknown" };

/** What naming an attribution needs of a deliverable: its id and its title. */
export type NamedDeliverable = {
  readonly id: string;
  readonly title: string;
};

/**
 * Where an entry went, named from the scope list the page already read.
 *
 * Resolved against that list rather than by a query per row, which is what
 * keeps a page showing forty entries at one round trip — and what makes the
 * title in the row the same title the attribution picker offered, rather than
 * two reads that can disagree.
 */
export function entryAttribution(
  entry: Pick<ListedTimeEntry, "deliverableId">,
  deliverables: readonly NamedDeliverable[],
): EntryAttribution {
  if (entry.deliverableId === null) return { kind: "project" };

  const found = deliverables.find((one) => one.id === entry.deliverableId);
  if (found === undefined) return { kind: "unknown" };
  return { kind: "deliverable", title: found.title };
}

/**
 * What an unattributed entry's row says, in the words that make it an answer
 * rather than a gap.
 *
 * "The project itself" rather than a dash or an empty cell. A column of
 * durations with blanks down the side of it reads as a list somebody has not
 * finished filling in, and the fix a reader reaches for is to attribute the
 * work to whichever line looks closest — which is how a scope comparison
 * starts lying.
 */
export const PROJECT_ITSELF_LABEL = "The project itself";

/**
 * What a row says about a line of scope the page cannot name.
 *
 * It says what is true — this page could not find it — rather than guessing at
 * why. The usual cause is a deliverable deleted between the read that built
 * the scope list and the read that fetched the entries, but a reader does not
 * need the diagnosis: they need to know the attribution exists and that this
 * page is not showing it, which reloading fixes.
 */
export const UNSHOWN_DELIVERABLE_LABEL = "A deliverable this page cannot show";

/** Where the work went, as the row's own line of text. */
export function attributionLabel(where: EntryAttribution): string {
  if (where.kind === "deliverable") return where.title;
  if (where.kind === "unknown") return UNSHOWN_DELIVERABLE_LABEL;
  return PROJECT_ITSELF_LABEL;
}

/**
 * The same thing as a clause inside a sentence: "logged against …".
 *
 * A separate function rather than lower-casing the label, because the two
 * differ by more than a capital. A title is quoted here and not there — in a
 * sentence the quotes are what stop "against Build on Oct 17" from reading as
 * one phrase, and in a column of its own the title is obviously a title and
 * the quotes are clutter.
 */
export function attributionPhrase(where: EntryAttribution): string {
  if (where.kind === "deliverable") return `“${where.title}”`;
  if (where.kind === "unknown") return "a deliverable this page cannot show";
  return "the project itself";
}

/**
 * What a note-less entry's row says where the note would be.
 *
 * Said rather than left blank, because the gap is the one worth noticing: a
 * note is what an invoice line gets written from, and an entry without one is
 * forty minutes nobody will be able to account for in three months. Naming the
 * absence is how a reader scanning the list spots the ones to go back and
 * fill in.
 */
export const NO_NOTE_LABEL = "No note";

/**
 * The marks on an entry that are not its duration: whether it will be charged
 * for, and whether it already has been.
 *
 * Both, rather than one taking precedence, and they can appear together. An
 * entry that is billed and marked non-chargeable is a contradiction nothing in
 * this app can produce — `markTimeEntryBilled` only accepts billable time —
 * and precisely because of that, a row that holds both is a row worth looking
 * at rather than one to simplify into whichever fact seemed more important.
 *
 * Nothing is said about the ordinary case. A chargeable, unbilled entry is
 * what every entry is, and a mark on all of them is a mark that says nothing.
 */
export function entryMarks(entry: ListedTimeEntry): string[] {
  const marks: string[] = [];
  if (entry.billable !== true) marks.push("Not chargeable");
  if (isBilled(entry)) marks.push("Billed");
  return marks;
}

/**
 * Whether this entry can still be changed.
 *
 * The rule is `isBilled` and nothing more, which is deliberately stricter than
 * the data layer's: `updateTimeEntry` lets a billed entry's note be corrected,
 * because no figure on any document comes from it. The list does not offer
 * that, because an edit form that accepts one field out of five and refuses
 * the rest is a form that looks broken — and the reader who opened it wanted
 * to fix the duration.
 */
export function canChangeEntry(entry: BillingSubject): boolean {
  return !isBilled(entry);
}

/**
 * Why an entry has no controls beside it, for the rows that have none.
 *
 * It says what to do about it, because "billed" on its own reads as a dead
 * end and it is not one: a credit note frees the time, after which the entry
 * is editable and deletable like any other. Phase 6 is where that door gets
 * built; until then this is the sentence that says it exists.
 */
export const BILLED_ENTRY_NOTE =
  "An invoice has billed this time, so it can no longer be edited or deleted. A credit note frees it again.";

/**
 * How much of a note goes into a button's name.
 *
 * Enough to tell two entries apart and not enough to read aloud as a
 * paragraph. A note can be five hundred characters, and a Delete button whose
 * accessible name is five hundred characters is a button nobody can skip past.
 */
const NOTE_IN_NAME = 60;

/** A note cut to fit, with an ellipsis saying that is what happened. */
function shortened(note: string): string {
  if (note.length <= NOTE_IN_NAME) return note;
  return `${note.slice(0, NOTE_IN_NAME).trimEnd()}…`;
}

/**
 * One entry named well enough to be acted on, which is the hard part of
 * listing things that have no title.
 *
 * Every control beside a row carries this: a list of nine entries would
 * otherwise hold nine buttons reading "Edit" and nine reading "Delete", and
 * anybody working through the controls rather than the rows would be choosing
 * blind. The step in front of a deletion says it too, because that is the
 * sentence a reader checks before pressing the button that cannot be undone.
 *
 * Four parts, in the order they distinguish entries. The duration and the day
 * come first because they are what an entry *is*. The attribution follows,
 * because a day's work is usually spread across two or three lines of scope.
 * The note comes last and only when there is one — two identical half-hours
 * against the same line on the same day are an ordinary thing to log, and the
 * note is then the only thing that tells them apart.
 */
export function entryName(
  entry: ListedTimeEntry,
  where: EntryAttribution,
): string {
  const named = `${formatMinutes(entry.minutes)} on ${formatDate(
    entry.workedOn,
  )} against ${attributionPhrase(where)}`;
  if (entry.note === null) return named;

  const note = entry.note.trim();
  if (note === "") return named;
  return `${named}, ${shortened(note)}`;
}
