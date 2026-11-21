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

import type { BurnReading } from "./reading";

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
