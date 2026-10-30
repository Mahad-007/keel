import { EmptyPanel } from "@/components/empty-panel";
import { NEW_PROJECT_PATH, PROJECTS_PATH } from "@/lib/projects/query";
import { describeWeek, type Week } from "@/lib/time/week";

/**
 * A week with no grid to draw because the studio has no projects at all.
 *
 * Its own state rather than an empty grid, because a seven-column table with
 * no rows in it says nothing: a reader cannot tell whether the week is quiet,
 * the page is broken, or they are looking at the wrong thing. The way out is a
 * project, since nothing can be logged against anything else.
 */
export function NoProjectsToSheet() {
  return (
    <EmptyPanel
      heading="No projects to put on a timesheet."
      action={{ href: NEW_PROJECT_PATH, label: "New project" }}
    >
      <p>
        A timesheet is a week of the studio&rsquo;s work laid out by project, so
        it needs a project to lay out. Time is always logged against one —
        that is what makes an hour chargeable to somebody.
      </p>
    </EmptyPanel>
  );
}

/**
 * A week with no grid because nothing the studio has is open for work, and
 * nothing was worked anyway.
 *
 * Different news from having no projects, and a different way out. The studio
 * has work on its books; none of it is active, so the sheet has no row it
 * could offer — and nothing was logged in this week either, which is what
 * rules out the one case that would have earned a row regardless.
 *
 * The week is named, because the most likely reading of this page is that the
 * reader has stepped back further than they meant to.
 */
export function NothingOpenThisWeek({ week }: { week: Week }) {
  return (
    <EmptyPanel
      heading={`Nothing to show for ${describeWeek(week)}.`}
      action={{ href: PROJECTS_PATH, label: "All projects" }}
    >
      <p>
        No project is active, and none was worked in this week. A paused, draft
        or closed project earns a row here only on a week it has hours in, so
        there is nothing to lay out.
      </p>
      <p>
        Setting a project active puts it on the sheet for every week, which is
        what makes it somewhere to log against.
      </p>
    </EmptyPanel>
  );
}
