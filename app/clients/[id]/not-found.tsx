import Link from "next/link";

/**
 * Reached when a client id resolves to nothing. Archiving is a soft delete,
 * so an archived client is still found — which makes this page mean something
 * precise: there is no row with that id at all, and the archive is not where
 * to go looking for it.
 */
export default function ClientNotFound() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        No such client
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Nothing in the database has this id. Archived clients are still here
        and still open from the archive, so this is a link that has outlived
        its client rather than one that was hidden.
      </p>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link
          href="/clients"
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
        >
          All clients
        </Link>
        <Link
          href="/clients/archived"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Archived clients
        </Link>
      </div>
    </main>
  );
}
