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
