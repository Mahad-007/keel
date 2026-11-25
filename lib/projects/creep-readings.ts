import type { BurnSummary } from "@/lib/burn";
import {
  allDelivered,
  deliveredShare,
  negativeEstimateCount,
  unestimatedCount,
  unestimatedDeliveredCount,
  type ScopeLine,
} from "@/lib/scope";
import {
  assessScopeCreep,
  type CreepAssessment,
  type CreepReadings,
  DEFAULT_CREEP_THRESHOLDS,
} from "@/lib/scope-creep";

import { hasValuedBurn } from "./burn-summary";

/**
 * Where a project's two creep readings come from.
 *
 * `lib/scope-creep.ts` takes eight facts and returns a verdict, and it is
 * deliberately ignorant of where any of them came from — which is right for
 * the classifier and leaves exactly one job undone: four modules have to be
 * read in the right order and their answers put in the right arguments. Until
 * today the only place that happened was a test fixture, and a fixture is not
 * something a page can call.
 *
 * So this is that assembly, written once. The expensive way to get it wrong is
 * silent in every unit test on either side of it: swap the two shares and a
 * project that delivered everything for a tenth of its budget is `over`, while
 * the one burning its contract on nothing reads `healthy`. One module that does
 * it, with the integration test pointed at the same module the page uses, is
 * what makes that mistake impossible to make twice.
 *
 * Here rather than in `lib/scope-creep.ts` because it reaches for
 * `hasValuedBurn`, which lives beside the burn panel's words — and a classifier
 * that imported a panel's module would have the dependency the wrong way round.
 */

/**
 * The eight facts the classifier needs, read off one burn summary and one
 * scope list.
 *
 * The burn carries the money axis whole: `summariseBurn` has already divided
 * the hours at the rate by the contract value and refused the prices it cannot
 * divide by. The only thing asked of it beyond the share is whether the share
 * is a measurement — `hasValuedBurn`, which is the one place that decides
 * whether a burn of nought means a cheap project or a missing rate.
 *
 * The scope list carries the delivery axis and the four counts that say how far
 * to trust it. Each count is `lib/scope.ts`'s own, asked here rather than
 * recomputed, so the figure a verdict is withheld on and the figure the scope
 * panel prints are the same arithmetic.
 *
 * Taking the summary rather than the three columns behind it, because the
 * consumed share is the thing this needs and the summary is where the share is
 * decided. A caller handing over minutes and a rate would be inviting a second
 * opinion about what a burn is.
 */
export function projectCreepReadings(
  summary: BurnSummary,
  lines: readonly ScopeLine[],
): CreepReadings {
  return {
    consumedShare: summary.consumedShare,
    deliveredShare: deliveredShare(lines),
    lineCount: lines.length,
    unestimatedCount: unestimatedCount(lines),
    unestimatedDeliveredCount: unestimatedDeliveredCount(lines),
    negativeEstimateCount: negativeEstimateCount(lines),
    burnValued: hasValuedBurn(summary),
    scopeDelivered: allDelivered(lines),
  };
}

/**
 * The whole assessment of one project, read straight off its burn and its
 * scope list.
 *
 * The call a page makes. `projectCreepReadings` stays exported because the
 * readings are worth asserting on one at a time, but nothing that shows a
 * reader a verdict should be assembling eight facts itself — the point of the
 * assessment is that the verdict, the reasons, the gaps and the figures all
 * came from one reading of one project, and that guarantee survives exactly as
 * far as the number of places that build the readings.
 */
export function assessProjectCreep(
  summary: BurnSummary,
  lines: readonly ScopeLine[],
): CreepAssessment {
  return assessScopeCreep(
    projectCreepReadings(summary, lines),
    DEFAULT_CREEP_THRESHOLDS,
  );
}
