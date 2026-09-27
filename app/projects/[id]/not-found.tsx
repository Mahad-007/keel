import Link from "next/link";

/**
 * Reached when a project id resolves to nothing.
 *
 * Unlike a client, a project has no archive: closing one keeps it, and
 * deleting one is reserved for a row that should never have existed. So this
 * page can say something definite — the project is gone, and there is nowhere
 * else to look for it — rather than sending the reader off to check a second
 * list that will not have it either.
 */
export default function ProjectNotFound() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        No such project
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Nothing in the database has this id. Closed projects stay on the list
        with their time and their history intact, so this is not work that was
        hidden — it is a link that has outlived the project it pointed at.
      </p>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link
          href="/projects"
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
        >
          All projects
        </Link>
        <Link
          href="/clients"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Clients
        </Link>
      </div>
    </main>
  );
}
