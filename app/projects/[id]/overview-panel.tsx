import type { ReactNode } from "react";

import { summariseBurn } from "@/lib/burn";
import { burnDownReadings } from "@/lib/burndown/reading";
import type { ProjectWithClient } from "@/lib/data/projects";
import type {
  BurnSnapshot,
  Deliverable,
  ProjectStatusEvent,
} from "@/lib/db/schema";
import { formatDate } from "@/lib/dates";
import { describeRateOverride } from "@/lib/projects/detail";
import type { DuplicateFormState } from "@/lib/projects/duplicate-form";
import { resolveJoinedRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

import { writeDuplicatedProject } from "./duplicate-writes";

import { BurnDownPanel } from "./burn-down-panel";
import { BurnPanel } from "./burn-panel";
import { ScopeHealthBanner } from "./scope-health-banner";
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
 * bills at, when the row was set up and last touched, what the hours have
 * burned of the contract, the status trail, where the status is moved on from,
 * and where the whole thing is copied.
 */
export function OverviewPanel({
  project,
  statusEvents,
  timeTotals,
  scopeLines,
  burnSnapshots,
  today,
}: {
  project: ProjectWithClient;
  /** The project's status trail, newest first. */
  statusEvents: readonly ProjectStatusEvent[];
  /**
   * What this project's time entries come to: the three figures the burn is
   * built from.
   *
   * Totalled in SQL by the page rather than read row by row here, because the
   * burn needs two sums and no entry — a year of rows crossing a wire so that
   * four figures can be printed is a cost paid on every page load.
   */
  timeTotals: LoggedTotals;
  /**
   * The project's scope list, which carries the delivery half of the scope
   * health verdict.
   *
   * The rows rather than a share, because what makes a delivered share
   * trustworthy is four counts over the same list, and a panel handed one
   * number could not tell a finished project from one where the only sized
   * line happens to be the only finished one.
   *
   * The duplicate control's count comes off it too. It wants a number and
   * nothing else, and a second prop carrying the length of a list already in
   * hand is a figure that can disagree with the list beside it.
   */
  scopeLines: readonly Deliverable[];
  /**
   * The project's stored burn readings, oldest first: one row per day its
   * burn was measured or reconstructed.
   *
   * The rows rather than a chart, because turning a row into a point is a
   * decision about how much to trust it — `burnDownReadings` drops a day that
   * is not a day and reads an unknown origin as a reconstruction — and that
   * decision belongs beside the arithmetic rather than in the query.
   */
  burnSnapshots: readonly BurnSnapshot[];
  /**
   * The day this page is being rendered on, for judging how old the end of
   * the burn-down is.
   *
   * Passed in rather than read here, so the one reading of the clock the page
   * takes is the one every panel on it uses — a chart that said the line was
   * three days old while the timer beside it had rolled over midnight would
   * be two different todays on one screen.
   */
  today: string;
}) {
  /*
    Built here rather than by the page, the same arrangement the time tab
    keeps with its rollup: the page reads rows and this panel decides what they
    add up to. Three numbers from three places, and the rate goes through
    `resolveJoinedRate` so that the override, the client's default and the gap
    between them are decided in the one file that explains the difference.
  */
  const burn = summariseBurn(
    timeTotals,
    project.contractValueCents,
    resolveJoinedRate(project),
  );

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
      {/*
        First on the tab, because it is the only thing on the page that reaches
        a conclusion and everything under it is the working. A reader who opens
        a project wants to know whether to worry before they want to know what
        rate it bills at.
      */}
      <ScopeHealthBanner summary={burn} lines={scopeLines} />
      <dl className="mt-4 text-sm">
        <Fact term="Rate">{describeRateOverride(project.rateCents)}</Fact>
        <Fact term="Set up">{formatDate(project.createdAt)}</Fact>
        <Fact term="Last changed">{formatDate(project.updatedAt)}</Fact>
      </dl>
      {/*
        Directly under the record, because the rate it values the hours at is
        the row above it and a reader who finds the burn surprising looks
        upwards first. Above the history, which is the same order the rest of
        the tab keeps: what is true now, then what has happened.
      */}
      <BurnPanel summary={burn} />
      {/*
        Directly under the figures it is the history of. A reader who finds the
        share surprising looks at the shape next: the same 60% consumed means
        one thing over five months and another over a fortnight, and the panel
        above cannot tell them apart.
      */}
      <BurnDownPanel
        projectId={project.id}
        readings={burnDownReadings(burnSnapshots)}
        today={today}
      />
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
        clientName={project.clientName}
        clientArchivedAt={project.clientArchivedAt}
        deliverableCount={scopeLines.length}
        duplicate={duplicate}
      />
    </>
  );
}
