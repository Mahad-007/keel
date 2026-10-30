import { formatMinutes } from "@/lib/minutes";
import type { ProjectStatus } from "@/lib/projects/status";

import type { GridPosition, GridSize } from "./grid";
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
 * The three figures every total on the sheet holds, wherever it sits.
 *
 * `minutes` is what is shown. `billableMinutes` is how much of it is meant to
 * be charged for, which is only ever remarked on when the two differ — the
 * same rule a day heading in the time list follows, and the same reason.
 *
 * `entryCount` is how many stretches of work the figure was built from. A cell
 * is one number standing in for several, and the count is what tells a reader
 * whether the eight hours in it is one entry or five — which is the difference
 * between a day's work and a figure worth opening.
 *
 * Named once because a cell, a row's total, a column's total and the figure in
 * the corner are all this. Writing it four times would mean four chances for
 * the words beside a number to depend on where on the grid the number sits,
 * and the whole claim a grid makes is that they do not.
 */
export type CellTotals = {
  readonly minutes: number;
  readonly billableMinutes: number;
  readonly entryCount: number;
};

/** One cell: a project's work on one day. */
export type TimesheetCell = CellTotals & {
  /** The day this cell is under: `YYYY-MM-DD`. */
  readonly workedOn: string;
};

/**
 * One row: a project, its seven cells, and what the week came to for it.
 *
 * The cells are always seven and always in the week's order, including the
 * days with nothing in them. A row that only held the days it was worked would
 * not line up with the headings above it, and an empty cell is a fact about
 * the week rather than a gap in the data.
 */
export type TimesheetRow = CellTotals & {
  readonly project: TimesheetProject;
  /** One cell per day of the week, earliest first. */
  readonly cells: readonly TimesheetCell[];
};

/**
 * The whole sheet: the week it covers, its rows, the column totals, and the
 * figure in the corner.
 *
 * `dayTotals` is a cell per day like any other, so the totals row renders
 * through the same component as the rows above it and cannot drift into
 * formatting a duration differently from the cells it adds up.
 */
export type Timesheet = CellTotals & {
  readonly week: Week;
  readonly rows: readonly TimesheetRow[];
  /** What each day came to across every row, in the week's order. */
  readonly dayTotals: readonly TimesheetCell[];
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

/** Whether a total holds any work at all. What decides if it reads as a figure or a dash. */
export function isWorked(total: CellTotals): boolean {
  return total.entryCount > 0;
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
export function sumCells(cells: readonly TimesheetCell[]): CellTotals {
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
 * A duration as the grid prints it: the figure, or the dash that stands for
 * nothing.
 *
 * Takes the entry count as well as the minutes, because "nothing" means "no
 * work was logged here" rather than "the arithmetic came to zero". The two
 * cannot currently differ — a stored entry is always a positive number of
 * minutes — and resting the dash on the count rather than on the total means
 * they still cannot differ if that ever stops being true.
 *
 * One function so the cells, the row totals and the column totals cannot
 * disagree about how an empty figure reads. A row total of nothing is a dash
 * for the same reason a cell is: on a sheet where most rows are open for the
 * week rather than worked in it, a column of `0m` would be the loudest thing
 * on the page.
 */
export function minutesFigure(minutes: number, entryCount: number): string {
  return entryCount > 0 ? formatMinutes(minutes) : NOTHING_LOGGED;
}

/** A total as its figure, or the dash that stands for nothing. */
export function cellFigure(total: CellTotals): string {
  return minutesFigure(total.minutes, total.entryCount);
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
  if (!isWorked(cell)) return `${where} — ${NOTHING_LOGGED_LABEL}`;

  const parts = [
    formatMinutes(cell.minutes),
    cell.entryCount === 1 ? "one entry" : `${cell.entryCount} entries`,
  ];
  const free = notChargeablePhrase(cell.minutes, cell.billableMinutes);
  if (free !== null) parts.push(free);

  return `${where} — ${parts.join(", ")}`;
}

/**
 * How many days of the week hold work, across every row.
 *
 * A figure worth its own sentence, because the total alone does not say what
 * kind of week it was: twenty hours over five days is a week of work and
 * twenty hours over one is a day somebody is going to remember.
 */
export function daysWorked(sheet: Timesheet): number {
  return sheet.dayTotals.filter(isWorked).length;
}

/**
 * The line under the heading: how many projects the sheet holds, how much was
 * logged, and over how many days.
 *
 * Three figures rather than one, the same three the time list's own summary
 * gives and for the same reasons. The project count says how long the sheet
 * is; the day count says how the week was shaped; the total is the figure the
 * page is for.
 *
 * A week with nothing in it says so plainly instead of reading out a zero.
 * That is the ordinary state of a Monday morning, and a sheet that opened with
 * "0m logged over 0 days" would be three numbers saying what one clause says
 * better.
 */
export function describeTimesheet(sheet: Timesheet): string {
  const projects =
    sheet.rows.length === 1 ? "One project" : `${sheet.rows.length} projects`;
  if (sheet.rows.length === 0) return "No projects to show for this week.";
  if (sheet.minutes === 0) return `${projects}, nothing logged this week.`;

  const days = daysWorked(sheet);
  const over = days === 1 ? "on one day" : `over ${days} days`;
  return `${projects}, ${formatMinutes(sheet.minutes)} logged ${over}.`;
}

/**
 * The sheet's shape, for the navigation arithmetic.
 *
 * The columns come from the week rather than from `dayTotals.length`, because
 * the week is what the grid is: seven, always, however little was logged. A
 * size read off whatever happened to be in the sheet would let a quiet week
 * silently shrink the cursor's range.
 */
export function sheetSize(sheet: Timesheet): GridSize {
  return { rows: sheet.rows.length, columns: sheet.week.days.length };
}

/**
 * Whether the sheet has a grid to draw at all.
 *
 * No rows is not the same as no time: a week with four active projects and
 * nothing logged still has a grid, and it is the grid somebody is about to
 * fill in. This is the other case — nothing to show, because the studio has no
 * project the week expects anything from and none was worked. The page shows
 * an explanation instead, and the cursor has nowhere to be.
 */
export function isSheetEmpty(sheet: Timesheet): boolean {
  return sheet.rows.length === 0;
}

/**
 * A row's week as one sentence: which project, and what it came to.
 *
 * The total at the end of a row is a number in a column of numbers, and which
 * row it belongs to is a fact about the screen rather than about the figure.
 * Read aloud it needs the project back, which is what this is for.
 */
export function describeRowTotal(row: TimesheetRow): string {
  const where = `${row.project.name}, ${row.project.clientName}`;
  if (row.entryCount === 0) return `${where} — nothing logged this week`;

  const parts = [`${formatMinutes(row.minutes)} this week`];
  const free = notChargeablePhrase(row.minutes, row.billableMinutes);
  if (free !== null) parts.push(free);
  return `${where} — ${parts.join(", ")}`;
}

/**
 * A column's total as one sentence: which day, and what every project came to
 * on it.
 *
 * "Every project" rather than nothing, because the figure sits under a column
 * of cells that each belonged to one — the thing that makes this number
 * different is exactly that it does not.
 */
export function describeColumnTotal(cell: TimesheetCell): string {
  const where = `${weekdayHeading(cell.workedOn)}, every project`;
  if (!isWorked(cell)) return `${where} — nothing logged`;

  const parts = [formatMinutes(cell.minutes)];
  const free = notChargeablePhrase(cell.minutes, cell.billableMinutes);
  if (free !== null) parts.push(free);
  return `${where} — ${parts.join(", ")}`;
}

/**
 * The figure in the corner as one sentence: the week, and what all of it came
 * to.
 *
 * The one number on the sheet that is both a row total and a column total, and
 * the only one whose position says nothing about what it means.
 */
export function describeSheetTotal(sheet: Timesheet): string {
  if (sheet.entryCount === 0) return "Nothing logged this week";

  const parts = [`${formatMinutes(sheet.minutes)} this week, every project`];
  const free = notChargeablePhrase(sheet.minutes, sheet.billableMinutes);
  if (free !== null) parts.push(free);
  return parts.join(", ");
}

/**
 * The two columns that are not days, and the row that is not a project.
 *
 * Written here rather than in the markup because the grid's shape is a fact
 * about the sheet: seven day columns between a row header and a total, and a
 * total row under all of them. A heading changed in one place and not the
 * other is how a column ends up labelled one thing and described as another.
 *
 * "Week" rather than "Total" for the row total, because the column it heads is
 * the week — the total row underneath it is also a total, and two columns both
 * called that would say nothing about which direction either runs in.
 */
export const SHEET_COLUMNS = {
  project: "Project",
  week: "Week",
} as const;

/** What the totals row is called in the leftmost column. */
export const SHEET_TOTAL_ROW = "All projects";

/** What the dash in an empty cell means, for a reader who would hear "dash". */
export const NOTHING_LOGGED_LABEL = "nothing logged";

/**
 * The facts about a cell that its figure does not carry, or null when the
 * figure already says everything.
 *
 * Two of them, and both are usually absent. A cell built from more than one
 * entry is worth saying so — eight hours from one entry is a day's work and
 * eight hours from five is a figure worth opening — and a cell holding time
 * nobody will be charged for is worth saying so for the reason every other
 * total in the app says it.
 *
 * Null for the ordinary cell, which is one entry that will be invoiced. That
 * is what keeps the grid a grid: a note on every cell would be a second
 * column of text in each of seven columns, and the figures would stop lining
 * up.
 *
 * Nothing about an empty cell, because an empty cell has no facts. The dash
 * and `NOTHING_LOGGED_LABEL` are the whole of what there is to say.
 */
export function cellAside(total: CellTotals): string | null {
  if (!isWorked(total)) return null;

  const parts: string[] = [];
  if (total.entryCount > 1) parts.push(`${total.entryCount} entries`);
  const free = notChargeablePhrase(total.minutes, total.billableMinutes);
  if (free !== null) parts.push(free);

  return parts.length === 0 ? null : parts.join(", ");
}

/**
 * Where the cursor starts on a freshly opened sheet: the first row, on today's
 * column if today is in the week.
 *
 * Today, because the overwhelmingly common reason to open a timesheet is to
 * deal with the day you are on, and Day 027 puts an editor in these cells. A
 * cursor that always landed on Monday would mean four presses before a Friday
 * afternoon could be typed.
 *
 * The first column for any other week. "Today" is not in it, so there is no
 * day with a claim on the cursor, and the start of the week is where reading
 * one begins.
 */
export function startingCursor(
  sheet: Timesheet,
  today: string,
): GridPosition {
  const column = sheet.week.days.indexOf(today);
  return { row: 0, column: column === -1 ? 0 : column };
}
