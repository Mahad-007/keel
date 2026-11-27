import type { ScopeHealth } from "@/lib/scope-creep";

/**
 * Where a project sits in the portfolio's order.
 *
 * `lib/scope-creep.ts` answers one project at a time, and its answer has four
 * values rather than three: `over`, `watch`, `healthy`, and null when the burn
 * could not be read at all. On a project page that null is a banner saying so.
 * On a page whose whole job is an order, it has to be a rung — a list cannot
 * sort an absence.
 *
 * So a band is the verdict with the absence named. Nothing is added and
 * nothing is decided: `riskBand` is a total function from the classifier's
 * four answers onto these four, and the only judgement in this file is where
 * the fourth one goes.
 */

/**
 * The bands, worst first — which is the order the page reads in.
 *
 * `over` and `watch` lead because they are findings: the comparison was made
 * and it came out badly, and somebody has a conversation to have this week.
 *
 * `unassessed` comes third, above healthy and below both flags. That placement
 * is the one argument in this module, and it runs both ways:
 *
 *   - **Above healthy**, because a withheld verdict is not a clean bill of
 *     health. The project that gets one is the project with hours logged and
 *     no rate to value them, or no price to measure them against — which is
 *     exactly the engagement nobody is watching, and sorting it in with the
 *     healthy ones would bury it under the projects that are fine. The whole
 *     reason `classifyScopeCreep` returns null rather than `healthy` is that
 *     the two must not collapse, and a ranking that put them together would
 *     undo that at the last step.
 *   - **Below both flags**, because a flagged project is a known problem and
 *     an unassessed one is an unknown. Somebody who reads three rows should
 *     have read the three engagements that are measurably in trouble; the row
 *     that says "fill in a field and I will tell you" is the next thing to do,
 *     not the first.
 *
 * `healthy` is last, which is where most of a working studio's projects are.
 * A portfolio read top-down is then the list of things to do, and it runs out
 * rather than ending.
 */
export const RISK_BANDS = ["over", "watch", "unassessed", "healthy"] as const;

/** Where one project sits in the order. */
export type RiskBand = (typeof RISK_BANDS)[number];

/**
 * The band that stands for a verdict the classifier withheld.
 *
 * Named rather than written as a string where it is needed, because it is the
 * one band that is not also a `ScopeHealth` — so it is the one a comparison
 * against a verdict has to special-case, and a misspelling of it would be a
 * band that sorts last by accident.
 */
export const UNASSESSED_BAND = "unassessed" as const satisfies RiskBand;

/**
 * Which band a verdict puts a project in.
 *
 * The verdicts pass straight through, because the bands are named after them
 * on purpose: a reader who has met "Over scope" on a project page meets the
 * same word at the top of the portfolio, and the two cannot drift because they
 * are the same value. Only the absence is translated.
 *
 * Total over the classifier's four answers, so there is no fifth outcome for a
 * page to render nothing for.
 */
export function riskBand(health: ScopeHealth | null): RiskBand {
  return health ?? UNASSESSED_BAND;
}

/**
 * Whether a band is one of the two the classifier reached by flagging
 * something.
 *
 * The question a count asks — "three of eleven active projects are flagged" —
 * and it is not the same as "not healthy": an unassessed project has not been
 * flagged, it has been skipped, and counting it as a finding would overstate
 * what the page knows. `over` and `watch` are findings; the other two are not.
 *
 * Written as "neither of the two that are not findings" rather than as a list
 * of the two that are, so a fourth verdict added to the classifier counts as a
 * finding by default. That is the right direction to be wrong in: a new
 * verdict nobody has taught this page about would be reported rather than
 * quietly folded in with the projects that are fine.
 */
export function isFlaggedBand(band: RiskBand): boolean {
  return band !== UNASSESSED_BAND && band !== "healthy";
}

/**
 * How far down the order a band sits: nought for the worst.
 *
 * An index into `RISK_BANDS` rather than a number written out per band, so the
 * list above is the single statement of the order and this cannot disagree
 * with it. A comparison sorts on the difference, so the figures only have to
 * be in the right order and not mean anything on their own.
 *
 * Every band is in the list, so the index is never -1 — which would sort an
 * unknown band above `over` and put the one row nobody could explain at the
 * top of the page.
 */
export function riskBandRank(band: RiskBand): number {
  return RISK_BANDS.indexOf(band);
}
