import {
  thresholdProblems,
  unusableSettingLabels,
  type ThresholdProblem,
} from "./coherence";
import { PERCENT_WHOLE } from "./scale";
import { THRESHOLD_SETTINGS, type ThresholdKey } from "./settings";
import type {
  ResolvedThreshold,
  ResolvedThresholds,
  ThresholdSource,
} from "./resolve";

/**
 * The words a threshold is read in: what it says, and where it came from.
 *
 * The settings half of what `lib/projects/scope-health.ts` does for a verdict.
 * The spec and the resolution deal in codes and integers, deliberately — a
 * portfolio row and a form label want different sentences out of the same
 * figures — and this is the file that has the words, so nothing that renders
 * one has to invent them.
 *
 * The provenance is the part worth having written down. A figure on its own
 * cannot be acted on: 70% might be this project's own setting, the client's
 * agreement, or a default that has never been looked at, and a reader who
 * wants it changed opens a different form in each case.
 */

/**
 * A figure in its own unit, for a label or a table cell.
 *
 * The unit comes off the spec rather than from the key's name, so a setting
 * added in days is printed in days without anything here being told about it.
 * Days are spelled out and singular where it matters — "1 day" is not a window
 * the form allows, but a figure a reader is shown should never read "1 days".
 */
export function formatThresholdValue(
  key: ThresholdKey,
  value: number,
): string {
  if (THRESHOLD_SETTINGS[key].unit === "days") {
    return value === 1 ? "1 day" : `${value} days`;
  }
  return `${value}%`;
}

/**
 * What a percentage setting leaves behind, for the money axis only.
 *
 * The share of the contract still unspent when a project is first flagged —
 * four fifths of a contract watched from leaves a fifth. It used to be a phrase
 * in `scope-health.ts` that said "a fifth" out loud, which was true of exactly
 * one threshold; here it is read off the figure in force, so a client watched
 * from 70% is told three tenths are left rather than a fifth.
 *
 * Only meaningful for the nearly-spent setting, which is why it takes a plain
 * figure rather than a key: a gap threshold has no remainder, and a window of
 * days has nothing to be a share of.
 */
export function remainingContractPercent(nearlySpentPercent: number): number {
  return PERCENT_WHOLE - nearlySpentPercent;
}

/**
 * Which form to open to change a figure: the project's, the client's, or
 * nobody's.
 *
 * Short enough for a table cell, because that is where it is read — five rows
 * of label, figure and provenance, and a sentence in each would be a paragraph
 * of boilerplate. The heading above the table is where the chain is explained
 * once.
 *
 * "Keel's default" rather than "Not set": the figure is in force and is being
 * applied, and "not set" would read as nothing happening. It is also the only
 * one of the three that names no row, which is the honest shape of it — there
 * is no form behind that answer, only this repo's opinion.
 */
export const THRESHOLD_SOURCE_LABEL: Record<ThresholdSource, string> = {
  project: "Set on this project",
  client: "From the client",
  default: "Keel's default",
};

/**
 * One setting in force, in words: what it is called, what it is, and where it
 * came from.
 *
 * The row a settings table renders, assembled here rather than in the
 * component, so the figure and the provenance beside it are read off one
 * resolution. A component that took the five settings and looked each one up
 * itself could print a figure from one reading next to a source from another.
 */
export type ThresholdLine = {
  /** The setting, as the form labels it. */
  readonly label: string;
  /** What is in force, in its own unit. */
  readonly value: string;
  /** Which form to open to change it. */
  readonly source: string;
  /** What the setting does, for the line under the row. */
  readonly hint: string;
};

export function thresholdLine(
  key: ThresholdKey,
  resolved: ResolvedThreshold,
): ThresholdLine {
  const setting = THRESHOLD_SETTINGS[key];
  return {
    label: setting.label,
    value: formatThresholdValue(key, resolved.value),
    source: THRESHOLD_SOURCE_LABEL[resolved.source],
    hint: setting.hint,
  };
}

/**
 * What the money threshold in force means for this project, in a sentence.
 *
 * The one setting of the five whose consequence is not obvious from the figure.
 * "Flagged at 70%" tells a reader when the banner appears; what they actually
 * want to know is what is left at that point to cover the rest of the work,
 * which is the judgement the threshold encodes and the thing they are being
 * asked to agree with.
 *
 * The remainder is read off the figure in force rather than written out, so a
 * client watched from seven tenths is told three tenths are left. That sentence
 * used to say "a fifth" in the banner itself, which was true of exactly one
 * threshold — the default — and wrong for everybody who moved it.
 *
 * A threshold of the whole price leaves nothing, and says so: it is a legal
 * setting and a real choice, meaning "only tell me once the money has gone",
 * and a reader who has chosen it should see what they chose.
 */
export function describeNearlySpentSetting(percent: number): string {
  const left = remainingContractPercent(percent);
  if (left === 0) {
    return `Flagged only once the whole contract value is burned, which leaves nothing to cover what is still outstanding.`;
  }
  return `Flagged once ${percent}% of the contract value is burned, which leaves ${left}% to cover whatever is still outstanding.`;
}

/**
 * What is wrong with the settings in force, in a sentence a reader can act on.
 *
 * A record over every problem rather than a chain of conditions, so a third
 * problem added to `coherence.ts` is a compile error here — the one place that
 * has words for it — rather than a settings page that silently shows nothing.
 * The same arrangement `REASON_SENTENCE` keeps, for the same reason.
 *
 * Each sentence quotes the figures in force and says where they came from,
 * because that is the whole of what a reader needs: the crossed pair is two
 * fields that are each fine, and which form to open depends on which of the two
 * was the mistake.
 *
 * Both sentences say that the settings are *still being applied*. Nothing here
 * repairs a figure or withholds a verdict, deliberately — a project quietly
 * classified at the defaults while its own settings page showed something else
 * would be the one project nobody could debug — so the honest thing is to say
 * the verdict above was reached at these figures and that they are wrong.
 */
const THRESHOLD_PROBLEM_SENTENCE: Record<
  ThresholdProblem,
  (resolved: ResolvedThresholds) => string
> = {
  "unusable-setting": (resolved) => {
    const labels = unusableSettingLabels(resolved);
    const names = labels.join(" and ");
    const verb = labels.length === 1 ? "is" : "are";
    return `${names} ${verb} set to a figure this form would not accept. It is still what the verdict above was reached at, so correct it before trusting the flag.`;
  },
  "crossed-delivery-gaps": (resolved) => {
    const ahead = resolved.aheadOfDeliveryPercent;
    const far = resolved.farAheadOfDeliveryPercent;
    return `The gap that merely flags this project (${ahead.value}%, ${THRESHOLD_SOURCE_LABEL[
      ahead.source
    ].toLowerCase()}) is not below the gap that calls it over (${far.value}%, ${THRESHOLD_SOURCE_LABEL[
      far.source
    ].toLowerCase()}), so nothing is ever merely watched on the delivery axis — anything past the first figure is past the second.`;
  },
};

/**
 * Everything wrong with the settings in force, worst first, in sentences.
 *
 * The order is `thresholdProblems`'s, which puts the more consequential first.
 * Usually empty: every project nobody has configured, and most of the ones
 * somebody has.
 */
export function thresholdProblemSentences(
  resolved: ResolvedThresholds,
): readonly string[] {
  return thresholdProblems(resolved).map((problem) =>
    THRESHOLD_PROBLEM_SENTENCE[problem](resolved),
  );
}
