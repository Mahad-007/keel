import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The tab you are on is marked twice over: `aria-current` so a screen reader
 * says so, and a solid underline so everyone else can see it. A tab row where
 * the current tab is not obvious is worse than no tab row, because whatever is
 * below it then reads as the whole page rather than one slice of it.
 */
const CURRENT_TAB =
  "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100";

const OTHER_TAB =
  "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100";

/**
 * A row of tabs: the status filter on the list, the sections on a project.
 *
 * Shared because two tab rows that are subtly different heights or sit on
 * different rules read as two different kinds of control, when they are the
 * same control pointed at different things.
 */
export function TabBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="mt-6">
      <ul className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {children}
      </ul>
    </nav>
  );
}

/**
 * One tab. A link rather than a button, so the state it selects lives in the
 * URL: no client JavaScript, the back button works, and a tab is an address
 * that can be sent to somebody else.
 */
export function TabLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`-mb-px inline-block border-b-2 px-3 py-2 text-sm ${current ? CURRENT_TAB : OTHER_TAB}`}
      >
        {children}
      </Link>
    </li>
  );
}
