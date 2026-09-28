import { describeNoMatches } from "@/lib/projects/filter";
import { NEW_PROJECT_PATH } from "@/lib/projects/query";
import { projectStatusLabel, type ProjectStatus } from "@/lib/projects/status";

import { EmptyPanel } from "./empty-panel";

/**
 * Nothing in the table because there is nothing in the database.
 *
 * The panel spends its words on what a project is for, because this is the
 * first thing somebody sees on the page and "no projects" on its own does not
 * tell them what they would be creating or why it matters.
 */
export function NoProjects() {
  return (
    <EmptyPanel
      heading="No projects yet."
      action={{ href: NEW_PROJECT_PATH, label: "New project" }}
    >
      <p>
        A project is one engagement for one client: the thing scope is agreed
        on, time is logged against, and creep is measured against. It carries
        the value you contracted for, and bills at the client&rsquo;s default
        rate unless it sets an override of its own.
      </p>
      <p>
        Every project hangs off a client, so the form asks for one first. If the
        client book is empty it will say so and send you there.
      </p>
    </EmptyPanel>
  );
}

/**
 * Nothing in the table because the status filter excluded all of it. A
 * different state from `NoProjects` on purpose: the reaction to "no work" is
 * not the reaction to "work you cannot see", and the way out is a link that
 * clears the filter rather than anything to do with creating a project.
 */
export function NoMatchingProjects({
  status,
  total,
  clearHref,
}: {
  status: ProjectStatus;
  /** Every project, not just the ones shown, which is the point being made. */
  total: number;
  clearHref: string;
}) {
  return (
    <EmptyPanel
      heading={`No ${projectStatusLabel(status).toLowerCase()} projects.`}
      action={{ href: clearHref, label: "Show all projects" }}
    >
      <p>
        {describeNoMatches(status, total)} The status filter is hiding them, not
        the absence of work.
      </p>
    </EmptyPanel>
  );
}
