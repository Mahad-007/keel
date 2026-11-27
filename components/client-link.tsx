import Link from "next/link";

import { clientEditPath } from "@/lib/clients/detail";

/**
 * A client's name, as a cell of a table about their work.
 *
 * Two tables show one: the projects list and the portfolio. They are different
 * pages asking different questions and they want exactly the same cell — the
 * name, linked, with a word beside it when the client is off the books — so it
 * is one component rather than two that would drift in the detail that matters
 * least and be noticed last.
 *
 * It links to the edit form because there is no read-only client page in this
 * app; `clientEditPath` says so where it is defined.
 */
export function ClientLink({
  id,
  name,
  archivedAt,
}: {
  id: string;
  name: string;
  /** When the client was archived, or null while they are on the books. */
  archivedAt: string | null;
}) {
  return (
    <>
      <Link
        href={clientEditPath(id)}
        className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
      >
        {name}
      </Link>
      {/*
        An archived client keeps their projects — the work happened, and an
        active engagement for them is still running — but the name on its own
        would read as a live client. Saying so here explains why they are
        missing from the client book.
      */}
      {archivedAt !== null && (
        <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-500">
          (archived)
        </span>
      )}
    </>
  );
}
