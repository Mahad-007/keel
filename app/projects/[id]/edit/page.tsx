import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { projectClientOptions } from "@/lib/clients/picker";
import { getProject } from "@/lib/data/projects";
import { projectPath } from "@/lib/projects/detail";
import { projectFormStateFor } from "@/lib/projects/form";

import { EditProjectForm } from "./project-form";

/**
 * Read at request time, like the project page. A form served from a build-time
 * cache is a form that silently discards the last change made to the row.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit project · Keel",
};

export default async function EditProjectPage({
  params,
}: PageProps<"/projects/[id]/edit">) {
  const { id } = await params;
  const project = await getProject(id);

  // Projects are deleted outright rather than archived, so a missing id means
  // the row is gone for good. `not-found.tsx` beside the project page says so.
  if (project === null) notFound();

  /**
   * After the project, not alongside it: which clients this form may offer
   * depends on which one the project is already filed under, and the action
   * applies the same rule when the form comes back.
   */
  const clients = await projectClientOptions(project.clientId);
  const projectHref = projectPath(project.id);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link
          href={projectHref}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {project.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit project
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The contract value is what every later figure — burn, remaining, what
          a change order is worth — is measured against, so changing it changes
          what this project is judged by. Moving it to another client changes
          whose default rate it falls back to.
        </p>
        {/*
          Said here rather than left to be noticed: somebody arriving to close a
          project will look for the field, and four statuses and a lifecycle are
          not something a `<select>` on this form can be trusted with.
        */}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          The status is not on this form. Moving a project between draft, active,
          paused and closed has rules of its own, and those dates are recorded
          rather than typed.
        </p>
      </header>

      <EditProjectForm
        projectId={project.id}
        initialState={projectFormStateFor(project)}
        clients={clients}
        cancelHref={projectHref}
      />
    </main>
  );
}
