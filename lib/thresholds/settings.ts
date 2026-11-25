/**
 * Every number in this app that is a judgement rather than a measurement, in
 * one list, with its default and the range it may be set to.
 *
 * Five of them, and each one arrived with a paragraph of reasoning attached to
 * a constant: four fifths of a contract is where the money stops being
 * comfortable, a quarter of it ahead of the delivery is where a gap stops
 * being recoverable, a fortnight is the shortest window that survives a week
 * off. Every one of those paragraphs is a claim about *an* engagement, and
 * none of them is a claim about all of them — a retainer and a fixed-price
 * build do not have the same tolerance, and a figure that is well chosen for
 * one is a flag that never fires or never stops for the other.
 *
 * So the figures move, and the reasoning stays where it is. The constants in
 * `lib/scope-creep.ts` and `lib/projection/rate.ts` keep their long comments
 * and become the defaults here rather than being replaced by them: this file
 * holds no second opinion about what the right number is, only about what may
 * be typed over it.
 *
 * A spec rather than five pairs of columns handled one at a time. The
 * resolution, the form, the validation, the sentence naming where a setting
 * came from and the row showing it are all the same code five times over, and
 * written five times over is five places a sixth setting has to be added and
 * four places it will be forgotten. Driven off this record, a new setting is
 * an entry here and two columns.
 */

/**
 * The settings, in the order a form lays them out: the two that classify the
 * money and the work first, because those are the ones a reader has met on a
 * banner, then the two the projection rests on.
 *
 * Named for the unit they are stored in rather than for the fraction the
 * arithmetic uses. The column holds 80 and the classifier compares 0.8, and a
 * key called `nearlySpentShare` sitting over a stored 80 is exactly the sort of
 * near-miss that gets handed to a comparison unconverted — which fires at
 * eighty times the contract and therefore never fires at all.
 */
export const THRESHOLD_KEYS = [
  "nearlySpentPercent",
  "aheadOfDeliveryPercent",
  "farAheadOfDeliveryPercent",
  "recentRateWindowDays",
  "paceShiftPercent",
] as const;

/** One configurable judgement. */
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
