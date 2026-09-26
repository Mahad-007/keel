import Link from "next/link";
import type { ReactNode } from "react";

import { describeNoMatches } from "@/lib/projects/filter";
import { projectStatusLabel, type ProjectStatus } from "@/lib/projects/status";

/**
 * The shape both empty states share: a dashed panel, a heading that names the
 * situation, a paragraph or two explaining it, and one way out. Shared so the
 * two states can differ in what they say without also drifting in how they
 * look — a page where the empty panels are subtly different sizes reads as a
 * mistake.
 */
function EmptyPanel({
  heading,
  action,
  children,
}: {
  heading: string;
  action: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mt-4 rounded border border-dashed border-zinc-300 px-6 py-10 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {heading}
      </p>
      <div className="mt-1 max-w-prose space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
      <Link
        href={action.href}
        className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
      >
        {action.label}
      </Link>
    </div>
  );
}

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
      action={{ href: "/clients", label: "Go to clients" }}
    >
      <p>
        A project is one engagement for one client: the thing scope is agreed
        on, time is logged against, and creep is measured against. It carries
        the value you contracted for, and bills at the client&rsquo;s default
        rate unless it sets an override of its own.
      </p>
      <p>
        There is no form for adding one yet. Every project hangs off a client,
        so the client book is the place to start.
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
