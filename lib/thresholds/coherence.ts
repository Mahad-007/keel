import { isThresholdValue } from "./column";
import type { ResolvedThresholds } from "./resolve";
import { THRESHOLD_KEYS, THRESHOLD_SETTINGS } from "./settings";

/**
 * Whether the figures a project ends up being judged by make sense together.
 *
 * Each setting is validated on its way in, one at a time, and that is as far as
 * a form can see: the two halves of a pair are different fields, on different
 * rows, and either may be inherited. So a project can arrive at a perfectly
 * valid pair of settings that contradict each other — a watch gap of half the
 * contract typed on the project, over a far-ahead gap of a fifth agreed with
 * the client — and no write was wrong.
 *
 * The classifiers do not refuse those. They test the worst band first, so a
 * crossed pair reads `over` from the lower figure: loud, and wrong in the safe
 * direction. What is missing is telling somebody, which is this file.
 *
 * Codes rather than sentences, like `CREEP_REASONS`, so a test can assert on a
 * problem without pinning prose — and so the settings page and whatever reads
 * it next can say it in their own words.
 */

export const THRESHOLD_PROBLEMS = [
  /** The watch gap sits at or above the gap that means over. */
  "crossed-delivery-gaps",
  /** Some setting in force is outside the range the form allows. */
  "unusable-setting",
] as const;

/** One way a project's settings do not make sense together. */
export type ThresholdProblem = (typeof THRESHOLD_PROBLEMS)[number];

/**
 * Whether the delivery axis has a watch band at all.
 *
 * The two gaps have to be the right way round or the middle band disappears:
 * at an equal pair, a project is `over` the instant it would have been
 * `watch`, and at a crossed pair the watch threshold is unreachable — anything
 * past it is past the over threshold too. Either way the axis has two verdicts
 * instead of three, and the one that goes missing is the one a reader can still
 * act on.
 *
 * Strictly less than, so an equal pair is a problem. A band of nothing is not a
 * narrow band, and somebody who typed the same figure twice meant one of them
 * to be something else.
 */
export function hasDeliveryWatchBand(resolved: ResolvedThresholds): boolean {
  return (
    resolved.aheadOfDeliveryPercent.value <
    resolved.farAheadOfDeliveryPercent.value
  );
}

/**
 * Whether every figure in force could have been typed into the form.
 *
 * A resolved threshold is carried as it was read — `resolveThreshold`
 * deliberately does not repair a stored figure out of range, because a project
 * classified at a threshold its own settings page cannot show is a project
 * nobody can debug. This is the question that makes that honest: the figure is
 * used, and the reader is told it should not have been there.
 *
 * Only reachable from a hand-edited row, a restored backup or an import. The
 * same provenance as a deliverable with no title, and the same reason to report
 * rather than crash.
 */
export function hasUsableSettings(resolved: ResolvedThresholds): boolean {
  return THRESHOLD_KEYS.every((key) =>
    isThresholdValue(key, resolved[key].value),
  );
}

/**
 * Everything wrong with the settings in force for one project, worst first.
 *
 * Worst first for the reason `creepReasons` is: a reader who stops after one
 * sentence should have been told the more consequential thing. An unusable
 * setting leads, because it means a figure in force is one no form would have
 * accepted — the whole pair of bands is then suspect — while crossed gaps are
 * two figures that are each fine and in the wrong order.
 *
 * Empty for the ordinary case, which is every project nobody has configured and
 * most of the ones somebody has.
 */
export function thresholdProblems(
  resolved: ResolvedThresholds,
): readonly ThresholdProblem[] {
  const problems: ThresholdProblem[] = [];
  if (!hasUsableSettings(resolved)) problems.push("unusable-setting");
  if (!hasDeliveryWatchBand(resolved)) problems.push("crossed-delivery-gaps");
  return problems;
}

/**
 * The settings in force that are outside their own range, worst first in the
 * order the form lays them out.
 *
 * What the sentence about an unusable setting needs: naming the fields is the
 * difference between "something is wrong with your thresholds" and a line a
 * reader can act on. In spec order rather than resolution order, so the list
 * reads in the order the boxes appear.
 */
export function unusableSettingLabels(
  resolved: ResolvedThresholds,
): readonly string[] {
  return THRESHOLD_KEYS.filter(
    (key) => !isThresholdValue(key, resolved[key].value),
  ).map((key) => THRESHOLD_SETTINGS[key].label);
}
