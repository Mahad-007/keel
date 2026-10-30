import type { Metadata } from "next";
import Link from "next/link";

import { listProjectsWithClient } from "@/lib/data/projects";
import { listTimeEntriesInRange } from "@/lib/data/time-entries";
import { utcCalendarDate } from "@/lib/dates";
import { PROJECTS_PATH } from "@/lib/projects/query";
import {
  buildTimesheet,
  describeTimesheet,
  isSheetEmpty,
} from "@/lib/time/timesheet";
import { describeWeek } from "@/lib/time/week";
import { parseTimesheetWeek } from "@/lib/time/week-query";

import { NoProjectsToSheet, NothingOpenThisWeek } from "./no-sheet";
import { TimesheetGrid } from "./timesheet-grid";
import { WeekNav } from "./week-nav";

/**
 * Read at request time. The week comes off the URL and the default week is
 * whichever one it is now, so there is nothing to prerender — a timesheet
 * cached at deploy time would be showing a week from before the release.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Timesheet · Keel",
};

export default async function TimePage({ searchParams }: PageProps<"/time">) {
  /*
    Today, in UTC, for the reason `utcCalendarDate` gives: a server has no
    reader's clock, and the week it picks is visible in the heading and
    replaceable from the URL the moment a reader disagrees with it.
  */
  const today = utcCalendarDate(new Date());
  const week = parseTimesheetWeek(await searchParams, today);

  /*
    Two queries, not one. Every project gets a row the week expects work on,
    whether or not it was worked, so the rows cannot come from the entries; and
    the entries are the week's across the whole studio, so they cannot come
    from the projects. They are independent, so they go in parallel.
  */
  const [projects, entries] = await Promise.all([
    listProjectsWithClient(),
    listTimeEntriesInRange({ from: week.start, to: week.end }),
  ]);

  const sheet = buildTimesheet(week, projects, entries);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 font-sans">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Timesheet
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {describeWeek(week)}
            </span>
            {" · "}
            {describeTimesheet(sheet)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={PROJECTS_PATH}
            className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Projects
          </Link>
        </div>
      </header>

      <WeekNav week={week} today={today} />

      {/*
        Three outcomes, and they are not the same page. A grid is a grid; a
        studio with no projects needs telling what one is for; and a studio
        whose projects are all shut needs telling why none of them is here.
        Deciding between the last two on the project count rather than on the
        row count keeps the "what a timesheet is" explanation for the case
        that is actually that.
      */}
      {!isSheetEmpty(sheet) ? (
        <TimesheetGrid sheet={sheet} today={today} />
      ) : projects.length === 0 ? (
        <NoProjectsToSheet />
      ) : (
        <NothingOpenThisWeek week={week} />
      )}
    </main>
  );
}
