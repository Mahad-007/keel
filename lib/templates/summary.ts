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
