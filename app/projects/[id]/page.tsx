import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { listProjectStatusEvents } from "@/lib/data/project-status-events";
import { getProjectWithClient } from "@/lib/data/projects";
import { parseProjectTabParam } from "@/lib/projects/detail";
import { PROJECT_TAB_LABELS } from "@/lib/projects/tabs";

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

/** Ties the panel below the tabs to the heading that names it. */
const TAB_HEADING_ID = "project-tab-heading";

/**
 * The page and its title both need the project, and Next calls
 * `generateMetadata` and the component separately. `cache` makes the second
 * call of a request a lookup rather than a second round trip — and guarantees
 * the two agree, so the tab cannot end up titled after a name the body no
 * longer shows.
 */
const loadProject = cache(getProjectWithClient);

export async function generateMetadata({
  params,
}: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await loadProject(id);
  // A browser tab is often the only thing distinguishing two open projects, so
  // the name leads and the product name follows, as everywhere else.
  if (project === null) return { title: "No such project · Keel" };
  return { title: `${project.name} · Keel` };
}

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await loadProject(id);

  // Projects are deleted outright rather than archived, so a missing id means
  // the row is gone for good — there is no archive to send the reader to.
  if (project === null) notFound();

  const tab = parseProjectTabParam(await searchParams);

  /*
    Only the overview reads the status trail, so only the overview pays for
    it: the other four tabs render a sentence apiece and have no business
    running a second query to do it.
  */
  const statusEvents =
    tab === "overview" ? await listProjectStatusEvents(project.id) : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 font-sans">
      <ProjectHeader project={project} />
      <ProjectTabs projectId={project.id} current={tab} />
      {/*
        Overview is the only tab with anything behind it today. The other four
        say so themselves rather than rendering an empty box, and each one drops
        out of here as the phase that builds it lands.
      */}
      <section aria-labelledby={TAB_HEADING_ID}>
        {/*
          The tab row is a set of links, so nothing in the markup otherwise says
          which one the content below belongs to. A heading does, and keeping it
          visually hidden avoids repeating on screen the word that is already
          underlined an inch above it.
        */}
        <h2 id={TAB_HEADING_ID} className="sr-only">
          {PROJECT_TAB_LABELS[tab]}
        </h2>
        {tab === "overview" ? (
          <OverviewPanel project={project} statusEvents={statusEvents} />
        ) : (
          <UnbuiltTabPanel tab={tab} />
        )}
      </section>
    </main>
  );
}
