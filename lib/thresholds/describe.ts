import { PERCENT_WHOLE } from "./scale";
import { THRESHOLD_SETTINGS, type ThresholdKey } from "./settings";
import type { ResolvedThreshold, ThresholdSource } from "./resolve";

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
