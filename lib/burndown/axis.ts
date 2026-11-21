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
