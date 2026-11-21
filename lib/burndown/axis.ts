/**
 * The ticks and labels down the side of a burn-down, and along the bottom of
 * it.
 *
 * Separate from the geometry because it is a different kind of decision. The
 * geometry answers "where does this go"; this answers "which values are worth
 * naming and what do they read as" — and the answer to the second is mostly
 * about restraint. A tick at every reading would be a number on every point,
 * which is the chart equivalent of shouting.
 */

import {
  calendarDateParts,
  calendarDayGap,
  formatYear,
  shiftCalendarDate,
} from "@/lib/dates";
import { withoutNegativeZero } from "@/lib/money";

const DOLLARS = 100;

/**
 * An amount on an axis, written in dollars and no cents.
 *
 * Axis ticks land on round figures by construction, so the cents are always
 * `.00` and printing them twice down the left-hand side of a chart is noise
 * in the place a reader is trying to skim. A tick that somehow is not whole
 * dollars keeps its cents rather than being rounded into a figure the
 * gridline is not actually at.
 *
 * `Intl` rather than string surgery, so the thousands separators are the same
 * ones `formatCents` puts in the figures above the chart. A reader comparing
 * the panel with the axis is comparing two renderings of the same amount.
 *
 * Minus nothing is written as nothing. An axis that straddles zero reaches it
 * by rounding a negative figure upwards, and that lands on `-0` rather than
 * on zero — which `Intl` faithfully renders as a minus sign in front of the
 * one number that has no sign. The gridline a reader most needs to find would
 * be the one labelled wrong.
 */
export function axisMoneyLabel(amount: number): string {
  const cents = withoutNegativeZero(amount);
  const places = cents % DOLLARS === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(cents / DOLLARS);
}

/** A thousand dollars and a million dollars, in cents. */
const THOUSAND = 1_000 * DOLLARS;
const MILLION = 1_000 * THOUSAND;

/** The three scales an axis amount can be written at. */
export type MoneyUnit = typeof DOLLARS | typeof THOUSAND | typeof MILLION;

/**
 * The scale a whole axis should be written at, from the largest amount on
 * it.
 *
 * Chosen once for the axis and passed to every label, which is the only way
 * a column of figures reads as one quantity. Picking per amount is the bug
 * this parameter exists to prevent: an axis reaching a million and a quarter
 * would otherwise be labelled `$200K` four times and then `$1M`, and the
 * reader has to notice the suffix changing halfway down to know the top two
 * are not smaller than the ones above them.
 */
export function unitForAxis(largestCents: number): MoneyUnit {
  const magnitude = Math.abs(largestCents);
  if (magnitude >= MILLION) return MILLION;
  if (magnitude >= THOUSAND) return THOUSAND;
  return DOLLARS;
}

/**
 * An amount on an axis, shortened: twelve and a half thousand dollars as
 * `12.5K`, a million and a bit as `1.2M`.
 *
 * For the left-hand side of a chart whose axis runs into five figures, where
 * the amount written out four times down the margin is both hard to skim and
 * wide enough to squeeze the plot.
 *
 * The unit is an argument, and `moneyAxisTicks` decides it once for the whole
 * axis — mixing thousands and millions down a single column would make two
 * ticks of the same axis look like two different quantities. The default is
 * the unit this amount alone would pick, for a caller shortening one figure
 * rather than a column of them.
 *
 * Zero always comes out as `$0` whatever unit the axis is in, because it is
 * the same nothing at every scale and `$0K` is not a figure.
 *
 * One decimal place, and a trailing zero is dropped: ten thousand is `10K`
 * rather than `10.0K`. Ticks land on round figures, so the decimal is only
 * ever there when the step is a half, and a column of trailing zeroes is the
 * noise this exists to avoid.
 *
 * Rounded rather than truncated, like every other figure in the codebase, and
 * the minus sign goes before the currency symbol, where `formatCents` puts it
 * too.
 */
export function compactMoneyLabel(
  cents: number,
  unit: MoneyUnit = unitForAxis(cents),
): string {
  if (unit === DOLLARS || cents === 0) return axisMoneyLabel(cents);

  const suffix = unit === MILLION ? "M" : "K";
  const scaled = Math.round((Math.abs(cents) / unit) * 10) / 10;
  const sign = withoutNegativeZero(cents) < 0 ? "-" : "";
  return sign + "$" + String(scaled) + suffix;
}

/**
 * Roughly how many gaps the money axis is cut into.
 *
 * Four, which is five labelled lines at most. Enough that a reader can place
 * a point between two of them without counting, and few enough that the
 * gridlines stay the recessive thing behind the line rather than a ladder
 * competing with it.
 */
const TICK_INTERVALS = 4;

/**
 * The steps a money axis is allowed to count in, as multiples of a power of
 * ten, each against the point it starts winning from.
 *
 * The thresholds are the geometric midpoints between one multiple and the
 * next — the square roots of two, ten and fifty — which is what makes the
 * choice "nearest" rather than "next one up". Rounding a step up every time
 * is the version of this that looks right and reads wrong: a five-thousand
 * dollar contract wants four gaps of a thousand and would be given two and a
 * half gaps of two thousand, and an axis labelled in two-thousands is an axis
 * whose top figure is not on it.
 *
 * Two and a half is deliberately not among them. It is a legitimate axis
 * step, but it produces fractional cents at the smallest magnitudes and a
 * column of figures that have to be read rather than recognised.
 */
const TICK_MULTIPLES = [
  { from: Math.sqrt(50), multiple: 10 },
  { from: Math.sqrt(10), multiple: 5 },
  { from: Math.sqrt(2), multiple: 2 },
  { from: 0, multiple: 1 },
];

/**
 * How far apart the gridlines go, in cents: the smallest round step that cuts
 * the range into about four.
 *
 * Round in the sense a reader means — one, two or five, times a power of ten
 * — so the labels come out as figures somebody would say out loud. An axis
 * stepped by the range divided by four would be labelled in eighths of an odd
 * contract value, and every gridline would need reading rather than
 * recognising.
 *
 * "About four" is a hint and not a promise. The step is the round figure
 * nearest a quarter of the range, which can leave five or six gaps rather
 * than four — and that is the right way round, because a reader notices an
 * axis labelled in odd figures long before they notice one with an extra
 * gridline on it.
 *
 * Never below a cent, because the axis is drawn in integer cents like every
 * other amount here and a step of half a cent would put two gridlines on one
 * value. A range of nothing gets a step of a cent for the same reason: it is
 * a number the caller can divide by, and the caller with an empty range is
 * one `burnChartDomain` has already refused to build.
 */
export function moneyTickStep(spanCents: number): number {
  if (!(spanCents > 0)) return 1;

  const rough = spanCents / TICK_INTERVALS;
  const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(rough)));
  const chosen = TICK_MULTIPLES.find(
    (candidate) => rough / magnitude >= candidate.from,
  );
  return Math.max(1, magnitude * (chosen?.multiple ?? 1));
}

/**
 * The point an axis starts shortening its labels: ten thousand dollars.
 *
 * Below it the figures are four characters and read instantly; above it they
 * are eight or more and start to crowd the plot. The threshold is checked
 * against the whole axis rather than each tick, so the labels down one side
 * are all in one style.
 */
const COMPACT_FROM_CENTS = 10_000 * DOLLARS;

/** A gridline on the money axis: the amount, and what it is labelled. */
export type MoneyTick = {
  /** The amount the gridline is drawn at, in cents. */
  readonly cents: number;
  /** What the margin reads beside it. */
  readonly label: string;
};

/**
 * The gridlines down the money axis, from the bottom of the range upwards.
 *
 * Every multiple of the step that falls inside the range, which always
 * includes zero — the step divides it, and the range always contains it. That
 * is not a coincidence worth leaving to chance: zero is the day the budget
 * runs out, and it is the one line on a burn-down that has to be labelled.
 *
 * The ends of the range are not forced onto the list. A contract of $4,250
 * gets gridlines at the round thousands and none at $4,250 itself, because
 * the contract value is already on the page in words above the chart and a
 * tick at an odd figure makes every other tick look approximate.
 *
 * A range that is empty or upside down has no gridlines rather than one at
 * the bottom. Nothing reaches here with one — `burnChartDomain` refuses to
 * build a domain with no height — and the alternative to answering is a loop
 * that does not end.
 */
export function moneyAxisTicks(
  bottomCents: number,
  topCents: number,
): MoneyTick[] {
  if (!(topCents > bottomCents)) return [];

  const step = moneyTickStep(topCents - bottomCents);
  const largest = Math.max(Math.abs(topCents), Math.abs(bottomCents));
  const unit = largest >= COMPACT_FROM_CENTS ? unitForAxis(largest) : DOLLARS;

  const ticks: MoneyTick[] = [];
  for (
    let cents = Math.ceil(bottomCents / step) * step;
    cents <= topCents;
    cents += step
  ) {
    ticks.push({ cents, label: compactMoneyLabel(cents, unit) });
  }
  return ticks;
}

/**
 * A day along the bottom of the chart: `Mar 1`, or `Mar 1, 2026` on a chart
 * that runs across New Year.
 *
 * Shorter than `formatDate`, which is right for a fact in a list and too long
 * for three labels sharing an axis. The year is carried by the sentence under
 * the chart, which names the whole span — so repeating it under every tick
 * spends the width that keeps the labels from touching.
 *
 * It comes back when the chart itself crosses a year, because then the two
 * ends really are different Marches and the axis would otherwise read as
 * though the engagement had gone round in a circle. Decided once for the
 * whole axis by `dateAxisTicks`, like the money style.
 *
 * A day that is not a calendar date is handed back as it stands, the same
 * fallback `formatDate` makes: a label that looks wrong is easier to trace
 * than a chart that will not render.
 */
export function axisDateLabel(onDate: string, withYear = false): string {
  const parts = calendarDateParts(onDate);
  if (parts === null) return onDate;
  const day = `${parts.month} ${parts.day}`;
  return withYear ? `${day}, ${formatYear(parts.year)}` : day;
}

/**
 * How long a chart has to be before a day is named in the middle of it.
 *
 * Four days. Below that the midpoint is a day either end is nearly touching,
 * and three labels within a week of each other read as a chart that thinks
 * its own span is more interesting than its line.
 */
const MIDDLE_TICK_FROM_DAYS = 4;

/** A day named under the chart, and how its label sits over the tick. */
export type DateTick = {
  /** The day: `YYYY-MM-DD`. */
  readonly onDate: string;
  /** What the axis reads beneath it. */
  readonly label: string;
  /** Where the label hangs relative to its day, so it stays in the box. */
  readonly anchor: "start" | "middle" | "end";
};

/**
 * The days named along the bottom of the chart: both ends, and the middle of
 * a span long enough to have one.
 *
 * Three labels at most, against a gridline for every round thousand up the
 * other axis — deliberately lopsided. Money is what the reader is comparing
 * and dates are what they are placing it in, and a date under every reading
 * is both unreadable at this width and impossible to lay out on a server
 * that cannot measure its own text.
 *
 * The anchors are what keep the labels inside the picture without measuring
 * them. The first hangs off the left edge of its tick and the last off the
 * right, so neither overruns the plot however wide the text turns out to be;
 * only the middle one is centred, where there is room on both sides.
 *
 * A chart of a single day gets one label, centred, because that is where
 * `burnChartX` puts its one point.
 *
 * Both ends have to be calendar dates. They come from readings that were
 * checked on the way in, and a span that is not two days cannot be halved.
 */
export function dateAxisTicks(from: string, to: string): DateTick[] {
  const days = calendarDayGap(from, to);
  const withYear =
    calendarDateParts(from)?.year !== calendarDateParts(to)?.year;

  const start: DateTick = {
    onDate: from,
    label: axisDateLabel(from, withYear),
    anchor: days === 0 ? "middle" : "start",
  };
  if (days === 0) return [start];

  const end: DateTick = {
    onDate: to,
    label: axisDateLabel(to, withYear),
    anchor: "end",
  };
  if (days < MIDDLE_TICK_FROM_DAYS) return [start, end];

  const middle = shiftCalendarDate(from, Math.round(days / 2));
  return [
    start,
    { onDate: middle, label: axisDateLabel(middle, withYear), anchor: "middle" },
    end,
  ];
}
