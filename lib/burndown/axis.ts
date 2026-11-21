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

/**
 * An amount on an axis, shortened: twelve and a half thousand dollars as
 * `12.5K`, a million and a bit as `1.2M`.
 *
 * For the left-hand side of a chart whose axis runs into five figures, where
 * the amount written out four times down the margin is both hard to skim and
 * wide enough to squeeze the plot. One style per axis, decided once by
 * `moneyAxisTicks` — mixing a full figure and a shortened one down a single
 * column would make two ticks of the same axis look like two different
 * quantities.
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
export function compactMoneyLabel(cents: number): string {
  const magnitude = Math.abs(cents);
  if (magnitude < THOUSAND) return axisMoneyLabel(cents);

  const unit = magnitude >= MILLION ? MILLION : THOUSAND;
  const suffix = unit === MILLION ? "M" : "K";
  const scaled = Math.round((magnitude / unit) * 10) / 10;
  const sign = cents < 0 ? "-" : "";
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
 * ten.
 *
 * Ten is in the list as well as one, so a step that lands just above the top
 * of the range still has somewhere to go rather than falling off the end.
 * Two and a half is deliberately absent: it is a legitimate axis step, but it
 * produces fractional cents at the smallest magnitudes and a column of
 * figures that have to be read rather than recognised.
 */
const TICK_MULTIPLES = [1, 2, 5, 10];

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
  for (const multiple of TICK_MULTIPLES) {
    const step = magnitude * multiple;
    if (step >= rough) return step;
  }
  return magnitude * 10;
}
