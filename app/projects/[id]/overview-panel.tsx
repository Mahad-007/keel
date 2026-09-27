import type { ReactNode } from "react";

import type { ProjectWithClient } from "@/lib/data/projects";
import { formatDate } from "@/lib/dates";
import { describeRateOverride } from "@/lib/projects/detail";

/**
 * One row of the record: a label and the fact under it.
 *
 * A definition list rather than a table, because these are one project's
 * attributes and not a set of rows to compare — and the labelling a `dl` gives
 * is what makes "Rate" and the sentence after it read as a pair when the two
 * are not side by side on a narrow screen.
 */
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 border-b border-zinc-100 py-2.5 sm:grid-cols-[9rem_1fr] dark:border-zinc-900">
      <dt className="text-zinc-500 dark:text-zinc-400">{term}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

/**
 * The overview tab: everything the project itself records, as opposed to what
 * gets logged against it later.
 *
 * The header already carries the three facts that matter at a glance — client,
 * status, contract value — so this is deliberately the rest: the rate the work
 * bills at, and when the row was set up and last touched.
 */
export function OverviewPanel({ project }: { project: ProjectWithClient }) {
  return (
    <dl className="mt-4 text-sm">
      <Fact term="Rate">{describeRateOverride(project.rateCents)}</Fact>
      <Fact term="Set up">{formatDate(project.createdAt)}</Fact>
      <Fact term="Last changed">{formatDate(project.updatedAt)}</Fact>
    </dl>
  );
}
