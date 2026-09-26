import Link from "next/link";
import type { ReactNode } from "react";

import {
  projectsHref,
  withSortColumn,
  type ProjectsQuery,
} from "@/lib/projects/query";
import { ariaSortFor, type ProjectSortColumn } from "@/lib/projects/sort";

/**
 * Which way the sorted column runs, shown as an arrow rather than a shaded
 * header: a reader glancing at the table should be able to tell descending
 * from ascending without comparing two dates. Hidden from screen readers,
 * which get the same fact from `aria-sort` on the cell.
 */
const ARROWS = { ascending: "\u2191", descending: "\u2193", none: "" } as const;

/**
 * A column header that sorts the list.
 *
 * It is a link, not a button: the sort lives in the URL, so the header can be
 * middle-clicked, copied, and followed with JavaScript off, and the page stays
 * a server component. `aria-sort` on the cell is what tells a screen reader
 * which column the rows are actually in.
 */
export function SortableHeader({
  query,
  column,
  className = "",
  children,
}: {
  query: ProjectsQuery;
  column: ProjectSortColumn;
  className?: string;
  children: ReactNode;
}) {
  const sorted = ariaSortFor(query.sort, column);

  return (
    <th
      scope="col"
      aria-sort={sorted}
      className={`py-2 font-medium ${className}`}
    >
      <Link
        href={projectsHref(withSortColumn(query, column))}
        className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {children}
        <span aria-hidden="true" className="w-2 text-xs">
          {ARROWS[sorted]}
        </span>
      </Link>
    </th>
  );
}
