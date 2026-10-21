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
