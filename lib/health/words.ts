import {
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";

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
