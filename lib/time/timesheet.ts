import type { ProjectStatus } from "@/lib/projects/status";

import type { Week } from "./week";

/**
 * A week of the studio's time, as a grid: a row per project, a column per day.
 *
 * The project page already shows one engagement's time as a list. This is the
 * other question, the one a list cannot answer: where did the week go. Laid
 * out as a grid because that is the shape of the question — a reader scans
 * down a column to see what Tuesday came to, across a row to see what a
 * project came to, and the two totals meet in the corner.
 *
 * Pure, over plain values. Nothing here reads the database or the clock: the
 * page hands over the week, the projects and the week's entries, and gets back
 * the figures that go in the cells. That is what makes a sheet testable
 * without a studio's worth of fixtures, and it is what Day 027 will write its
 * bulk entries against.
 */

/**
 * What the grid reads of a time entry: which project, how long, which day, and
 * whether it is chargeable.
 *
 * The note and the attribution are absent, because no cell shows either. A
 * cell is a duration — one number standing for however many entries went into
 * it — and a grid that tried to show what was done would be a list with worse
 * spacing.
 */
export type TimesheetEntry = {
  readonly projectId: string;
  readonly minutes: number;
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  readonly workedOn: string;
  readonly billable: boolean;
};

/**
 * What the grid reads of a project: enough to name a row and decide whether it
 * gets one.
 *
 * The client's name is in it because a row is not identifiable without it. Two
 * clients with a "Website" each is the ordinary case in a studio, and a column
 * of project names on their own would be a sheet where somebody logs an
 * afternoon against the wrong engagement.
 */
export type TimesheetProject = {
  readonly id: string;
  readonly name: string;
  readonly clientName: string;
  readonly status: ProjectStatus;
};

/**
 * One cell: a project's work on one day.
 *
 * `minutes` is what the cell shows. `billableMinutes` is how much of it is
 * meant to be charged for, which is only ever remarked on when the two differ
 * — the same rule a day heading in the time list follows, and the same reason.
 *
 * `entryCount` is how many stretches of work the figure was built from. A cell
 * is one number standing in for several, and the count is what tells a reader
 * whether the eight hours in it is one entry or five — which is the difference
 * between a day's work and a figure worth opening.
 */
export type TimesheetCell = {
  /** The day this cell is under: `YYYY-MM-DD`. */
  readonly workedOn: string;
  readonly minutes: number;
  readonly billableMinutes: number;
  readonly entryCount: number;
};

/**
 * One row: a project, its seven cells, and what the week came to for it.
 *
 * The cells are always seven and always in the week's order, including the
 * days with nothing in them. A row that only held the days it was worked would
 * not line up with the headings above it, and an empty cell is a fact about
 * the week rather than a gap in the data.
 */
export type TimesheetRow = {
  readonly project: TimesheetProject;
  /** One cell per day of the week, earliest first. */
  readonly cells: readonly TimesheetCell[];
  readonly minutes: number;
  readonly billableMinutes: number;
  readonly entryCount: number;
};

/**
 * The whole sheet: the week it covers, its rows, the column totals, and the
 * figure in the corner.
 *
 * `dayTotals` is a cell per day like any other, so the totals row renders
 * through the same component as the rows above it and cannot drift into
 * formatting a duration differently from the cells it adds up.
 */
export type Timesheet = {
  readonly week: Week;
  readonly rows: readonly TimesheetRow[];
  /** What each day came to across every row, in the week's order. */
  readonly dayTotals: readonly TimesheetCell[];
  readonly minutes: number;
  readonly billableMinutes: number;
  readonly entryCount: number;
};
