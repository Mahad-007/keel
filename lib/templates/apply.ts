import { nextSortOrder } from "@/lib/deliverables/order";

import type { TemplateLineDraft } from "./capture";

/**
 * Taking a template and turning it into deliverables on a project.
 *
 * The other half of `capture.ts`, and the two have to agree about what a
 * template is for: it is a starting point, not a replacement. Applying one
 * appends its lines to whatever scope the project already has, which is the
 * only behaviour that cannot lose work — a template that overwrote the list
 * would delete the two lines somebody had already typed, and there is nowhere
 * to put them back from.
 *
 * Pure, so what the preview on the page promises and what the transaction
 * writes are the same arithmetic.
 */

/**
 * A template line placed in a project's scope list: the three fields the line
 * carries, plus the position it lands at.
 *
 * The status is not here, and that is the applied list agreeing with the
 * template about it. A deliverable's status column has a default — `pending` —
 * and letting the column supply it means the applied line is pending because
 * new scope is pending, not because this function decided so.
 */
export type AppliedTemplateLine = TemplateLineDraft & {
  readonly sortOrder: number;
};

/**
 * The template's lines, positioned at the end of a list that currently stops
 * at `highestSortOrder` — the same `null`-means-empty convention the
 * deliverables data layer appends with, so a project with no scope yet starts
 * the applied lines at zero.
 *
 * The lines keep their own order. A template's sequence is the part of it that
 * took thought, and applying it in any other order would be applying a
 * different template.
 */
export function appliedTemplateLines(
  lines: readonly TemplateLineDraft[],
  highestSortOrder: number | null,
): AppliedTemplateLine[] {
  const start = nextSortOrder(highestSortOrder);
  return lines.map((line, offset) => ({
    title: line.title,
    description: line.description,
    estimatedMinutes: line.estimatedMinutes,
    sortOrder: start + offset,
  }));
}
