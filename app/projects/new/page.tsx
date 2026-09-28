import type { Metadata } from "next";
import Link from "next/link";

import { projectClientOptions } from "@/lib/clients/picker";
import { PROJECTS_PATH } from "@/lib/projects/query";

import { NewProjectForm } from "./project-form";

/**
 * Read at request time. The picker is a list of clients, and a page holding a
 * copy of that list from deploy time would offer a client who has since been
 * archived while hiding one created this morning.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New project · Keel",
};

export default async function NewProjectPage() {
  const clients = await projectClientOptions();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link
          href={PROJECTS_PATH}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          New project
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A client and a name are all that is required. The project starts as a
          draft, and the contract value is the figure everything later — burn,
          creep, what a change order is worth — is measured against.
        </p>
      </header>

      <NewProjectForm clients={clients} />
    </main>
  );
}
