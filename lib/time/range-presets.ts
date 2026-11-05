import { endOfMonth, shiftCalendarDate, startOfMonth } from "@/lib/dates";

import { ALL_DATES, ALL_DATES_LABEL, type DateRange } from "./range";
import { hasWeek, weekOf } from "./week";

/**
 * The date ranges worth one click: this week, this month, the last thirty
 * days, and no filter at all.
 *
 * Two date boxes and an Apply button answer every question, and they make the
 * three a reader asks every day cost six keystrokes each. A preset is a link
 * carrying the same two params the boxes would have submitted — so it is not a
 * second way of filtering, it is the first way with the typing done.
 *
 * Deliberately short. A row of twelve presets is a row nobody reads, and the
 * ones left out — last month, this quarter, the year to date — are a date
 * range somebody can still type and then bookmark.
 */

/** The seven days of the week today falls in, Monday to Sunday. */
export const THIS_WEEK = "this-week";

/** The first of this month to its last day, whichever day it is now. */
export const THIS_MONTH = "this-month";

/** Today and the twenty-nine days before it. */
export const LAST_30_DAYS = "last-30-days";

/** No date filter: every day there is. */
export const ANY_DATE = "all";

export type RangePreset =
  | typeof THIS_WEEK
  | typeof THIS_MONTH
  | typeof LAST_30_DAYS
  | typeof ANY_DATE;

/**
 * Shortest span first, then the way out. A reader scanning the row meets the
 * narrowest filter first and the one that clears everything last, which is
 * where the eye goes looking for it.
 */
export const RANGE_PRESETS = [
  THIS_WEEK,
  LAST_30_DAYS,
  THIS_MONTH,
  ANY_DATE,
] as const satisfies readonly RangePreset[];

/** How many days "the last thirty days" is, today included. */
export const RECENT_DAYS = 30;

/**
 * The earliest day the presets can be worked out from.
 *
 * A preset reaches backwards — thirty days, or to the Monday of the week — and
 * the calendar has an end that arithmetic cannot step over. A February in year
 * zero is far enough in for all of it, and no reader is standing there: the
 * only way to get one is a clock set wrong by four thousand years, and the
 * answer that day is every entry rather than a 500.
 */
const EARLIEST_PRESET_DAY = "0000-02-01";

/**
 * The range a preset means, worked out from the day the reader is standing on.
 *
 * `today` is a parameter rather than a call to the clock, because this is pure
 * and because which day it is depends on where the reader is. The page decides
 * that; this only resolves it.
 */
export function presetRange(preset: RangePreset, today: string): DateRange {
  if (preset === ANY_DATE) return ALL_DATES;
  if (!hasWeek(today) || today < EARLIEST_PRESET_DAY) return ALL_DATES;

  if (preset === THIS_WEEK) {
    const week = weekOf(today);
    return { from: week.start, to: week.end };
  }
  if (preset === THIS_MONTH) {
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }
  return { from: shiftCalendarDate(today, -(RECENT_DAYS - 1)), to: today };
}

/**
 * The word on a preset link.
 *
 * "All time" rather than "All", and it is the same string the heading uses for
 * an unfiltered range — the link that clears the date filter and the heading
 * that says it is cleared have to read as the same fact.
 */
export function rangePresetLabel(preset: RangePreset): string {
  if (preset === THIS_WEEK) return "This week";
  if (preset === THIS_MONTH) return "This month";
  if (preset === LAST_30_DAYS) return `Last ${RECENT_DAYS} days`;
  return ALL_DATES_LABEL;
}

/**
 * Which preset a range is, or null when it is none of them.
 *
 * What a preset link is marked current by. Compared on the dates rather than
 * carried in the URL as a fourth param, so a range that was typed into the two
 * boxes and happens to be this month is marked as this month — and so a link
 * somebody kept from last week does not claim to be showing the week it is now.
 *
 * `all` is matched like the rest rather than special-cased, so a log with no
 * date filter marks the way-out link as where it already is.
 */
export function matchingPreset(
  range: DateRange,
  today: string,
): RangePreset | null {
  return (
    RANGE_PRESETS.find((preset) => {
      const candidate = presetRange(preset, today);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? null
  );
}
