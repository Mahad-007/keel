import { notFound } from "next/navigation";

import { getProjectWithClient } from "@/lib/data/projects";
import { parseProjectTabParam } from "@/lib/projects/detail";

import { OverviewPanel } from "./overview-panel";
import { ProjectHeader } from "./project-header";
import { ProjectTabs } from "./project-tabs";
import { UnbuiltTabPanel } from "./unbuilt-panel";

/**
 * Read at request time. A project is the page most likely to be open while
 * something about it is changing, and a version cached at build time would
 * show a contract value that had already moved.
 */
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await getProjectWithClient(id);

  // Projects are deleted outright rather than archived, so a missing id means
  // the row is gone for good — there is no archive to send the reader to.
  if (project === null) notFound();

  const tab = parseProjectTabParam(await searchParams);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 font-sans">
      <ProjectHeader project={project} />
      <ProjectTabs projectId={project.id} current={tab} />
      {/*
        Overview is the only tab with anything behind it today. The other four
        say so themselves rather than rendering an empty box, and each one drops
        out of here as the phase that builds it lands.
      */}
      {tab === "overview" ? (
        <OverviewPanel project={project} />
      ) : (
        <UnbuiltTabPanel tab={tab} />
      )}
    </main>
  );
}
