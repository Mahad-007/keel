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
 */
export function axisMoneyLabel(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: cents % DOLLARS === 0 ? 0 : 2,
  }).format(cents / DOLLARS);
}
