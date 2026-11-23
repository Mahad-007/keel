/**
 * What is wrong with the forecast, and how much of it to believe.
 *
 * `forecast.ts` will produce a date and an overage from any pace and any scope
 * list it is handed, and it is right to: the arithmetic is the arithmetic. But
 * a date is the most authoritative-looking thing this app prints. "The
 * contract runs out on 13 April" reads like a fact, and it is two divisions
 * away from a fortnight of one person's timesheet. A project three readings
 * old, half of whose deliverables were never sized, whose history was
 * reconstructed by a backfill, produces exactly the same confident Thursday as
 * one with six months of measured rows.
 *
 * So this file is not decoration and it is not a disclaimer. It is the half of
 * the milestone that makes the other half publishable. Every weakness the
 * forecast has is named, each one is traced to the row or the column that
 * causes it, and the panel is forbidden from printing a date without them.
 *
 * Two things come out. A list of caveats, each a specific thing a reader can
 * check and most of them a thing somebody can fix — an unsized deliverable is
 * a form to go and fill in. And one word grading the lot, because a reader
 * scanning a portfolio needs to know whether to read the caveats at all.
 *
 * The grade is derived from the caveats and never measured separately. A
 * confidence worked out from the figures directly would be a second opinion
 * about what makes a forecast weak, and the two would disagree on the page —
 * the dangerous direction being a forecast graded firm with three caveats
 * under it.
 */

/**
 * How much of the forecast to believe: three grades, worst last.
 *
 * Three rather than a percentage, which is the same choice the scope health
 * verdict makes and for a stronger reason here. A confidence of 63% would be
 * a number nobody could check, derived from weights nobody chose, and it would
 * invite exactly the arithmetic it cannot support — multiplying the overage by
 * it, say. Three words can be read, and each one maps to a decision: act on
 * it, look into it, or go and fix the data first.
 *
 *   - `firm` — every input the forecast wants is present and measured. It is
 *     still a forecast, and the sentence that introduces it still says so.
 *   - `indicative` — the shape is right and the figures will move. Something
 *     is approximate: the history was reconstructed, the pace has changed, or
 *     part of the scope was never sized.
 *   - `weak` — the basis is too thin to extrapolate from at all. Three days of
 *     readings, or no deliverables to project against. The figures are shown
 *     because withholding them would be its own kind of dishonesty, and the
 *     grade says not to quote them.
 *
 * Order is severity order, which is what `confidenceSeverity` reads.
 */
export const PROJECTION_CONFIDENCE = ["firm", "indicative", "weak"] as const;

export type ProjectionConfidence = (typeof PROJECTION_CONFIDENCE)[number];

/**
 * How bad a grade is, as a number, so two can be compared.
 *
 * Its index in the list, like `healthSeverity` — the order is the declaration
 * order, so a grade cannot be added without taking a position on where it
 * sits, and there is no second table to keep in step.
 */
export function confidenceSeverity(confidence: ProjectionConfidence): number {
  return PROJECTION_CONFIDENCE.indexOf(confidence);
}

/**
 * The worse of two grades.
 *
 * The rule every list of caveats is folded with: one weak input makes the
 * whole forecast weak, however much else is in good order. A grade that
 * averaged its caveats would let a project with four problems and ten clean
 * inputs read as middling, and the four problems are the whole of what a
 * reader needs.
 */
export function worstConfidence(
  a: ProjectionConfidence,
  b: ProjectionConfidence,
): ProjectionConfidence {
  return confidenceSeverity(a) >= confidenceSeverity(b) ? a : b;
}
