import { formatMinutes } from "@/lib/minutes";

import { billableMinutes, totalMinutes, type MeasuredEntry } from "./days";

/**
 * What a filtered time log comes to, and how to say it in a line.
 *
 * The figures are of what is shown, which is the whole point of a filtered
 * list and the thing most easily misread: four hours under a heading that does
 * not say which four hours is a figure somebody will quote at a client. So the
 * summary and the heading are written together — the heading says what the
 * filters are, and this says what they came to.
 *
 * Pure, and over the rows the page already read. Nothing here queries for a
 * count: a total that came from a second query could disagree with the rows
 * underneath it, and a reader cannot tell which of the two is wrong.
 */

/** What summing a log needs of an entry: the duration, the flag, and where it went. */
export type LoggedWork = MeasuredEntry & {
  /** The calendar date the work was done on, for counting the days worked. */
  readonly workedOn: string;
  /** Which engagement it was for, for counting the projects touched. */
  readonly projectId: string;
};

/**
 * What a log came to: how much work, over how many days, across how many
 * engagements.
 *
 * `entries` is the row count, which is not the same fact as the minutes: a
 * week logged in four stretches and a week logged in forty are the same total
 * and two different records, and the second is the one worth tidying up.
 *
 * `days` and `projects` are counts of distinct values rather than of rows,
 * because that is what makes the sentence mean something — "14h across 3
 * projects" says the filter is wide, and "14h on one day" says somebody had a
 * long Tuesday.
 */
export type LogSummary = {
  readonly entries: number;
  readonly minutes: number;
  /** How much of it is meant to reach an invoice. */
  readonly billableMinutes: number;
  readonly days: number;
  readonly projects: number;
};

/** What an empty log comes to, which is a real answer rather than a gap. */
export const EMPTY_LOG: LogSummary = {
  entries: 0,
  minutes: 0,
  billableMinutes: 0,
  days: 0,
  projects: 0,
};

/**
 * The log's figures, in one pass over the rows.
 *
 * The two sums go through `totalMinutes` and `billableMinutes` rather than
 * being added up here, so the log's total and a day's heading cannot come to
 * read the billable flag differently.
 */
export function summarizeLog(entries: readonly LoggedWork[]): LogSummary {
  return {
    entries: entries.length,
    minutes: totalMinutes(entries),
    billableMinutes: billableMinutes(entries),
    days: new Set(entries.map((entry) => entry.workedOn)).size,
    projects: new Set(entries.map((entry) => entry.projectId)).size,
  };
}

/** What a log with nothing in it says, where the figures would be. */
export const NOTHING_LOGGED = "Nothing logged.";

/** How many days the work was spread over, as a clause. */
function overDays(days: number): string {
  return days === 1 ? "on one day" : `over ${days} days`;
}

/** How many engagements it was for, as a clause. */
function acrossProjects(projects: number): string {
  return projects === 1 ? "for one project" : `across ${projects} projects`;
}

/**
 * The line under the heading: what the log on screen comes to.
 *
 * Four facts, because each answers a different question and none implies the
 * others. The row count says how finely the work was written down; the total
 * says what it cost; the days say whether it was a push or a trickle; the
 * projects say how wide the filter is. A reader who has set a date range and a
 * client is checking all four.
 *
 * The chargeable figure is only mentioned when it differs from the total,
 * which is the rule `describeDayTotal` follows — a clause that is always true
 * is a clause nobody reads, and the one log where it mattered would look like
 * the rest. Said as what is *not* chargeable, because the total is already in
 * the sentence and the gap between it and the invoice is the interesting part.
 */
export function describeLog(summary: LogSummary): string {
  if (summary.entries === 0) return NOTHING_LOGGED;

  const rows = summary.entries === 1 ? "One entry" : `${summary.entries} entries`;
  const spread = `${overDays(summary.days)} ${acrossProjects(summary.projects)}`;
  const sentence = `${rows}, ${formatMinutes(summary.minutes)} ${spread}`;

  if (summary.billableMinutes === summary.minutes) return `${sentence}.`;
  const free = summary.minutes - summary.billableMinutes;
  return `${sentence}, ${formatMinutes(free)} of it not chargeable.`;
}
