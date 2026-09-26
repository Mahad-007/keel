import Link from "next/link";

/**
 * Nothing in the table because there is nothing in the database.
 *
 * The panel spends its words on what a project is for, because this is the
 * first thing somebody sees on the page and "no projects" on its own does not
 * tell them what they would be creating or why it matters.
 */
export function NoProjects() {
  return (
    <div className="mt-4 rounded border border-dashed border-zinc-300 px-6 py-10 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        No projects yet.
      </p>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        A project is one engagement for one client: the thing scope is agreed
        on, time is logged against, and creep is measured against. It carries
        the value you contracted for, and bills at the client&rsquo;s default
        rate unless it sets an override of its own.
      </p>
      <p className="mt-3 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        There is no form for adding one yet. Every project hangs off a client,
        so the client book is the place to start.
      </p>
      <Link
        href="/clients"
        className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
      >
        Go to clients
      </Link>
    </div>
  );
}
