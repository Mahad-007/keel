import {
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import {
  CREEP_BLIND_SPOTS,
  type CreepBlindSpot,
  type CreepReason,
} from "@/lib/scope-creep";

import { UNASSESSED_BAND, type RiskBand } from "./band";

/**
 * The words the portfolio is read in.
 *
 * `lib/projects/scope-health.ts` is the project page's half of this: it turns
 * the classifier's codes into sentences long enough to argue with, because a
 * banner has a tab to itself and a reader who has opened one project wants the
 * whole argument.
 *
 * A portfolio row has a line. So this file says the same things shorter — and
 * says them *beside* the figures rather than with the figures in them, because
 * a table already has columns for the shares and a sentence quoting them again
 * would be the same number twice in one row. The clause names the comparison;
 * the columns carry what it came out at; the reader checks one against the
 * other.
 *
 * Every word a verdict is called is borrowed from the banner rather than
 * written again. A reader who scans the portfolio and clicks through to a
 * project must land on the same verdict in the same words, and the only way to
 * promise that is for there to be one copy of them.
 */

/**
 * What each band is called: the banner's own headings, with a name for the
 * band the banner has no verdict for.
 *
 * Borrowed rather than restated. "Over scope" at the top of a project and
 * "Overspent" on the portfolio row that sent the reader there would be two
 * names for one finding, and a reader would reasonably wonder whether they are
 * two findings.
 *
 * A record over every band rather than a chain of conditions, so a fifth band
 * is a compile error here rather than a column with nothing in it.
 */
export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  over: SCOPE_HEALTH_HEADLINE.over,
  watch: SCOPE_HEALTH_HEADLINE.watch,
  [UNASSESSED_BAND]: NOT_ASSESSED_HEADLINE,
  healthy: SCOPE_HEALTH_HEADLINE.healthy,
};

/**
 * What one band is called.
 *
 * A function over the record so a caller holding a band does not have to know
 * it is safe to index with — which it is, the band being a union of four
 * literals, but the record is also the thing that would be indexed with a
 * string from somewhere else the day a band came off a URL.
 */
export function riskBandLabel(band: RiskBand): string {
  return RISK_BAND_LABELS[band];
}

/**
 * What flagged a project, in a clause with no figures in it.
 *
 * The banner's sentences quote the two shares, because a banner is the only
 * thing on its page that reaches a conclusion and a reader has nowhere else to
 * find them. A portfolio row has the shares in columns an inch to the right,
 * so quoting them here would print the same percentage twice on one line and
 * make the row twice as tall to do it.
 *
 * What is left is the comparison, named. "Burn is far ahead of the work
 * delivered" beside 90%, 25% and 65 points is the whole argument: the clause
 * says which two figures were set against each other, the columns say what
 * they came out at, and a reader who disagrees knows which one to go and look
 * at. That is the same deal the banner offers, laid out sideways.
 *
 * Present tense and no trailing consequence, unlike the banner. A row is read
 * in a scan down a column of them, and "so somebody has to decide whether to
 * keep logging hours" is a clause nobody reads eleven times — it belongs on the
 * project, which is one click away and says it.
 *
 * A record over every reason rather than a chain of conditions, so a fifth
 * comparison added to the classifier is a compile error here rather than a row
 * with an empty cell where the reason should be.
 */
export const REASON_CLAUSE: Record<CreepReason, string> = {
  "contract-overspent": "Burn has passed the contract value.",
  "burn-far-ahead-of-delivery": "Burn is far ahead of the work delivered.",
  "contract-nearly-spent": "The contract is nearly spent.",
  "burn-ahead-of-delivery": "Burn is ahead of the work delivered.",
};

/**
 * What the verdict could not see, in a clause.
 *
 * `BLIND_SPOT_SENTENCE` is the banner's version, and every one of those is two
 * sentences: the consequence, then the form that fixes it. That is right on a
 * project page, where the reader has already decided to look at this
 * engagement and the fix is a tab away.
 *
 * On a portfolio row it would be a paragraph per line, eleven lines deep, and
 * the eleven paragraphs would be mostly the same words. So these say the
 * missing fact and stop. The project name beside them is the link to the form,
 * which is the only part of the banner's second sentence that was ever doing
 * work here.
 *
 * The three about the money each end a verdict outright, and they are the only
 * clause an unassessed row ever shows — a withheld verdict is withheld for one
 * of those three reasons and no other. The five about the scope ride under a
 * verdict that stands, saying what it was reached without.
 *
 * A record over every blind spot, so a ninth one is a compile error in the one
 * file that has to have words for it.
 */
export const BLIND_SPOT_CLAUSE: Record<CreepBlindSpot, string> = {
  "no-contract-value": "No contract value is set, so there is nothing for the hours to be a share of.",
  "burn-not-valued": "Hours are logged and no rate values them, so the burn cannot be read.",
  "burn-below-zero": "The rate values the hours below zero, so the burn runs backwards.",
  "scope-not-estimated": "Nothing is estimated, so how much of the work is done cannot be read.",
  "scope-estimates-invalid": "An estimate is below zero, so the delivered share is not a reading of completion.",
  "scope-partly-estimated": "Some lines carry no estimate, so the delivered share is the best case.",
  "scope-delivery-unsized": "A line is delivered with no estimate, so completion cannot be bounded.",
  "scope-too-coarse": "The scope is one line, so it reads as nothing delivered until it is signed off.",
};

/**
 * The first thing the verdict could not see, or nothing at all.
 *
 * One clause rather than all of them, because a row has a line. The
 * classifier's order puts the money gap first and the scope gap after, which
 * is the order of what to do about it — so the first is the one to show, and
 * the one left out is the one a reader finds on the project.
 *
 * Takes the list rather than the assessment, so a caller holding one blind
 * spot can ask about it, and so the degenerate case — none at all, which is
 * most projects — is answered without building anything.
 */
export function firstBlindSpotClause(
  blindSpots: readonly CreepBlindSpot[],
): string | null {
  const [first] = blindSpots;
  return first === undefined ? null : BLIND_SPOT_CLAUSE[first];
}

/**
 * Every blind spot the classifier can report, in the classifier's own order.
 *
 * Here so a test can walk the list the codes come from rather than a list
 * written out beside the clauses — which would still pass the day a ninth
 * blind spot arrived with no words for it.
 */
export const BLIND_SPOTS_IN_ORDER: readonly CreepBlindSpot[] = CREEP_BLIND_SPOTS;
