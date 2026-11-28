import type { BurnSummary } from "@/lib/burn";
import { formatCents } from "@/lib/money";
import { hasValuedBurn } from "@/lib/projects/burn-summary";
import {
  formatSharePoints,
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import { formatSharePercent } from "@/lib/projects/scope-summary";
import type { CreepBlindSpot, CreepReason } from "@/lib/scope-creep";

import {
  isFlaggedBand,
  RISK_BANDS,
  UNASSESSED_BAND,
  UNSTARTED_BAND,
  type RiskBand,
} from "./band";
import { countByBand } from "./portfolio";
import type { PortfolioRow } from "./row";

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
  /*
    Borrowed from nowhere, because the banner has no word for it: the project
    page renders no verdict at all for an engagement that has not begun, which
    is a choice a table cannot make. "Not started" rather than "Not assessed"
    — the distinction is the whole reason the band exists, and two rows reading
    the same would undo it.
  */
  [UNSTARTED_BAND]: "Not started",
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
 * What a figure that could not be read is printed as: an en dash.
 *
 * Not "0%", which is a measurement and would be the single most reassuring
 * thing this page could say about a project whose burn nobody could value.
 * Not "n/a", which says the page has no opinion when the page has a specific
 * one. A dash says there is no figure here, and the clause at the end of the
 * row says why there is not — which is the arrangement that keeps the columns
 * scannable without leaving the absence unexplained.
 *
 * The same en dash the timesheet uses for a cell with nothing in it, because a
 * reader should only have to learn one mark for "no figure".
 */
export const NO_FIGURE = "\u2013";

/**
 * A share of something, as a column reads it, or a dash where there is none.
 *
 * `formatSharePercent` for the figure, so the consumed share on this row and
 * the consumed share on the project's own burn panel round the same way. A
 * reader who scans the portfolio and clicks through must not find 80% become
 * 79%.
 *
 * Null is the ordinary case rather than an error, on both columns it serves: a
 * project with no price has no consumed share, and one with nothing estimated
 * has no delivered share. Each is a row this page exists to show.
 */
export function shareCell(share: number | null): string {
  return share === null ? NO_FIGURE : formatSharePercent(share);
}

/**
 * The gap between the two shares, as a column reads it, or a dash.
 *
 * `formatSharePoints`, which prints points rather than a percent — the two
 * shares either side of it are already percentages, and a third one between
 * them would read as a share of the contract rather than the distance between
 * the other two.
 *
 * It prints a negative gap as readily as a positive one, which is new here:
 * the classifier never flags a project whose delivery is ahead of its burn, so
 * the banner never shows one. A portfolio lists the healthy projects too, and
 * most of them are ahead — "-12 points" on a row that reads On track is the
 * figure that says why.
 */
export function gapCell(gap: number | null): string {
  return gap === null ? NO_FIGURE : formatSharePoints(gap);
}

/**
 * What the hours have cost, as a column reads it, or a dash.
 *
 * `hasValuedBurn` rather than a test on the figure, which is the whole point
 * of the function: an unvalued burn is honestly nought cents — the arithmetic
 * is minutes times a rate of nothing — and printing "$0.00" beside eighty
 * logged hours is the single most reassuring thing this page could get wrong.
 * The same predicate the burn panel asks, so the two cannot disagree about
 * what a nought means.
 *
 * A valued burn of nought is printed as $0.00, because that is a measurement:
 * the rate is set and nobody has logged anything yet.
 */
export function burnedCell(summary: BurnSummary): string {
  return hasValuedBurn(summary) ? formatCents(summary.burnedCents) : NO_FIGURE;
}

/**
 * What a project with nothing wrong is told, when both axes were read.
 *
 * A clause rather than a blank cell. A row whose verdict column says "On
 * track" and whose reason column says nothing has not explained itself: the
 * reader cannot tell a project that was measured on both axes and cleared from
 * one the page gave up on, and those are the two things this whole page exists
 * to keep apart. The clause names both comparisons, and the columns beside it
 * say what they came out at.
 */
export const ON_TRACK_CLAUSE =
  "Inside the price agreed and tracking the work delivered.";

/**
 * What a project cleared on the money alone is told.
 *
 * The money axis stands on its own — the classifier says so, and clears a
 * project on it whether or not anybody sized the work — so the verdict is
 * sound and the clause has to not overclaim it. "On the money alone" is the
 * honest half; the caveat beside it says which field would buy the other half.
 */
export const ON_TRACK_ON_MONEY_CLAUSE =
  "Inside the price agreed, on the money alone.";

/**
 * What a flagged project is told when no comparison carried the figures to
 * explain itself.
 *
 * Not reachable from `assessScopeCreep`: a `watch` or an `over` is the worst
 * of its own reasons, so a flagged verdict without reasons cannot come out of
 * a whole assessment. It is written because the type allows it and the
 * alternative at this spot is worse — the obvious fallback is the on-track
 * clause, which would put "Inside the price agreed" in the reason column of a
 * row whose verdict column reads "Over scope". A row that says the figures are
 * missing is wrong about one thing; a row that clears a flagged project is
 * wrong about the only thing that matters.
 */
export const UNEXPLAINED_FLAG_CLAUSE =
  "Flagged, with no comparison able to explain itself. The project has the figures.";

/**
 * What an engagement nobody has begun is told.
 *
 * Not the blind spots, which is the point. A project created this morning has
 * no contract value and no estimates, so the classifier reports both — and two
 * clauses telling a reader to go and fill in the fields they have not reached
 * yet is the row that teaches them to stop reading this column. The project
 * page refuses to render a verdict at all for this case; the table cannot
 * refuse, so it says the one thing that is actually news.
 *
 * It names the three fields that would start the assessment, in the order they
 * ordinarily arrive, because a reader who wants this row to say something has
 * to do one of them and any one will do.
 */
export const UNSTARTED_CLAUSE =
  "Nothing agreed, logged or scoped yet, so there is nothing to assess.";

/**
 * What a project the classifier would not judge is told when even the gap
 * could not be named.
 *
 * Also not reachable: a withheld verdict is withheld because
 * `readConsumedShare` found no share, and every one of the three ways to get
 * there puts a blind spot about the money on the assessment. It exists so the
 * reason column is never empty, which is the one thing it must never be —
 * "Not assessed" with nothing beside it is the coloured dot this page was
 * built to replace.
 */
export const UNEXPLAINED_GAP_CLAUSE =
  "No verdict could be reached, and nothing on the project says why.";

/**
 * One row of the portfolio, as a component reads it.
 *
 * Eight fields, every one of them a string already decided, plus the band for
 * the one thing a component is allowed to branch on. The same arrangement
 * `ScopeHealthBanner` makes, and for the same reason: a table cell that
 * decided its own words from a share would be a second classifier, and it
 * would be the one a reader believed.
 *
 * `reason` and `caveat` are two fields rather than one because they answer
 * different questions. The reason is why this row is where it is; the caveat
 * is what the verdict could not see, which is about the verdict rather than
 * about the project. A reader scanning the column reads the reasons and stops;
 * one who has decided to do something reads the caveat under it.
 *
 * `project` and `client` are not here. The row holds the project, and a name
 * needs a link rather than a string — which is the component's business, and
 * the one thing on the row that is.
 */
export type PortfolioReading = {
  /** Where the row sits in the order. Tone and grouping only. */
  readonly band: RiskBand;
  /** The verdict, in the words the project banner uses. */
  readonly verdict: string;
  /** Why the row is where it is, in one clause with no figures in it. */
  readonly reason: string;
  /** What the verdict could not see, or nothing. Usually nothing. */
  readonly caveat: string | null;
  /** What the hours have cost, or a dash. */
  readonly burned: string;
  /** The share of the contract the burn has eaten, or a dash. */
  readonly consumed: string;
  /** The share of the estimated work that is done, or a dash. */
  readonly delivered: string;
  /** The distance between the two, in points, or a dash. */
  readonly gap: string;
};

/**
 * Why this row is where it is, in one clause.
 *
 * Three cases, and keeping them apart is the whole of this function:
 *
 *   - **Flagged.** The worst reason, which the classifier has already put
 *     first. A reader who reads one clause should have been told the worst
 *     thing.
 *   - **Healthy.** The clause that says both comparisons were made, or the one
 *     that says only the money could be — which depends on whether there was a
 *     delivered share, not on whether the verdict stood.
 *   - **Unassessed.** The money gap that withheld the verdict, which is always
 *     the first blind spot on the assessment: a verdict is withheld exactly
 *     when `readConsumedShare` found nothing, and all three ways to get there
 *     push a money blind spot before any scope one.
 *
 * The two unreachable fallbacks are explained where they are defined. Neither
 * can be produced by `assessScopeCreep`; both are here so this function is
 * total and the reason column is never empty.
 */
export function rowReason(row: PortfolioRow): string {
  const { assessment } = row;

  if (isFlaggedBand(row.band)) {
    const [worst] = assessment.reasons;
    return worst === undefined
      ? UNEXPLAINED_FLAG_CLAUSE
      : REASON_CLAUSE[worst];
  }

  if (row.band === UNSTARTED_BAND) return UNSTARTED_CLAUSE;

  if (row.band === UNASSESSED_BAND) {
    return firstBlindSpotClause(assessment.blindSpots) ?? UNEXPLAINED_GAP_CLAUSE;
  }

  return assessment.deliveredShare === null
    ? ON_TRACK_ON_MONEY_CLAUSE
    : ON_TRACK_CLAUSE;
}

/**
 * Why the gap column is a dash on a project whose two shares both read.
 *
 * The one null gap the dash convention does not otherwise cover.
 * `readCreepGap` answers nothing once every line of the scope is delivered,
 * and that is right — there is no undelivered work for the burn to be ahead
 * of, so a gap would be the overspend told twice, once wrongly. But it is the
 * only way to get a dash in that column with a percentage either side of it,
 * and it reports no blind spot, so without this clause the row would show
 * "83%", "100%", "–" and say nothing about the dash.
 *
 * Which is the opposite of the news. A project that finished its whole list is
 * the one row on this page where a missing figure is good: the work is done,
 * and whatever the money came to is what the engagement cost rather than a
 * leak still widening.
 */
export const SCOPE_ALL_DELIVERED_CLAUSE =
  "Every line of the scope is delivered, so there is no undelivered work for the burn to be ahead of.";

/**
 * Whether this row's gap is missing because the work is finished.
 *
 * `readCreepGap` answers null two ways: either share unreadable, or the whole
 * scope delivered. The first always carries a blind spot — a share this file
 * sees as null is a share the classifier refused, and it says why — so a null
 * gap with both shares present can only be the second. Inferred rather than
 * carried on the assessment, because `scopeDelivered` is a reading of the
 * scope list rather than a part of the verdict, and the inference is sound in
 * the one direction it is used.
 */
function finishedWithoutAGap(row: PortfolioRow): boolean {
  const { consumedShare, deliveredShare, gap } = row.assessment;
  return gap === null && consumedShare !== null && deliveredShare !== null;
}

/**
 * What the verdict could not see, beyond whatever the reason already said.
 *
 * On an assessed row that is the first blind spot, and it can only be a scope
 * one: a money blind spot is exactly what withholds a verdict, so a row that
 * has a verdict has none. On an unassessed row the first one is already the
 * reason, so this is the next — which is the scope half, when there is one.
 *
 * On an unstarted row, nothing. Every blind spot such a project has is a
 * consequence of it being new, which its reason has already said in one line
 * — and the two or three the classifier reports would be the longest row on
 * the page belonging to the engagement with least to say.
 *
 * On a finished row, why the gap column is empty, ahead of any blind spot. The
 * dash is the thing on that row a reader cannot account for, and a clause
 * about how far to trust the delivered share would leave it unaccounted for.
 *
 * At most one otherwise, because a row has a line. A project with two things
 * missing has them both on its own page, where there is room for the sentence
 * that names the form as well.
 */
export function rowCaveat(row: PortfolioRow): string | null {
  if (row.band === UNSTARTED_BAND) return null;
  if (finishedWithoutAGap(row)) return SCOPE_ALL_DELIVERED_CLAUSE;

  const { blindSpots } = row.assessment;
  const rest = row.band === UNASSESSED_BAND ? blindSpots.slice(1) : blindSpots;
  return firstBlindSpotClause(rest);
}

/**
 * One row, read.
 *
 * The call a component makes, so every string on a line came from one reading
 * of one project. The pieces stay exported because each is worth testing on
 * its own, but nothing that renders a row should be asking for them one at a
 * time — the point of the reading is that the verdict, the clause under it and
 * the three figures beside it are all about the same assessment.
 */
export function portfolioReading(row: PortfolioRow): PortfolioReading {
  const { assessment, burn } = row;

  return {
    band: row.band,
    verdict: riskBandLabel(row.band),
    reason: rowReason(row),
    caveat: rowCaveat(row),
    burned: burnedCell(burn),
    consumed: shareCell(assessment.consumedShare),
    delivered: shareCell(assessment.deliveredShare),
    gap: gapCell(assessment.gap),
  };
}

/**
 * What a band is called inside a sentence, as opposed to in a column heading.
 *
 * Lower case and read as a predicate — "2 over scope" rather than "2 Over
 * scope" — because the summary above the table is a sentence and a heading
 * dropped into one reads like a bug. The same arrangement
 * `PROJECT_SORT_COLUMN_PHRASES` makes beside its labels, and for the same
 * reason: lowercasing the label at the call site works until a label has a
 * proper noun in it.
 *
 * The words are the labels' words, so the sentence over the table and the
 * column in it cannot come to call one finding two things.
 */
export const RISK_BAND_PHRASES: Record<RiskBand, string> = {
  over: "over scope",
  watch: "worth watching",
  [UNASSESSED_BAND]: "not assessed",
  healthy: "on track",
  [UNSTARTED_BAND]: "not started",
};

/**
 * How many projects the page is about, counted so the number reads as a
 * sentence.
 *
 * "1 active project" rather than "1 active projects", which is the whole of
 * it. Its own function because the plural is the kind of thing that is right
 * in the one place it was written and wrong in the next, and because a count
 * of projects is worth testing without a portfolio to count.
 */
export function countActiveProjects(total: number): string {
  return total === 1 ? "1 active project" : `${total} active projects`;
}

/**
 * What a studio with no work in flight is told.
 *
 * One spelling, read twice: the summary answers with it when there are no rows
 * to describe, and the panel that stands in for the table uses it as its
 * heading. The same sentence typed in both places is the sort of thing that
 * stays in step until somebody softens one of them.
 *
 * A full stop, because it is a sentence in the summary's position. The panel
 * headings in this app end in one too, which is why it can be shared at all.
 */
export const NO_ACTIVE_PROJECTS = "No active projects.";

/**
 * What the portfolio adds up to, in one line above the table.
 *
 * The figure a reader wants before they read a single row: whether there is
 * anything to do today. A page of eleven rows whose summary says none are
 * flagged is a page somebody can close, and that is worth saying at the top
 * rather than leaving them to scan a column for it.
 *
 * The bands are counted in rank order and the empty ones are left out, so the
 * sentence is as short as the news is good. `healthy` is always left out: it is
 * the remainder, and "2 over scope, 9 on track" of eleven makes a reader do
 * arithmetic to check nothing is missing. What is left in is every band that
 * is a thing to do — which includes the unassessed ones, counted separately
 * from the flagged ones because a form to fill in is not a finding.
 *
 * "all on track" rather than "none flagged" where every row is clear, because
 * none-flagged would also be true of a studio whose every project is
 * unassessed — which is the one case this sentence must not be able to
 * describe as fine.
 */
export function describePortfolio(rows: readonly PortfolioRow[]): string {
  if (rows.length === 0) return NO_ACTIVE_PROJECTS;

  const total = countActiveProjects(rows.length);
  const counts = countByBand(rows);
  const parts = RISK_BANDS.filter(
    (band) => band !== "healthy" && counts[band] > 0,
  ).map((band) => `${counts[band]} ${RISK_BAND_PHRASES[band]}`);

  if (parts.length === 0) return `${total}, all on track.`;
  return `${total}: ${parts.join(", ")}.`;
}

/**
 * What the seven columns of the portfolio are called.
 *
 * "Consumed" and "Delivered" are the burn panel's and the scope panel's own
 * words for the same two shares, so a reader who has learned them on a project
 * does not have to learn them again here. "Gap" is the one word this page
 * introduces, and the column it heads prints points rather than a percent for
 * exactly that reason — it is a distance between the two columns to its left
 * rather than a share of anything.
 *
 * "Verdict" rather than "Status", which is taken: a project's status is
 * draft, active, paused or closed, and this column is nothing to do with it.
 * A reader who saw "Status" here would reasonably expect "Active" in every
 * row.
 *
 * "Burned" rather than "Spent", matching the burn panel. The money has been
 * consumed by the work; "spent" reads like an expense somebody authorised.
 *
 * One object rather than seven strings in the markup, so the headings and the
 * caption that describes them cannot drift apart.
 */
export const PORTFOLIO_COLUMNS = {
  project: "Project",
  client: "Client",
  burned: "Burned",
  consumed: "Consumed",
  delivered: "Delivered",
  gap: "Gap",
  verdict: "Verdict",
} as const;

/**
 * What the table is, for a reader who cannot see its shape.
 *
 * A caption rather than a paragraph above the table, so it is read as part of
 * the table by anything navigating by region — and visually hidden, because
 * the summary line above already says what the page is and a second sentence
 * saying it again is the kind of thing a sighted reader learns to skip past.
 *
 * It says the order, which is the one fact about this table that is not
 * visible from any single row: a reader who cannot scan the whole column has
 * no way to tell that the first row is the worst one rather than the newest.
 *
 * Built from `PORTFOLIO_COLUMNS` rather than naming the columns again, which
 * is the whole reason that record exists. A caption that spelled the headings
 * out would be a caption that went on describing six columns the day a seventh
 * arrived — and it already had: it enumerated four of the seven and left the
 * gap out, which is the column the sentence after it is about.
 *
 * Lower-cased, because the headings are capitalised for a column and this is a
 * sentence. The same conversion `RISK_BAND_PHRASES` makes, done here rather
 * than by a second record, because a column heading is one word and a band
 * label is three — there is no proper noun in a column name to be ruined by
 * folding it.
 */
export const PORTFOLIO_CAPTION = [
  "Every active project, worst first, one row each:",
  [
    PORTFOLIO_COLUMNS.project,
    PORTFOLIO_COLUMNS.client,
    PORTFOLIO_COLUMNS.burned,
    PORTFOLIO_COLUMNS.consumed,
    PORTFOLIO_COLUMNS.delivered,
    PORTFOLIO_COLUMNS.gap,
    PORTFOLIO_COLUMNS.verdict,
  ]
    .map((column) => column.toLowerCase())
    .join(", "),
  "— where the gap is the share consumed less the share delivered, in points.",
].join(" ");
