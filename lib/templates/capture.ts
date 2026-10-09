/**
 * Taking a project's scope list and turning it into a template.
 *
 * The interesting part is not the copying, it is the deciding: three of a
 * deliverable's columns describe the work and three describe the engagement it
 * was agreed for, and a template that carried the second three would hand the
 * next project somebody else's history. So the choice is made once, here, as a
 * pure function over plain fields — testable without a database and read by
 * both the data layer and the sentence the UI puts above the button.
 */

/**
 * What capturing a template reads off a deliverable.
 *
 * A structural subset of the row rather than `Deliverable`, the same shape as
 * `ScopeLine` in `lib/scope.ts` and for the same reason: a test should be able
 * to pass three fields, and nothing here needs an id, a project, or a position.
 */
export type CapturedDeliverable = {
  title: string;
  description: string | null;
  estimatedMinutes: number;
};

/**
 * One line of a template as it is about to be written.
 *
 * Deliberately the same three fields, and deliberately not more. `status` is
 * absent because a template describes work to be agreed: a template captured
 * off a project halfway through would otherwise arrive at the next engagement
 * with two lines already done. `sortOrder` is absent because the position is
 * the list's, not the line's — the data layer numbers them from zero as it
 * writes, so a source list with a gap in it still captures as 1, 2, 3.
 */
export type TemplateLineDraft = {
  readonly title: string;
  readonly description: string | null;
  readonly estimatedMinutes: number;
};

/**
 * A project's scope list as the lines of a template.
 *
 * The order is preserved exactly — a scope list is read in the sequence the
 * two parties agreed it in, and that sequence is most of what makes the list
 * worth saving. Nothing is filtered: a line nobody estimated captures as a
 * zero, because an unestimated deliverable is still part of the shape of the
 * engagement, and leaving it out would make the template quietly smaller than
 * the project it was taken from.
 */
export function capturedTemplateLines(
  deliverables: readonly CapturedDeliverable[],
): TemplateLineDraft[] {
  return deliverables.map((deliverable) => ({
    title: deliverable.title,
    description: deliverable.description,
    estimatedMinutes: deliverable.estimatedMinutes,
  }));
}
