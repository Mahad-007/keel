/**
 * The two units a threshold lives in: whole percent in the column, a fraction
 * of one in the arithmetic.
 *
 * `lib/scope-creep.ts` compares shares — 0.8 of a contract, a gap of 0.25 —
 * because that is what a share of a contract divides out to, and every figure
 * on the overview is a fraction before it is a percentage. A column cannot
 * hold that: the repo stores integers, a stored 0.8 is a float in a database
 * that has been careful to keep them out, and the person typing the setting
 * types "80" rather than "0.8" anyway.
 *
 * So the boundary converts, and it converts in exactly one place. Two
 * roundings of one setting is how a form comes to show 80 for a threshold that
 * fires at 0.81, and a threshold a reader cannot predict is worse than a
 * threshold they disagree with.
 */

/**
 * How many of the stored units make the whole: a hundred, because the unit is
 * the percent.
 *
 * Named rather than written as `100` at each end of the conversion, so the two
 * directions cannot be given different scales — the failure that produces a
 * threshold a tenth of the one somebody typed, which fires on every project in
 * the app and reads as a bug in the classifier.
 */
export const PERCENT_WHOLE = 100;

/**
 * A stored whole percent as the fraction the classifiers compare against.
 *
 * Plain division, and the reason it is a named function is that the direction
 * is easy to get backwards and silent when it is: multiplying would turn a
 * threshold of 80% into one of 8,000% of the contract, which nothing would
 * ever reach, and the app would quietly stop flagging anything at all. A
 * function with a name is a thing a test can pin.
 *
 * Exact for the figures that matter. 80, 25 and 50 divided by a hundred are
 * each the nearest double to 0.8, 0.25 and 0.5 — the same values the constants
 * in `lib/scope-creep.ts` hold — so a project left on the defaults is
 * classified by precisely the arithmetic it was before any of this was
 * configurable. An awkward setting like 33 lands a fraction away from a third,
 * which moves no comparison a reader could observe.
 *
 * Nothing is clamped or checked here. What range a setting may take is the
 * spec's business, and it is enforced where a person can be told about it —
 * at the form, and at the column. This is the conversion alone.
 */
export function shareFromPercent(percent: number): number {
  return percent / PERCENT_WHOLE;
}

/**
 * A fraction as the whole percent a column would hold.
 *
 * The inverse, and it exists for one caller: the settings spec, which takes
 * its defaults from the share constants in `lib/scope-creep.ts` and
 * `lib/projection/rate.ts` rather than holding a second copy of them. Those
 * constants carry several paragraphs each explaining why they are the figures
 * they are, and a spec that spelled "80" out again would be the place the two
 * drifted apart — the default a form offers and the threshold the classifier
 * applies, one edited and the other not.
 *
 * Rounded, because multiplying by a hundred is not the exact inverse of
 * dividing by it: a seventh of a contract comes back as 14.285714285714285,
 * and a column cannot hold that. The nearest whole percent is the figure
 * somebody typed in the first place, so for every value this is actually
 * asked about — a stored setting on its way back out, or one of the documented
 * constants — the round trip is the identity.
 *
 * Which means it is lossy in one direction and only in one direction, and the
 * loss is in the half nothing stores. A share of 0.805 comes back as 81 and
 * converts forward to 0.81; no column and no form can produce 0.805, so the
 * only way to reach that is to hand this a figure from somewhere else, and the
 * answer it gives is the nearest setting that could have meant it.
 */
export function percentFromShare(share: number): number {
  return Math.round(share * PERCENT_WHOLE);
}
