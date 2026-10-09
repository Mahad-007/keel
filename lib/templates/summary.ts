import { formatMinutes } from "@/lib/minutes";
import { deliverablesPhrase } from "@/lib/projects/scope-summary";
import {
  totalEstimatedMinutes,
  unestimatedCount,
  type EstimatedLine,
} from "@/lib/scope";

/**
 * What a template adds up to, and how to say it in one line.
 *
 * A template in a picker is one line of text, and that line has to answer the
 * only question a reader has in front of it: is this the big one or the small
 * one? Two templates called "Website build" and "Website build (retainer)" are
 * told apart by their size far more reliably than by their names.
 *
 * The totals come from `lib/scope.ts` rather than being summed again here. A
 * template is a scope list that has not been agreed yet, and the whole point of
 * it is that applying it produces the figures the scope panel will then show —
 * two spellings of the same sum is how a template promises eight hours and
 * delivers seven.
 */

/** A template's shape in numbers: how many lines, how long, how many unsized. */
export type TemplateSize = {
  readonly lineCount: number;
  /** The whole template in whole minutes. Unestimated lines add nothing. */
  readonly estimatedMinutes: number;
  /** How many lines carry no estimate, which says how far to trust the total. */
  readonly unestimatedCount: number;
};

export function templateSize(lines: readonly EstimatedLine[]): TemplateSize {
  return {
    lineCount: lines.length,
    estimatedMinutes: totalEstimatedMinutes(lines),
    unestimatedCount: unestimatedCount(lines),
  };
}

/**
 * A template's size on one line, for the option that offers it.
 *
 * The count leads, because it is the thing a reader is choosing between, and
 * the estimate follows it. A template with nothing sized says so instead of
 * claiming `0m`, which is the same lie a zero estimate tells anywhere else in
 * this app: no deliverable takes no time, so a zero is a missing number.
 *
 * A middle dot rather than a comma between the two, because both halves are
 * already phrases with their own commas once there is something unsized to
 * mention.
 */
export function templateSizeLabel(size: TemplateSize): string {
  const count = deliverablesPhrase(size.lineCount);
  if (size.lineCount === 0) return "empty";
  if (size.unestimatedCount >= size.lineCount) return `${count} · not estimated`;

  const total = formatMinutes(size.estimatedMinutes);
  if (size.unestimatedCount === 0) return `${count} · ${total}`;
  return `${count} · ${total}, ${size.unestimatedCount} not estimated`;
}
