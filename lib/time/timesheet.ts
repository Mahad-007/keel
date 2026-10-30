import { formatMinutes } from "@/lib/minutes";
import type { ProjectStatus } from "@/lib/projects/status";

import {
  billableMinutes,
  notChargeablePhrase,
  totalMinutes,
} from "./days";
import { isInWeek, weekdayHeading, type Week } from "./week";

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

/**
 * One cell from the entries that fall in it.
 *
 * The day is passed rather than read off the first entry, because a cell with
 * nothing in it still belongs to a day: that is what keeps a row seven cells
 * wide, and it is the only way an empty Wednesday can be told apart from a
 * Wednesday that is missing.
 *
 * The two sums are the time list's own, so a cell and a day heading cannot
 * disagree about what a set of entries comes to or about which of them will be
 * charged for.
 */
export function timesheetCell(
  workedOn: string,
  entries: readonly TimesheetEntry[],
): TimesheetCell {
  return {
    workedOn,
    minutes: totalMinutes(entries),
    billableMinutes: billableMinutes(entries),
    entryCount: entries.length,
  };
}

/** Whether a cell holds any work at all. What decides if it reads as a figure or a dash. */
export function isWorked(cell: TimesheetCell): boolean {
  return cell.entryCount > 0;
}

/**
 * A week's seven cells from a set of entries, in the week's own order.
 *
 * Always seven, whatever the entries hold. The grid's columns are the week's
 * days, so a row has to answer for each of them — including the ones nobody
 * worked, which is most of them on most rows.
 *
 * Entries outside the week are dropped rather than folded into the nearest
 * cell. The query already restricts to the week, so this only ever matters
 * when a caller hands over more than it asked for; dropping them keeps the row
 * total equal to the sum of its cells, which is the one property a reader
 * checks by eye.
 *
 * Grouped in one pass rather than filtered seven times, because a studio's
 * busy week is the case this is read in and seven scans per row is the kind of
 * arithmetic that gets slower exactly as the sheet gets interesting.
 */
export function weekCells(
  week: Week,
  entries: readonly TimesheetEntry[],
): TimesheetCell[] {
  const byDay = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    if (!isInWeek(week, entry.workedOn)) continue;
    const day = byDay.get(entry.workedOn);
    if (day === undefined) byDay.set(entry.workedOn, [entry]);
    else day.push(entry);
  }

  return week.days.map((day) => timesheetCell(day, byDay.get(day) ?? []));
}

/**
 * What a set of cells comes to, which is the three figures a cell holds minus
 * the day it was on.
 *
 * One function for both directions of the grid: a row's total is the sum of
 * its seven cells, a column's is the sum of one cell from every row, and the
 * corner is the sum of the columns. Totalling each of those separately would
 * be three chances for the sheet to disagree with itself about the same
 * minutes — and the corner figure has to equal both the row totals and the
 * column totals or the grid is not a grid.
 */
export function sumCells(cells: readonly TimesheetCell[]): {
  minutes: number;
  billableMinutes: number;
  entryCount: number;
} {
  return {
    minutes: cells.reduce((sum, cell) => sum + cell.minutes, 0),
    billableMinutes: cells.reduce((sum, cell) => sum + cell.billableMinutes, 0),
    entryCount: cells.reduce((sum, cell) => sum + cell.entryCount, 0),
  };
}

/**
 * One row of the sheet: a project, its seven cells, and its week's totals.
 *
 * The totals are summed from the cells rather than from the entries, so the
 * figure at the end of the row is literally the sum of what is printed along
 * it. Summing the entries instead would be the same number almost always, and
 * on the exception — an entry outside the week that `weekCells` dropped — the
 * row would end in a total a reader cannot find on screen.
 */
export function timesheetRow(
  project: TimesheetProject,
  week: Week,
  entries: readonly TimesheetEntry[],
): TimesheetRow {
  const cells = weekCells(week, entries);
  return { project, cells, ...sumCells(cells) };
}

/**
 * The status that earns a project a row on a week it has no time in: active.
 *
 * A timesheet that listed every project a studio has ever run would be a
 * hundred rows of dashes, and the one thing a weekly sheet has to be is
 * scannable. Active is the set somebody is expected to be working on, so those
 * are the rows worth leaving open — and Day 027 turns exactly those empty
 * cells into the place a week gets filled in.
 *
 * Draft, paused and closed are left out. A draft is work nobody has committed
 * to, a paused project is one deliberately not being worked on, and a closed
 * one is over; a row for each would be a prompt to log time against something
 * that should not be having time logged against it.
 */
export const TIMESHEET_STATUS: ProjectStatus = "active";

/**
 * Whether a project is one the week expects work on.
 *
 * A fact about the project rather than about the sheet, which is why it is
 * separate from `belongsOnSheet`: the status rule and the "but it has time in
 * it" rule are different claims, and only one of them changes if Day 098 or a
 * later filter decides which statuses a sheet shows.
 */
export function expectsTime(project: Pick<TimesheetProject, "status">): boolean {
  return project.status === TIMESHEET_STATUS;
}

/**
 * Whether a row belongs on the sheet: it has work in the week, or it is a
 * project the week expects work on.
 *
 * Work in the week always wins. A paused project that somebody logged three
 * hours against on Tuesday is exactly the row a reader needs to see — hiding
 * it would mean a sheet whose column totals did not match the hours in it, and
 * the figure a reader could not account for is the one that stops them
 * trusting the page.
 */
export function belongsOnSheet(row: TimesheetRow): boolean {
  return row.entryCount > 0 || expectsTime(row.project);
}

/**
 * How two values of the same kind of name compare on a sheet: by case, or
 * rather without it.
 *
 * Lowercased before comparing, which is what `listClients` does in SQL for the
 * same reason — `Zephyr` sorting above `acme` is a sheet that looks broken.
 * The raw values break the tie afterwards so that two names differing only in
 * case still have a fixed order instead of swapping between renders.
 */
function compareNames(left: string, right: string): number {
  const folded = left.toLowerCase().localeCompare(right.toLowerCase());
  if (folded !== 0) return folded;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The order rows read in: by client, then by project within the client, then
 * by id.
 *
 * Client first because that is how a studio's week is thought about — the
 * question is "how much of this week went to Harbour Co", and rows for one
 * client scattered down the sheet make that a hunt. The project name then
 * groups an engagement under its client, which is also the order the client's
 * own invoice will read in.
 *
 * Not by hours. A sheet whose rows reordered themselves as the week filled in
 * would be one where a reader's hand has to find the row again after every
 * entry — and Day 027 puts a cursor in these cells, which cannot move under
 * the cursor. The id breaks the last tie for the same reason: two identically
 * named projects for one client must not swap places between reloads.
 */
export function compareRows(left: TimesheetRow, right: TimesheetRow): number {
  const byClient = compareNames(
    left.project.clientName,
    right.project.clientName,
  );
  if (byClient !== 0) return byClient;

  const byProject = compareNames(left.project.name, right.project.name);
  if (byProject !== 0) return byProject;

  return compareNames(left.project.id, right.project.id);
}

/**
 * The whole sheet, from the week, the projects and the week's entries.
 *
 * One pass to file the entries under their projects, a row each, then the
 * rows that belong, in order. The column totals are taken off the rows rather
 * than off the entries, and the corner off the columns, so every figure on
 * screen is the sum of the figures beside it — which is the only thing a
 * reader can check without leaving the page.
 *
 * Entries naming a project that is not in the list are dropped, along with
 * their minutes. The page passes every project, so this only happens to a
 * caller that narrowed one side and not the other; dropping them keeps the
 * corner figure equal to the grid, and a total that counted hours with no row
 * to put them in would be a number nobody could account for.
 *
 * `projects` is not required to be in any order. The sheet sorts for itself,
 * because a row's place on it is a property of the sheet rather than of
 * whichever query filled it.
 */
export function buildTimesheet(
  week: Week,
  projects: readonly TimesheetProject[],
  entries: readonly TimesheetEntry[],
): Timesheet {
  const byProject = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const project = byProject.get(entry.projectId);
    if (project === undefined) byProject.set(entry.projectId, [entry]);
    else project.push(entry);
  }

  const rows = projects
    .map((project) =>
      timesheetRow(project, week, byProject.get(project.id) ?? []),
    )
    .filter(belongsOnSheet)
    .sort(compareRows);

  const dayTotals = week.days.map((day, column) => ({
    workedOn: day,
    ...sumCells(rows.map((row) => row.cells[column])),
  }));

  return { week, rows, dayTotals, ...sumCells(dayTotals) };
}

/**
 * What a cell with nothing in it shows: an en dash, not a zero.
 *
 * `0m` in forty cells is forty numbers to read past, and the eye cannot tell
 * at a glance which of them are the ones that matter. A dash says "nothing
 * here" without pretending to be a measurement — and it leaves the figures as
 * the only numbers on the grid, which is what makes a busy Tuesday visible
 * from across the room.
 */
export const NOTHING_LOGGED = "–";

/**
 * A cell as its figure, or the dash that stands for nothing.
 *
 * One function so the grid, the row totals and the column totals cannot
 * disagree about how an empty cell reads. A row total of nothing is a dash for
 * the same reason a cell is: on a sheet where most rows are open for the week
 * rather than worked in it, a column of `0m` would be the loudest thing on the
 * page.
 */
export function cellFigure(cell: TimesheetCell): string {
  return isWorked(cell) ? formatMinutes(cell.minutes) : NOTHING_LOGGED;
}

/**
 * A cell as one sentence, for a reader who is not looking at the grid.
 *
 * On screen a cell is a duration whose meaning comes entirely from where it
 * sits: the row says which project, the heading says which day. Read aloud
 * that is a bare number — "two thirty" — so the cell carries its own position
 * as its accessible name, and the figure inside it is hidden rather than
 * announced on its own.
 *
 * The project, the client and the day, in that order, because that is the
 * order somebody arrowing across a row needs them: the row has not changed,
 * the day has. The entry count is in it for the reason the column exists — a
 * figure built from five entries is a different fact from the same figure
 * built from one — and the non-chargeable clause appears only when there is a
 * gap to report, the same rule the time list's day headings follow.
 */
export function describeCell(
  project: TimesheetProject,
  cell: TimesheetCell,
): string {
  const where = `${project.name}, ${project.clientName}, ${weekdayHeading(cell.workedOn)}`;
  if (!isWorked(cell)) return `${where} — nothing logged`;

  const parts = [
    formatMinutes(cell.minutes),
    cell.entryCount === 1 ? "one entry" : `${cell.entryCount} entries`,
  ];
  const free = notChargeablePhrase(cell.minutes, cell.billableMinutes);
  if (free !== null) parts.push(free);

  return `${where} — ${parts.join(", ")}`;
}
