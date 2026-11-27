import {
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import type { CreepReason } from "@/lib/scope-creep";

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
