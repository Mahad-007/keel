import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { isCalendarDate } from "@/lib/dates";
import type { EffectiveRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

/**
 * A project's burn, day by day, as a series rather than as a total.
 *
 * Day 032 answered "what has this engagement consumed?" with one number, and
 * one number is what the overview needs. This is the same arithmetic asked
 * once per day: the minutes logged up to the end of each day, valued at the
 * rate, set against the price. The result is a line, and the shape of the line
 * is the thing a total cannot say — whether the budget went in the first
 * fortnight or evenly across six months.
 *
 * Everything here is pure, over plain numbers and calendar-date strings. No
 * row is read, no clock is consulted and nothing is formatted. The figures
 * come from `summariseBurn` rather than from arithmetic written again here, so
 * a point of the series and the panel above the chart cannot disagree about
 * what "burned" means — the storage of these points is
 * `lib/data/burn-snapshots.ts`, and the chart that plots them is Day 036's.
 */

/**
 * One day of a project's logged work: the day, and what was logged.
 *
 * `LoggedTotals` and a date, so the three figures are the same three the
 * rollups and the burn summary carry rather than a fourth spelling of them.
 * The totals are a day's *own* work when the day comes off a query, and the
 * running total up to and including it once `accumulateBurnDays` has been
 * through them — which is the only reason the type is not two types. A day in
 * a series and a day on its own hold the same three numbers, and saying so
 * twice would invite a function that accepted one and was handed the other.
 *
 * `onDate` rather than `workedOn`, which is the column these dates are read
 * from. The series is about days of an engagement and not about rows of a
 * timesheet: a point of the burn-down stands for the state of the project at
 * the end of that day, including days where the only thing that happened was
 * the clock going round, and "worked on" would be a claim about work that the
 * figures do not make.
 */
export type BurnDay = LoggedTotals & {
  /** The calendar date: `YYYY-MM-DD`, no time of day. */
  readonly onDate: string;
};

/**
 * The days of a series that fall on or before a given day, in the order they
 * arrived.
 *
 * Every series has an upper bound, and it is always the same one: today. Time
 * can be logged against a future date — the form takes any day, and somebody
 * blocking out next week's retainer is not making a mistake — but a burn-down
 * cannot plot it. A point dated next Friday would say the engagement had
 * already consumed that money, and the line would run off the end of the chart
 * into work nobody has done.
 *
 * So the bound is applied before anything is accumulated, which is the only
 * order that gives a true figure: filtering a running total afterwards would
 * leave the last point carrying minutes from days that had been dropped, and
 * the chart would end higher than its own final point.
 *
 * The comparison is on the strings, which is exact for `YYYY-MM-DD` and only
 * for that shape — zero-padded, fixed width, biggest unit first. A day that is
 * not a calendar date is therefore dropped rather than compared, because the
 * comparison would be meaningless and a reading cannot be dated to a day that
 * is not a day. Only a hand-edited row reaches here as one.
 *
 * `through` itself has to be a calendar date and throws if it is not, like
 * `shiftCalendarDate`: the bound comes from the caller's clock rather than
 * from a column, so a timestamp there is a mistake in code, and silently
 * truncating it to its first ten characters would drop the whole of its own
 * day for anybody east of UTC.
 */
export function burnDaysThrough(
  days: readonly BurnDay[],
  through: string,
): BurnDay[] {
  if (!isCalendarDate(through)) {
    throw new Error(`not a calendar date: ${through}`);
  }
  return days.filter(
    (day) => isCalendarDate(day.onDate) && day.onDate <= through,
  );
}

/**
 * The days of a series as running totals, in calendar order: every point
 * carrying what the project had logged by the end of that day.
 *
 * The one transformation this file exists for. A query can hand back what each
 * day cost — that is a `group by` — but a burn-down is not a bar per day, it
 * is a line that only ever climbs, because the question is how much of the
 * contract has gone rather than how busy last Tuesday was. Turning the first
 * into the second is an accumulation, and it has to happen somewhere; here,
 * once, in a pure function, rather than in the query and again in the chart.
 *
 * Sorted into calendar order first, because a running total computed in any
 * other order is not a running total. The data layer's own ordering is already
 * ascending, so this is usually a sort of an already-sorted list — cheap, and
 * the alternative is a silent dependency on an `order by` in another file.
 *
 * Days sharing a date are combined into one point rather than producing two.
 * A `group by` cannot hand over a date twice, so this is for callers that
 * assembled the list themselves, and being right about it is worth the Map: two
 * points on one date would be one day plotted at two heights, and — because
 * the day is the key the storage is unique on — the lower of the two would be
 * what got stored.
 *
 * The totals are summed as integers, which is the whole reason time is kept in
 * minutes. An empty series accumulates to an empty series rather than to a
 * point of zeroes: a project with no time logged has no days, and inventing
 * one dated to nothing would put a point on the chart where nothing happened.
 */
export function accumulateBurnDays(days: readonly BurnDay[]): BurnDay[] {
  const byDate = new Map<string, LoggedTotals>();
  for (const day of days) {
    const sofar = byDate.get(day.onDate);
    byDate.set(day.onDate, {
      entryCount: (sofar?.entryCount ?? 0) + day.entryCount,
      loggedMinutes: (sofar?.loggedMinutes ?? 0) + day.loggedMinutes,
      billableMinutes: (sofar?.billableMinutes ?? 0) + day.billableMinutes,
    });
  }

  let entryCount = 0;
  let loggedMinutes = 0;
  let billableMinutes = 0;

  return [...byDate.keys()].sort().map((onDate) => {
    const day = byDate.get(onDate);
    entryCount += day?.entryCount ?? 0;
    loggedMinutes += day?.loggedMinutes ?? 0;
    billableMinutes += day?.billableMinutes ?? 0;
    return { onDate, entryCount, loggedMinutes, billableMinutes };
  });
}

/**
 * One point of a burn-down: a day, and the whole burn summary as it stood at
 * the end of it.
 *
 * `BurnSummary` and a date, deliberately, rather than a narrower shape holding
 * the two numbers a line needs. Every figure the overview panel puts on screen
 * — the price, the burn, what is left, the share consumed, the rate it was all
 * worked out at — is a figure somebody will want of a past day as soon as
 * there is a chart to hover: "it was 80% gone by March" is the sentence, and
 * it cannot be built from a plotted height. Carrying the summary also means
 * every word in `lib/projects/burn-summary.ts` already applies to a point,
 * which is what Day 036 renders its labels from rather than writing a second
 * vocabulary for the past tense.
 *
 * The rate travels in the summary, as it does everywhere: a point of zero
 * burned is a day nobody worked when a rate is set, and a day nobody has set a
 * rate for when one is not. On a chart those are a flat line and an empty
 * chart, and only the source can tell them apart.
 */
export type BurnPoint = BurnSummary & {
  /** The day this reading is the end of: `YYYY-MM-DD`. */
  readonly onDate: string;
};

/**
 * A project's burn-down: one point per day it logged work, each holding what
 * the whole engagement had consumed by the end of that day.
 *
 * The three things a burn figure needs, in the order they arrive: the days
 * come from the time entries, the price from the project, and the rate from
 * the resolution. The accumulation is a separate function above because it is
 * worth testing without money in the way; the valuation is `summariseBurn`,
 * unchanged, called once per day.
 *
 * Which means the price and the rate are the same on every point of a series
 * built this way, and that is honest about what can be known from the rows:
 * neither column keeps a history, so a series computed now can only be a
 * series computed at today's figures. It is the stored table that holds the
 * other reading, where each row kept the price and rate of its own day — and
 * `recordedBurnPoint` is how those come back. A caller plotting history wants
 * the stored rows; this is what produces them in the first place, and what the
 * backfill values the past with for want of anything better.
 *
 * The minutes are totalled before they are valued rather than each day's being
 * valued and the money added up, which is the rule `burnedCents` exists to
 * keep: twenty minutes converted three times comes to a cent less than the
 * hour it is. A series accumulated in cents would drift from the panel above
 * it by a few cents on a long engagement, and the panel is the figure people
 * quote.
 *
 * Days are *not* filled in. A project worked on Monday and Thursday has two
 * points and not four, because the two days in between have nothing to say —
 * the burn did not move, and a row per calendar day would store a year of
 * identical readings for a project that was worked on nine times. A chart
 * holds its last value across a gap, which is the true shape: the line is flat
 * because nothing happened.
 */
export function burnSeries(
  days: readonly BurnDay[],
  contractedCents: number,
  rate: EffectiveRate,
): BurnPoint[] {
  return accumulateBurnDays(days).map((day) => ({
    onDate: day.onDate,
    ...summariseBurn(day, contractedCents, rate),
  }));
}
