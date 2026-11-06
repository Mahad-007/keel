import type { Metadata } from "next";
import Link from "next/link";

import { CaveatNote } from "@/components/form";
import { listProjectsWithClient } from "@/lib/data/projects";
import { listFilteredTimeEntries } from "@/lib/data/time-entries";
import { utcCalendarDate } from "@/lib/dates";
import { PROJECTS_PATH } from "@/lib/projects/query";
import { describeLog, describeLogScope, summarizeLog } from "@/lib/time/log";
import {
  clientFilterOptions,
  describeMissingFilters,
  projectFilterOptions,
  resolveLogFilters,
} from "@/lib/time/log-options";
import {
  isFilteredLog,
  logEntryFilter,
  parseTimeLogQuery,
  TIME_LOG_PATH,
} from "@/lib/time/log-query";
import { backwardsEnds } from "@/lib/time/range";
import { TIMESHEET_PATH } from "@/lib/time/week-query";

import { NoMatchingTime, NoTimeLogged } from "./empty-log";
import { ExportLink } from "./export-link";
import { FilterForm } from "./filter-form";
import { LogTable } from "./log-table";
import { RangePresets } from "./range-presets";
import { BackwardsRange, MismatchedFilters } from "./range-notes";

/**
 * Read at request time. Every filter comes off the URL and one of the presets
 * is measured from today, so there is nothing to prerender — a log cached at
 * deploy time would be a ledger from before the release.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Time log · Keel",
};

export default async function TimeLogPage({
  searchParams,
}: PageProps<"/time/entries">) {
  /*
    Today, in UTC, for the reason `utcCalendarDate` gives: a server has no
    reader's clock. Only the presets are measured from it, and a reader who
    disagrees with the day it picked can type the range they meant.
  */
  const today = utcCalendarDate(new Date());
  const query = parseTimeLogQuery(await searchParams);

  /*
    Two queries, not one. The entries are the filtered log; the projects are
    what the two pickers offer and what names a client whose own filter is in
    force, which has to include projects the filters exclude — otherwise
    narrowing to one project would empty the picker that narrowed it. They are
    independent, so they go in parallel.
  */
  const [projects, entries] = await Promise.all([
    listProjectsWithClient(),
    listFilteredTimeEntries(logEntryFilter(query)),
  ]);

  const clients = clientFilterOptions(projects);
  const projectOptions = projectFilterOptions(projects, query.clientId);

  /*
    What the two id filters actually name, against every project rather than
    against the narrowed picker — which is what tells a project that has been
    deleted from one belonging to a client this log excludes. Both show up as
    an empty log and neither is visible in the controls, so the page has to say
    which it is.
  */
  const resolved = resolveLogFilters(query, projects);
  const missing = describeMissingFilters(resolved);

  const summary = summarizeLog(entries);
  const scope = describeLogScope({
    range: query.range,
    billable: query.billable,
    project: resolved.project,
    client: resolved.client,
  });

  const filtered = isFilteredLog(query);
  const backwards = backwardsEnds(query.range);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 font-sans">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Time log
          </h1>
          {/*
            Two lines, and they are not the same fact. The first says what is
            being shown — every filter in force, in the order they narrow — and
            the second says what it came to. A total with no scope above it is
            the figure somebody quotes at a client by mistake.
          */}
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {scope}
            </span>
            {` · ${describeLog(summary)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <ExportLink query={query} entries={entries.length} />
          {filtered ? (
            <Link
              href={TIME_LOG_PATH}
              className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Clear filters
            </Link>
          ) : null}
          <Link
            href={TIMESHEET_PATH}
            className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Timesheet
          </Link>
          <Link
            href={PROJECTS_PATH}
            className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Projects
          </Link>
        </div>
      </header>

      <RangePresets query={query} today={today} />

      <FilterForm query={query} projects={projectOptions} clients={clients} />

      {backwards === null ? null : (
        <BackwardsRange query={query} range={backwards} />
      )}
      {missing === null ? null : (
        <CaveatNote className="mt-4">{missing}</CaveatNote>
      )}
      {resolved.mismatched ? (
        <MismatchedFilters query={query} resolved={resolved} />
      ) : null}

      {/*
        Three outcomes, and they are not the same page. Rows are rows; a studio
        that has logged nothing needs telling what the log is for; and filters
        that hid everything need the way back out. Deciding between the last
        two on whether anything is filtered rather than on a second count keeps
        the explanation for the case that is actually that — and a total of
        zero from a second query could disagree with the rows on screen.
      */}
      {entries.length > 0 ? (
        <LogTable entries={entries} query={query} />
      ) : filtered ? (
        <NoMatchingTime clearHref={TIME_LOG_PATH} />
      ) : (
        <NoTimeLogged />
      )}
    </main>
  );
}
