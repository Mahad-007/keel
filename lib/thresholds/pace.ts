import type { PaceSettings } from "@/lib/projection/rate";

import type { ResolvedThresholds } from "./resolve";
import { shareFromPercent } from "./scale";

/**
 * The boundary between the settings and the projection: five resolved columns
 * in, the two figures the pace comparison needs out.
 *
 * `creepThresholds`'s counterpart, and it exists for the same two reasons. It
 * picks the two settings the forecast rests on out of the five, and it converts
 * the one that is a share — the pace shift — while leaving the one that is
 * already a count of days alone.
 *
 * That asymmetry is the whole reason this is a named function rather than an
 * object literal at the call site. A window divided by a hundred is a window of
 * nought days, which makes every recent pace null and silently withdraws the
 * caveat that says a project has sped up; a shift threshold left at 25 means no
 * pace change is ever reported, because no project runs twenty-five times its
 * own average. Both failures look like a panel with nothing to say.
 */
export function paceSettings(resolved: ResolvedThresholds): PaceSettings {
  return {
    recentWindowDays: resolved.recentRateWindowDays.value,
    paceShiftThreshold: shareFromPercent(resolved.paceShiftPercent.value),
  };
}
