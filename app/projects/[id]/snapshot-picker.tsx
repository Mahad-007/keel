import Link from "next/link";

import { snapshotComparisonHref } from "@/lib/snapshots/selection";
import {
  snapshotSizeLabel,
  snapshotTakenLabel,
  type SummarisedSnapshot,
} from "@/lib/snapshots/summary";

/**
 * Which snapshot the comparison is against, and the others it could be.
 *
 * One link per snapshot, newest first, each pointing at the same scope tab
 * comparing against that one. Links rather than a `<select>` and a submit, so
 * choosing is a navigation: no client JavaScript, the back button works, and a
 * comparison is an address that can be sent to the person arguing about it.
 *
 * A column rather than a row of tabs. A label is a short sentence and a date
 * is six more characters, so four of them across a page wrap into something
 * that no longer reads as a set of choices — and the list is a history, which
 * is a thing people read downwards.
 *
 * Nothing is rendered when there is one snapshot: there is nothing to choose
 * between, and the comparison's own heading already says which snapshot it is
 * against. A list of one option is a control that asks a question with one
 * answer.
 */
export function SnapshotPicker({
  projectId,
  snapshots,
  currentId,
}: {
  projectId: string;
  /** Every snapshot of this project, newest first, each with its size. */
  snapshots: readonly SummarisedSnapshot[];
  /** The one being compared against, which is marked rather than removed. */
  currentId: string;
}) {
  if (snapshots.length < 2) return null;

  return (
    <nav
      aria-label="Snapshots of this project's scope"
      className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900"
    >
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Compare against
      </h4>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {snapshots.map((snapshot) => {
          const current = snapshot.id === currentId;
          return (
            <li key={snapshot.id}>
              <Link
                href={snapshotComparisonHref(projectId, snapshot.id)}
                /*
                  `page`, the token the project tabs use, rather than `true`.
                  Each of these links is the address of this same page showing
                  one comparison, so the one being read is the current page in
                  a set of them — which is what a screen reader announces from
                  the token, where `true` says only "this one, somehow".
                */
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
                }
              >
                {snapshotTakenLabel(snapshot)}
              </Link>{" "}
              {/*
                The size follows the label in secondary text, because it is
                what settles a choice between two snapshots whose labels look
                alike — and because a list of four sizes is where a reader
                notices the scope list doubling without opening anything.
              */}
              <span className="text-zinc-500 dark:text-zinc-500">
                · {snapshotSizeLabel(snapshot)}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
