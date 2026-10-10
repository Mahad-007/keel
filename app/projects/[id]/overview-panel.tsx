import type { ReactNode } from "react";

import type { ProjectWithClient } from "@/lib/data/projects";
import type { ProjectStatusEvent } from "@/lib/db/schema";
import { formatDate } from "@/lib/dates";
import { describeRateOverride } from "@/lib/projects/detail";
import type { DuplicateFormState } from "@/lib/projects/duplicate-form";

import { writeDuplicatedProject } from "./duplicate-writes";

import { DuplicateSection } from "./duplicate-section";
import { StatusHistory } from "./status-history";
import { StatusSection } from "./status-section";

/**
 * One row of the record: a label and the fact under it.
 *
 * A definition list rather than a table, because these are one project's
 * attributes and not a set of rows to compare — and the labelling a `dl` gives
 * is what makes "Rate" and the sentence after it read as a pair when the two
 * are not side by side on a narrow screen.
 */
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 border-b border-zinc-100 py-2.5 sm:grid-cols-[9rem_1fr] dark:border-zinc-900">
      <dt className="text-zinc-500 dark:text-zinc-400">{term}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

/**
 * The overview tab: everything the project itself records, as opposed to what
 * gets logged against it later.
 *
 * The header already carries the three facts that matter at a glance — client,
 * status, contract value — so this is deliberately the rest: the rate the work
 * bills at, when the row was set up and last touched, the status trail, where
 * the status is moved on from, and where the whole thing is copied.
 */
export function OverviewPanel({
  project,
  statusEvents,
  deliverableCount,
}: {
  project: ProjectWithClient;
  /** The project's status trail, newest first. */
  statusEvents: readonly ProjectStatusEvent[];
  /** How many deliverables a copy of this project would carry over. */
  deliverableCount: number;
}) {
  /*
    The project is captured here rather than bound onto the write, for the same
    reason the scope tab's presses are: `.bind` serialises what it carries in
    the clear, so the project that got copied would be whatever the caller
    sent. A `"use server"` function declared in a server component is the form
    the compiler rewrites to encrypt its captured variables.
  */
  async function duplicate(
    previous: DuplicateFormState,
    formData: FormData,
  ): Promise<DuplicateFormState> {
    "use server";
    return writeDuplicatedProject(project.id, previous, formData);
  }

  return (
    <>
      <dl className="mt-4 text-sm">
        <Fact term="Rate">{describeRateOverride(project.rateCents)}</Fact>
        <Fact term="Set up">{formatDate(project.createdAt)}</Fact>
        <Fact term="Last changed">{formatDate(project.updatedAt)}</Fact>
      </dl>
      {/*
        History before the controls, for the same reason the archive sits at
        the bottom of a client form: a reader arrives wanting to know what has
        happened, and the thing that changes the project should be below the
        thing that describes it.
      */}
      <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          History
        </h3>
        <StatusHistory events={statusEvents} />
      </section>
      <StatusSection project={project} />
      <DuplicateSection
        projectName={project.name}
        deliverableCount={deliverableCount}
        duplicate={duplicate}
      />
    </>
  );
}
