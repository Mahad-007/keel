/**
 * Taking a project and starting another one from it.
 *
 * The same engagement shape comes round again — the second site build for the
 * same client, next quarter's retainer, the brand refresh for the sister
 * company — and the parts of it that were decided are exactly the parts a
 * person does not want to decide twice: who it is for, what it is worth, what
 * it bills at, and the scope list that was argued over.
 *
 * The interesting part is not the copying, it is the deciding, so the decision
 * is made once, here, as pure functions over plain fields. A project row has
 * columns describing the agreement and columns recording what happened to it,
 * and a duplicate that carried the second kind would open claiming a history
 * it does not have. Nothing below touches a database, so what does and does
 * not cross over is testable on its own — which is the point, because "it
 * copied the wrong thing" is a bug nobody notices until a duplicate is being
 * invoiced.
 */

import { deliverablesPhrase } from "./scope-summary";

/**
 * What duplicating reads off the project row.
 *
 * A structural subset rather than `Project`, the same way `CapturedDeliverable`
 * is a subset of a deliverable: these are the three columns that cross over,
 * and a test should be able to hand over three fields without inventing an id,
 * a status and two timestamps to go with them.
 */
export type DuplicableProject = {
  clientId: string;
  contractValueCents: number;
  rateCents: number | null;
};

/**
 * A new project as duplication asks for it: the three columns carried over,
 * plus the name the copy is given.
 *
 * Deliberately short of six things the source row holds. `id` and the two
 * timestamps belong to the row rather than to the engagement. `status` is
 * absent so the copy opens as a draft — a duplicate of an active project has
 * not begun, and one taken off a closed project is the clearest case of all.
 * `startedAt` and `closedAt` follow from the status and are not copyable even
 * in principle: a project that starts today cannot have started in March.
 */
export type ProjectCopy = {
  readonly clientId: string;
  readonly name: string;
  readonly contractValueCents: number;
  readonly rateCents: number | null;
};

/**
 * The source project as the input for its copy.
 *
 * The name comes from the caller rather than from the source, because two
 * projects for one client with identical names is the state this feature would
 * otherwise create by default — and the thing that tells them apart in every
 * list in the app is the name. `suggestedDuplicateName` is where the box the
 * reader types it into gets its opening value.
 *
 * The rate override crosses over as it stands, null and zero included. Those
 * two mean different things — "bill at the client's rate" against "this one
 * does not bill by the hour" — and collapsing either into the other would
 * quietly change what the copy is worth per hour.
 */
export function copiedProject(
  project: DuplicableProject,
  name: string,
): ProjectCopy {
  return {
    clientId: project.clientId,
    name,
    contractValueCents: project.contractValueCents,
    rateCents: project.rateCents,
  };
}

/**
 * What duplicating reads off each line of the source project's scope.
 *
 * The same three fields a template line is captured from, and a subset of the
 * row for the same reason: these are the columns that describe the work rather
 * than the engagement it was agreed for.
 */
export type DuplicableDeliverable = {
  title: string;
  description: string | null;
  estimatedMinutes: number;
};

/**
 * One line of the copied scope list, as it is about to be written.
 *
 * `status` is absent, which is the deliberate part. A duplicate is the next
 * engagement, not a report on the last one: a copy of a project with four
 * lines marked done would arrive already claiming half the work, and its scope
 * summary would say three quarters delivered on a project nobody has started.
 * Every line opens as `pending`, which is what `createDeliverable` defaults to.
 *
 * `sortOrder` is absent because the position is the list's rather than the
 * line's — the data layer numbers them from zero as it writes, so the copy
 * reads in the order the source did.
 *
 * The decision is spelled out here rather than borrowed from
 * `capturedTemplateLines`, which today picks the same three columns. The two
 * have different reasons to change: a template describes work to be agreed,
 * and a duplicate is a second engagement of the same shape. The day one of
 * them starts carrying a fourth column is not the day the other should.
 */
export type DeliverableCopy = {
  readonly title: string;
  readonly description: string | null;
  readonly estimatedMinutes: number;
};

/**
 * The source project's scope list as the lines of its copy.
 *
 * The order is preserved exactly: a scope list is read in the sequence the two
 * parties agreed it in, and a copy that shuffled it would be a different
 * agreement to argue about. Nothing is filtered either — an unestimated line
 * copies as a zero, because a line nobody has estimated is still part of the
 * shape of the engagement, and leaving it out would make the copy quietly
 * smaller than the project it came from.
 */
export function copiedDeliverables(
  deliverables: readonly DuplicableDeliverable[],
): DeliverableCopy[] {
  return deliverables.map((deliverable) => ({
    title: deliverable.title,
    description: deliverable.description,
    estimatedMinutes: deliverable.estimatedMinutes,
  }));
}

/**
 * What pressing the button will copy, in words, for the project in front of
 * the reader.
 *
 * The count is the load-bearing part. "Copies the deliverables" is a promise
 * about a list the reader may not have looked at in a month, and the whole
 * risk of duplication is finding out afterwards that it brought over more or
 * fewer lines than you had in mind. A number in the sentence is checkable
 * against the scope tab before anything is written.
 *
 * It names the three project columns explicitly rather than saying "the
 * details", because one of them — the rate override — is the fact a copy is
 * most likely to be quietly wrong about, and the reader cannot see it from
 * here either.
 */
export function describeWhatIsCopied(deliverableCount: number): string {
  const carried =
    deliverableCount === 0
      ? "and the rate it bills at. This project has no deliverables yet, so the copy starts with an empty scope list."
      : `the rate it bills at, and all ${deliverablesPhrase(deliverableCount)} on the scope list.`;
  return `The copy is filed under the same client, for the same contract value, ${carried}`;
}

/**
 * What pressing the button will not copy.
 *
 * A constant, because it does not depend on the project: nothing recording
 * what happened to an engagement crosses over, whatever happened. It is worth
 * saying out loud rather than leaving to be discovered — a reader who assumes
 * the copy is a snapshot would look at a draft with an empty history and
 * conclude the duplicate failed.
 */
export const DUPLICATE_LEAVES_BEHIND =
  "Nothing recording what happened to this project comes with it. The copy opens as a draft with its own history and no dates on it, and every deliverable on it starts as pending — so the copy is the work as it was agreed, not the work as it has gone.";

/**
 * What to say when the project being copied belongs to a client who is off
 * the books, or null when they are not.
 *
 * Archiving a client hides them from the client list without unfiling their
 * projects, so this project is reachable and perfectly real. A copy of it is
 * a different thing: it is new work, and the form that creates new work from
 * scratch would not offer this client at all. Rather than refuse the copy —
 * re-quoting last year's engagement for a client you are about to restore is
 * a real reason to be here — it says what the copy will be, which is a draft
 * filed under somebody nobody can pick.
 *
 * It names the two ways out, because both are one press from here and neither
 * is obvious: restore the client, or change the copy's client afterwards.
 */
export function describeArchivedClientCopy(
  clientName: string,
  clientArchivedAt: string | null,
): string | null {
  if (clientArchivedAt === null) return null;
  return `${clientName} is archived, so the copy will be filed under a client who is off the client list. Restore them if this is work that is really happening, or change the copy's client once it exists.`;
}

/**
 * How many lines of the source list could not be written as deliverables of
 * the copy.
 *
 * Nothing the app does produces one. The form will not save a blank title or
 * a fractional estimate, so a line that fails here was written straight to the
 * database — and the data layer refuses it on the way back in, which is the
 * problem: it refuses by throwing, part-way through writing the copy. That
 * rolls the whole copy back, correctly, and reaches the reader as "nothing was
 * written, try again", which is advice for a different situation. Retrying
 * cannot fix a bad row.
 *
 * So the rule is checked up front, before anything is written, and the same
 * three things the column guards check: a title that is nothing but space, an
 * estimate that is not a whole number of minutes, and an estimate below zero.
 * A negative estimate counts here too even though it has its own answer — this
 * is the complete rule, and the caller asks the narrower question first
 * because it has the better sentence for it.
 */
export function uncopyableLineCount(
  lines: readonly DuplicableDeliverable[],
): number {
  return lines.filter(
    (line) =>
      line.title.trim() === "" ||
      !Number.isSafeInteger(line.estimatedMinutes) ||
      line.estimatedMinutes < 0,
  ).length;
}
