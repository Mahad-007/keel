import type { CreepThresholds } from "@/lib/scope-creep";

import type { ResolvedThresholds } from "./resolve";
import { shareFromPercent } from "./scale";

/**
 * The boundary between the settings and the classifier: five resolved columns
 * in, the three shares `lib/scope-creep.ts` compares against out.
 *
 * Two jobs, and both of them are the kind that go wrong silently when they are
 * done at the call site. It picks the three settings the creep verdict rests
 * on out of the five, and it converts each from the whole percent a column
 * holds to the fraction a comparison needs. A page that did either itself
 * could hand the classifier a threshold of eighty — which no consumed share
 * reaches, so nothing would ever be flagged again and no test of the
 * classifier would notice.
 *
 * Here rather than in `lib/scope-creep.ts` because the classifier has no
 * business knowing what a column holds, and not in `resolve.ts` because the
 * resolution has no business knowing which of the five settings a verdict
 * uses. This is the one module that knows both, and it is four lines long.
 */
export function creepThresholds(
  resolved: ResolvedThresholds,
): CreepThresholds {
  return {
    nearlySpentShare: shareFromPercent(resolved.nearlySpentPercent.value),
    aheadOfDeliveryGap: shareFromPercent(resolved.aheadOfDeliveryPercent.value),
    farAheadOfDeliveryGap: shareFromPercent(
      resolved.farAheadOfDeliveryPercent.value,
    ),
  };
}
