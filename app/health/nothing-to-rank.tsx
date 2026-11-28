import { EmptyPanel } from "@/components/empty-panel";
import { NO_ACTIVE_PROJECTS } from "@/lib/health/words";
import { NEW_PROJECT_PATH, PROJECTS_PATH } from "@/lib/projects/query";

/**
 * A portfolio with no table because the studio has no projects at all.
 *
 * Its own state rather than an empty table, because a seven-column table with
 * no rows says nothing: a reader cannot tell whether every engagement is fine,
 * the page is broken, or they are looking at the wrong thing. The way out is a
 * project, because there is nothing else to rank.
 */
export function NoProjectsToRank() {
  return (
    <EmptyPanel
      heading="No projects to rank."
      action={{ href: NEW_PROJECT_PATH, label: "New project" }}
    >
      <p>
        This page ranks every active engagement by how far its burn has run
        ahead of the work delivered, so it needs an engagement to rank. The
        verdict comes from a contract value, a rate and a scope list — which
        are all fields on a project.
      </p>
    </EmptyPanel>
  );
}

/**
 * A portfolio with no table because nothing the studio has is active.
 *
 * Different news from having no projects, and a different way out. The studio
 * has work on its books and none of it is running, so there is nothing a
 * verdict would be about this week.
 *
 * It says which statuses are left out, because the likeliest reason a reader
 * is looking at this panel is a project they expected to find — and the
 * likeliest reason it is missing is that it is still a draft.
 */
export function NothingActiveToRank() {
  return (
    <EmptyPanel
      heading={NO_ACTIVE_PROJECTS}
      action={{ href: PROJECTS_PATH, label: "All projects" }}
    >
      <p>
        A draft has not been agreed, a paused engagement is not accruing hours,
        and a closed one has whatever it ended up costing — none of the three
        is a project to watch this week, so none of them is ranked here.
      </p>
      <p>
        Setting a project active puts it on this page, which is what makes its
        scope something the studio is watching rather than something it will
        read about afterwards.
      </p>
    </EmptyPanel>
  );
}
