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
