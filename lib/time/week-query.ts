import { firstParam, type SearchParams } from "@/lib/projects/query";

import { hasWeek, startOfWeek, weekOf, type Week } from "./week";

/**
 * Which week the timesheet is showing, read off the URL.
 *
 * The URL is the only place this lives. A week is then a link — the one
 * somebody pastes into a message to say "look at what this cost" — and it
 * survives a reload, works with the back button, and leaves the page a server
 * component with no state of its own. The same arrangement `/projects` uses
 * for its filter and sort, for the same reasons.
 */

/** Where the timesheet lives, so no link has to spell the path out. */
export const TIMESHEET_PATH = "/time";

/** The param name, written once so the parser and the links cannot disagree. */
export const WEEK_PARAM = "week";

/**
 * The week a param value names, falling back to the week `today` is in.
 *
 * Any day of the week is accepted, not only the start day: a URL built by
 * hand, or one kept from a link to a particular Thursday, should show the week
 * that day is in rather than nothing. `weekOf` does the reducing, so
 * `?week=2026-10-29` and `?week=2026-10-26` are the same sheet.
 *
 * Anything unusable falls back rather than failing, and `hasWeek` rather than
 * `isCalendarDate` is what decides that: a day at the very edge of the
 * calendar is a date whose week cannot be written down, and it has to fall
 * back here rather than throw out of `weekOf`. A mangled param is still a
 * request for the timesheet, and the week somebody is in is the one answer
 * that is never useless — the page it lands on then says which week it is
 * showing, which is how the reader finds out the link was wrong.
 *
 * `today` is a parameter rather than a call to the clock, because this is pure
 * and because which day it is depends on where the reader is standing. The
 * page decides that; this only resolves it.
 */
export function parseWeekParam(
  value: string | undefined,
  today: string,
): Week {
  if (value !== undefined && hasWeek(value)) return weekOf(value);
  return weekOf(today);
}

/** The same, off the params Next hands a page. */
export function parseTimesheetWeek(
  params: SearchParams,
  today: string,
): Week {
  return parseWeekParam(firstParam(params[WEEK_PARAM]), today);
}

/**
 * The URL for a week, naming its start day.
 *
 * Always the start day, whatever day the week was asked for by, so one week
 * has one address. And always with the param, even for the week it is now:
 * `/time` means "whichever week it is when you open this", which is a
 * different sheet tomorrow, and a link in the page that quietly changed
 * meaning overnight would be the back button's problem to explain.
 */
export function timesheetHref(week: Week): string {
  const params = new URLSearchParams({ [WEEK_PARAM]: week.start });
  return `${TIMESHEET_PATH}?${params.toString()}`;
}

/**
 * Whether a week is the one `today` falls in.
 *
 * What the "This week" link is marked current by, and what decides whether the
 * heading needs to say which week is on screen — the ordinary case is the week
 * somebody is in, and a heading that announced it every time would be a label
 * nobody reads on the week it matters.
 */
export function isCurrentWeek(week: Week, today: string): boolean {
  return week.start === startOfWeek(today);
}
