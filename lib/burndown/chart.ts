/**
 * The geometry of the burn-down chart: readings in, coordinates out.
 *
 * Everything here is pure arithmetic over numbers and calendar-date strings.
 * No element is created, no colour is chosen and nothing is formatted for a
 * reader — the component in `app/projects/[id]` turns what comes out of here
 * into SVG, and because the shape of the line is decided in this file rather
 * than in the markup, the parts of a chart that can be wrong about the data
 * are the parts that are tested.
 *
 * That split is what makes a server-rendered chart worth doing without a
 * charting library. A library's value is its scales, its ticks and its path
 * building; those are a few dozen lines when the chart is one line on one
 * axis, and they are lines that can be held to the same standard as the
 * invoicing arithmetic. What a library would also bring is a client bundle
 * and a second rendering pass, for a picture that never changes after it is
 * drawn.
 */

import { calendarDayGap } from "@/lib/dates";

import {
  dateAxisTicks,
  moneyAxisTicks,
  type DateTick,
  type MoneyTick,
} from "./axis";
import { reconstructedRuns, type BurnReading } from "./reading";

/**
 * The drawing surface, in user units, with room reserved around the plot.
 *
 * Fixed rather than measured, because nothing on the server knows how wide the
 * reader's window is. The SVG carries this as its `viewBox` and is given a
 * width of 100%, so the browser scales the whole picture — text included — to
 * whatever space it lands in. That is the trade a server-rendered chart makes:
 * a label cannot be re-laid-out at the reader's width, so the chart is drawn
 * once at a shape that works and scaled as a unit.
 *
 * The ratio is wide and short on purpose. A burn-down is read left to right
 * for its slope, and a square plot exaggerates every wobble into a cliff.
 *
 * The margins are not symmetrical and each one is sized for what sits in it:
 * the left holds the money labels, the bottom holds the dates, the right holds
 * the label on the end of the line, and the top is the only one that is plain
 * air — a line that reaches the top of its own axis should not touch the edge
 * of the picture.
 */
export type BurnChartBox = {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export const BURN_CHART_BOX: BurnChartBox = {
  width: 720,
  height: 260,
  top: 16,
  right: 108,
  bottom: 30,
  left: 68,
};

/** The rectangle the line itself is drawn in: the box less its margins. */
export type BurnChartArea = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The plot rectangle: where the margins end and the data starts.
 *
 * Four edges and two spans rather than an origin and a size, because every
 * caller wants edges — a gridline runs from `left` to `right`, a tick label
 * hangs off `bottom`, the area under the line closes at `bottom` — and a
 * caller that had to add a width to an origin to find the right-hand edge
 * would be the caller that forgot to.
 *
 * Derived from the box rather than written out beside it, so moving a margin
 * moves everything that depends on it and the two cannot disagree.
 */
export function burnChartArea(
  box: BurnChartBox = BURN_CHART_BOX,
): BurnChartArea {
  return {
    left: box.left,
    right: box.width - box.right,
    top: box.top,
    bottom: box.height - box.bottom,
    width: box.width - box.left - box.right,
    height: box.height - box.top - box.bottom,
  };
}

/**
 * The two ranges a burn-down is drawn against: the days it covers and the
 * money it moves through.
 *
 * `days` is the gap from the first reading to the last, so it is zero for a
 * project with a single day's reading rather than one — the count of steps
 * along the axis, not the count of days in the span.
 *
 * The money range is in cents, like every other amount in the codebase, and
 * it always contains zero. Zero is the line that matters on a burn-down: it
 * is the moment the money agreed runs out, and an axis that left it off would
 * be an axis a reader could not find the answer on.
 */
export type BurnChartDomain = {
  /** The day of the first reading: `YYYY-MM-DD`. */
  readonly from: string;
  /** The day of the last reading: `YYYY-MM-DD`. */
  readonly to: string;
  /** How many days from the first reading to the last. Zero for one day. */
  readonly days: number;
  /** The top of the money axis, in cents. Never below zero. */
  readonly topCents: number;
  /** The bottom of the money axis, in cents. Never above zero. */
  readonly bottomCents: number;
};

/**
 * What a project's readings have to be drawn against, or null when there is
 * nothing to draw.
 *
 * Null in two cases, and both of them are a chart that would mislead rather
 * than a chart that is empty. A project with no readings has no axis to put
 * one on. A project whose money never leaves zero — no price agreed and
 * nothing burned — would be drawn as a flat line along a baseline, which is
 * the same picture as an engagement that spent nothing of a real budget, and
 * those two deserve different answers. The panel says which it is in a
 * sentence; the chart declines to draw either.
 *
 * The top of the axis is the largest contract value any reading recorded, not
 * the current one. A project repriced mid-flight has two prices in its
 * history and both are true of the days they were recorded on, so the axis
 * has to hold the larger or the earlier half of the line would run off the
 * top.
 *
 * The bottom is zero unless a reading went past it. An engagement that burned
 * more than it was sold for has a remaining figure below zero, and the chart
 * shows it below the line rather than clipping it at the floor — the overrun
 * is the single most important thing a burn-down can say, and flattening it
 * against zero would say the budget merely ran out.
 *
 * The axis is deliberately not padded beyond that. A round number above the
 * top is the tick's business, and stretching the domain to reach one would
 * make the contract value sit somewhere other than where the eye expects it.
 */
export function burnChartDomain(
  readings: readonly BurnReading[],
): BurnChartDomain | null {
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first === undefined || last === undefined) return null;

  let topCents = 0;
  let bottomCents = 0;
  for (const reading of readings) {
    topCents = Math.max(topCents, reading.contractedCents, reading.remainingCents);
    bottomCents = Math.min(bottomCents, reading.remainingCents);
  }
  if (topCents === bottomCents) return null;

  return {
    from: first.onDate,
    to: last.onDate,
    days: calendarDayGap(first.onDate, last.onDate),
    topCents,
    bottomCents,
  };
}

/**
 * Where a day sits along the axis, in user units.
 *
 * Positioned by the calendar rather than by its place in the list, which is
 * the one decision in this file that changes what the chart means. Readings
 * exist only for days work was logged, so a project touched on the 1st and
 * then again in April has two readings — and plotting them a step apart would
 * draw a month of silence as a single stride. Spaced by the days between
 * them, the same two readings draw what actually happened: a long flat run
 * and then a move.
 *
 * A project with one day of readings has a domain zero days wide, and its one
 * point goes in the middle of the plot rather than hard against the left
 * edge. There is no slope to read either way; centred, it reads as a single
 * measurement, and flush left it reads as a line whose remainder is missing.
 *
 * Days outside the domain come back outside the plot, which is deliberate —
 * clamping would stack every stray reading on one edge and draw a vertical
 * wall. Nothing should hand this a day the domain does not cover; a caller
 * that does gets a coordinate that looks as wrong as it is.
 */
export function burnChartX(
  onDate: string,
  domain: BurnChartDomain,
  area: BurnChartArea,
): number {
  if (domain.days === 0) return area.left + area.width / 2;
  return (
    area.left +
    (calendarDayGap(domain.from, onDate) / domain.days) * area.width
  );
}

/**
 * Where an amount of money sits up the axis, in user units.
 *
 * Inverted, because SVG counts downwards from the top of the picture and
 * money counts upwards from nothing: the top of the domain is the smallest
 * `y` and the bottom of the domain is the largest. Doing that arithmetic in
 * the markup is how a chart ends up drawn upside down, which is why it is
 * here and tested.
 *
 * The domain always contains zero and is never empty — `burnChartDomain`
 * refuses to produce one that is — so there is no division by zero to guard
 * and no amount inside the domain that lands outside the plot.
 *
 * An amount outside the domain lands outside the plot, like a day outside the
 * span. The chart clips what it draws to the plot rather than clamping what
 * it is given: a clamped point would sit on an edge as though the figure were
 * the edge's value, and a reader would believe it.
 */
export function burnChartY(
  cents: number,
  domain: BurnChartDomain,
  area: BurnChartArea,
): number {
  const span = domain.topCents - domain.bottomCents;
  return (
    area.bottom - ((cents - domain.bottomCents) / span) * area.height
  );
}

/**
 * A coordinate rounded to the hundredth of a user unit.
 *
 * Two decimals is finer than a pixel at any width this chart is rendered at,
 * and it keeps the path data out of the fifteen-digit territory that floating
 * point produces by default — a two-year engagement is several hundred
 * points, and the difference is kilobytes of markup on every page load.
 *
 * Rounded once, here, so the dot on the end of the line and the last point of
 * the line itself are the same number rather than two numbers a hair apart.
 */
function plotUnit(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A reading and where on the picture it goes. */
export type PlottedBurnReading = {
  /** The reading, whole, so a label or a table row can be built from it. */
  readonly reading: BurnReading;
  readonly x: number;
  readonly y: number;
};

/**
 * Every reading placed on the picture, in the order the line runs through
 * them.
 *
 * The height is what the engagement had *left*, which is what makes this a
 * burn-down rather than a burn-up. Both lines carry the same information and
 * the difference is what the reader has to do with it: a climbing line of
 * money spent has to be subtracted from a price held in the head, and a
 * falling line of money left is read against a floor that is already on the
 * axis. The question the page is asking — is there enough budget to finish —
 * is answered by where the line is, not by how far it has come.
 */
export function plotBurnReadings(
  readings: readonly BurnReading[],
  domain: BurnChartDomain,
  area: BurnChartArea,
): PlottedBurnReading[] {
  return readings.map((reading) => ({
    reading,
    x: plotUnit(burnChartX(reading.onDate, domain, area)),
    y: plotUnit(burnChartY(reading.remainingCents, domain, area)),
  }));
}

/**
 * The `d` attribute of the line through every plotted reading.
 *
 * Straight segments, not a curve. A spline through these points would invent
 * money: between two readings a week apart the budget did not ease downwards
 * along a cubic, it sat still and then moved, and a curve that overshoots
 * would draw a day where less was left than any reading recorded. Straight
 * segments are the honest interpolation — they say "somewhere between these
 * two figures", which is all that is known.
 *
 * An empty series gives an empty string, which is a path that draws nothing
 * rather than an element that fails to parse. A single reading gives a bare
 * `M`, which also draws nothing: one point is not a line, and the dot on the
 * end of the series is what puts it on screen.
 */
export function burnLinePath(plotted: readonly PlottedBurnReading[]): string {
  return plotted
    .map((point, at) => `${at === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

/**
 * The `d` attribute of the wash under the line, closed on the day the money
 * runs out rather than on the floor of the picture.
 *
 * The baseline is zero-left, which is the whole point of filling the shape at
 * all: the wash is the budget still in hand, so it has to stop where the
 * budget does. Closing it on the bottom of the plot would fill the overrun
 * too, and an engagement that is $1,000 over would be drawn with more shading
 * than one that is $1,000 up.
 *
 * Below the baseline the same path keeps going, which is what lets the
 * component draw it twice against two clips — once above the line in the
 * series colour and once below it in the colour of a problem — without the
 * geometry being computed twice or the two halves meeting at a seam.
 *
 * Fewer than two readings gives an empty string. One point has no width, and
 * a path with no area is an element that renders nothing and still has to be
 * parsed.
 */
export function burnAreaPath(
  plotted: readonly PlottedBurnReading[],
  baselineY: number,
): string {
  const first = plotted[0];
  const last = plotted[plotted.length - 1];
  if (first === undefined || last === undefined || plotted.length < 2) {
    return "";
  }
  return `${burnLinePath(plotted)} L${last.x} ${baselineY} L${first.x} ${baselineY} Z`;
}

/**
 * How narrow a reconstructed stretch is allowed to be drawn: four user units.
 *
 * A single reconstructed day in the middle of a measured line is a stretch of
 * no width at all, and a band of no width marks nothing — the caveat under
 * the chart would be pointing at something the reader cannot see. Four units
 * is a sliver a few pixels wide: visible, and nowhere near wide enough to
 * claim the day beside it was reconstructed too.
 */
const MIN_BAND_WIDTH = 4;

/** A vertical stretch of the plot, shaded behind the line. */
export type ChartBand = {
  readonly x: number;
  readonly width: number;
};

/**
 * The stretches of the plot to shade as reconstruction rather than
 * measurement.
 *
 * Behind the line rather than on it, which is the honest weight for this: the
 * figures in a reconstructed stretch are real figures from real time entries,
 * valued at a rate nobody can prove was the rate at the time. Recolouring the
 * line there would say the readings are doubtful; a band behind it says the
 * period is, which is what `lib/burndown/origin.ts` actually claims.
 *
 * A stretch too narrow to see is widened to a sliver and nudged back inside
 * the plot, so a band never hangs off the end of the axis it is describing.
 */
export function reconstructedBands(
  readings: readonly BurnReading[],
  domain: BurnChartDomain,
  area: BurnChartArea,
): ChartBand[] {
  return reconstructedRuns(readings).map((run) => {
    const from = burnChartX(run.from, domain, area);
    const to = burnChartX(run.to, domain, area);
    const width = Math.max(to - from, MIN_BAND_WIDTH);
    const centred = from - (width - (to - from)) / 2;
    const x = Math.min(Math.max(centred, area.left), area.right - width);
    return { x: plotUnit(x), width: plotUnit(width) };
  });
}

/** A rectangle of the plot, used to clip a fill to one side of a line. */
export type ChartClip = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * A slice of the plot between two heights, or null when it has no height.
 *
 * Null rather than a rectangle of zero height, so a chart with nothing below
 * the baseline leaves the whole apparatus out — a clip path, a fill and an
 * element — rather than shipping one that covers nothing.
 */
function clipBetween(
  area: BurnChartArea,
  top: number,
  bottom: number,
): ChartClip | null {
  if (!(bottom > top)) return null;
  return {
    x: area.left,
    y: plotUnit(top),
    width: area.width,
    height: plotUnit(bottom - top),
  };
}

/** A gridline across the plot: the amount, its label and where it sits. */
export type PlottedMoneyTick = MoneyTick & { readonly y: number };

/** A day named under the plot, with the position of its tick. */
export type PlottedDateTick = DateTick & { readonly x: number };

/**
 * Everything the component needs to draw one project's burn-down, or null
 * when there is nothing worth drawing.
 *
 * One function, called once, returning a whole picture's worth of
 * coordinates — so the component is a list of elements with numbers in them
 * and holds no arithmetic of its own. That is what makes the chart testable:
 * everything that can be wrong about where a line goes is decided here, and
 * everything decided here is covered by the tests above.
 *
 * The two clips are how the wash under the line gets two colours without the
 * path being cut in two. The same closed shape is drawn twice, once through
 * each clip, so the budget still in hand and the part spent past it meet
 * exactly on the baseline rather than along a seam computed twice.
 *
 * `last` is the end of the line, pulled out because three things hang off it:
 * the dot, the label beside the dot, and the sentence under the chart. It is
 * never null, because a chart with no readings has no domain and this has
 * already returned.
 */
export type BurnDownChart = {
  readonly box: BurnChartBox;
  readonly area: BurnChartArea;
  readonly domain: BurnChartDomain;
  /** Every reading, placed, in the order the line runs through them. */
  readonly points: readonly PlottedBurnReading[];
  /** The last of them: where the dot and the end label go. */
  readonly last: PlottedBurnReading;
  /** The `d` of the line itself. */
  readonly linePath: string;
  /** The `d` of the wash, closed on the baseline. */
  readonly areaPath: string;
  /** Where the money runs out, in user units down the picture. */
  readonly baselineY: number;
  /** The part of the plot above the baseline, or null if there is none. */
  readonly inHand: ChartClip | null;
  /** The part below it, or null for an engagement still inside its price. */
  readonly overrun: ChartClip | null;
  readonly moneyTicks: readonly PlottedMoneyTick[];
  readonly dateTicks: readonly PlottedDateTick[];
  /** The stretches that were reconstructed rather than measured. */
  readonly reconstructed: readonly ChartBand[];
};

export function burnDownChart(
  readings: readonly BurnReading[],
  box: BurnChartBox = BURN_CHART_BOX,
): BurnDownChart | null {
  const domain = burnChartDomain(readings);
  if (domain === null) return null;

  const area = burnChartArea(box);
  const points = plotBurnReadings(readings, domain, area);
  const last = points[points.length - 1];
  if (last === undefined) return null;

  const baselineY = plotUnit(burnChartY(0, domain, area));

  return {
    box,
    area,
    domain,
    points,
    last,
    linePath: burnLinePath(points),
    areaPath: burnAreaPath(points, baselineY),
    baselineY,
    inHand: clipBetween(area, area.top, baselineY),
    overrun: clipBetween(area, baselineY, area.bottom),
    moneyTicks: moneyAxisTicks(domain.bottomCents, domain.topCents).map(
      (tick) => ({ ...tick, y: plotUnit(burnChartY(tick.cents, domain, area)) }),
    ),
    dateTicks: dateAxisTicks(domain.from, domain.to).map((tick) => ({
      ...tick,
      x: plotUnit(burnChartX(tick.onDate, domain, area)),
    })),
    reconstructed: reconstructedBands(readings, domain, area),
  };
}
