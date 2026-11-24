import type { PaceShift } from "./rate";

/**
 * What is wrong with the forecast, and how much of it to believe.
 *
 * `forecast.ts` will produce a date and an overage from any pace and any scope
 * list it is handed, and it is right to: the arithmetic is the arithmetic. But
 * a date is the most authoritative-looking thing this app prints. "The
 * contract runs out on 13 April" reads like a fact, and it is two divisions
 * away from a fortnight of one person's timesheet. A project three readings
 * old, half of whose deliverables were never sized, whose history was
 * reconstructed by a backfill, produces exactly the same confident Thursday as
 * one with six months of measured rows.
 *
 * So this file is not decoration and it is not a disclaimer. It is the half of
 * the milestone that makes the other half publishable. Every weakness the
 * forecast has is named, each one is traced to the row or the column that
 * causes it, and the panel is forbidden from printing a date without them.
 *
 * Two things come out. A list of caveats, each a specific thing a reader can
 * check and most of them a thing somebody can fix — an unsized deliverable is
 * a form to go and fill in. And one word grading the lot, because a reader
 * scanning a portfolio needs to know whether to read the caveats at all.
 *
 * The grade is derived from the caveats and never measured separately. A
 * confidence worked out from the figures directly would be a second opinion
 * about what makes a forecast weak, and the two would disagree on the page —
 * the dangerous direction being a forecast graded firm with three caveats
 * under it.
 */

/**
 * How much of the forecast to believe: three grades, worst last.
 *
 * Three rather than a percentage, which is the same choice the scope health
 * verdict makes and for a stronger reason here. A confidence of 63% would be
 * a number nobody could check, derived from weights nobody chose, and it would
 * invite exactly the arithmetic it cannot support — multiplying the overage by
 * it, say. Three words can be read, and each one maps to a decision: act on
 * it, look into it, or go and fix the data first.
 *
 *   - `firm` — every input the forecast wants is present and measured. It is
 *     still a forecast, and the sentence that introduces it still says so.
 *   - `indicative` — the shape is right and the figures will move. Something
 *     is approximate: the history was reconstructed, the pace has changed, or
 *     part of the scope was never sized.
 *   - `weak` — the basis is too thin to extrapolate from at all. Three days of
 *     readings, or no deliverables to project against. The figures are shown
 *     because withholding them would be its own kind of dishonesty, and the
 *     grade says not to quote them.
 *
 * Order is severity order, which is what `confidenceSeverity` reads.
 */
export const PROJECTION_CONFIDENCE = ["firm", "indicative", "weak"] as const;

export type ProjectionConfidence = (typeof PROJECTION_CONFIDENCE)[number];

/**
 * How bad a grade is, as a number, so two can be compared.
 *
 * Its index in the list, like `healthSeverity` — the order is the declaration
 * order, so a grade cannot be added without taking a position on where it
 * sits, and there is no second table to keep in step.
 */
export function confidenceSeverity(confidence: ProjectionConfidence): number {
  return PROJECTION_CONFIDENCE.indexOf(confidence);
}

/**
 * The worse of two grades.
 *
 * The rule every list of caveats is folded with: one weak input makes the
 * whole forecast weak, however much else is in good order. A grade that
 * averaged its caveats would let a project with four problems and ten clean
 * inputs read as middling, and the four problems are the whole of what a
 * reader needs.
 */
export function worstConfidence(
  a: ProjectionConfidence,
  b: ProjectionConfidence,
): ProjectionConfidence {
  return confidenceSeverity(a) >= confidenceSeverity(b) ? a : b;
}

/**
 * Everything that can be wrong with a forecast, named.
 *
 * A closed list of machine-readable reasons rather than a list of sentences,
 * the same shape `CREEP_REASONS` and `CREEP_BLIND_SPOTS` take. The sentences
 * live in the words module, which means the portfolio view Day 039 builds can
 * count how many projects have unsized scope without parsing English, and a
 * caveat cannot be rendered in one place and forgotten in another.
 *
 * Each one is a specific fact about a specific column, and most of them are a
 * thing somebody can go and fix:
 *
 *   - `short-history` — too few days of readings to measure a pace over. A
 *     project worked hard on Monday and Tuesday has a pace of two days, and
 *     extrapolating it over a quarter is arithmetic, not a forecast.
 *   - `few-readings` — enough days, too few rows. A fortnight holding two
 *     readings is two points and a straight line drawn between them.
 *   - `no-window` — the recent window reaches back over the whole history, so
 *     there is only one pace and nothing corroborates it.
 *   - `pace-changed` — there are two paces and they disagree. The forecast
 *     used one of them, and which one would have changed the answer.
 *   - `reconstructed-history` — some readings were backfilled, so the pace is
 *     built partly from hours valued at today's rate rather than the day's.
 *   - `stale-readings` — the last reading is old, so the pace is a statement
 *     about a stretch that has ended.
 *   - `unsized-scope` — unfinished deliverables carry no estimate, so the
 *     remaining cost is a floor rather than an estimate.
 *   - `unvalued-scope` — there are deliverables, and the work left in them
 *     comes to nothing. A floor of nought is not a forecast: the projected
 *     cost would be the burn with a future tense's label on it.
 *   - `no-scope` — there are no deliverables at all. Nothing says how much
 *     work is left, so there is no end of the work to forecast — only an end
 *     of the money.
 *
 * Order is the order they are reported in, and it runs from the basis of the
 * forecast outwards: what the pace was measured from, then what the pace is
 * worth, then what the scope can say. A reader who stops after the first one
 * has read the most fundamental thing wrong with the figures.
 */
export const PROJECTION_CAVEATS = [
  "short-history",
  "few-readings",
  "no-window",
  "pace-changed",
  "reconstructed-history",
  "stale-readings",
  "unsized-scope",
  "unvalued-scope",
  "no-scope",
] as const;

export type ProjectionCaveat = (typeof PROJECTION_CAVEATS)[number];

/**
 * How much each caveat costs the forecast's standing.
 *
 * A record over the whole union rather than a chain of conditions, so a
 * caveat added without a grade is a compile error here rather than a weakness
 * that silently reads as firm.
 *
 * The four that grade `weak` are the ones that undermine the *basis* rather
 * than the precision. Too few days and too few readings mean there is no
 * measured pace to carry forward — the figures are a line through two points —
 * and the two scope ones mean nothing says how much work is left, so the
 * projected cost is the present tense wearing a future tense's label.
 *
 * `unvalued-scope` grades with `no-scope` rather than with `unsized-scope`,
 * which is the distinction worth defending. An unsized line beside sized ones
 * costs the forecast its precision: the remaining cost is a floor, and a floor
 * is still a forecast. A list where *nothing* left comes to anything has a
 * floor of nought, which is not a forecast of anything — it is the burn, and
 * grading it `indicative` would put a measured-sounding label on the one
 * figure this panel refuses to print.
 *
 * The rest grade `indicative`: the forecast is built on something real and
 * will move. A reconstructed history is the ordinary case rather than a fault
 * — nothing in this repo runs a nightly job, so most projects' early readings
 * were worked out after the fact — and it is still worth saying, because those
 * days are valued at today's rate and a rate that has changed since moves the
 * pace.
 */
export const CAVEAT_CONFIDENCE: Record<ProjectionCaveat, ProjectionConfidence> =
  {
    "short-history": "weak",
    "few-readings": "weak",
    "no-window": "indicative",
    "pace-changed": "indicative",
    "reconstructed-history": "indicative",
    "stale-readings": "indicative",
    "unsized-scope": "indicative",
    "unvalued-scope": "weak",
    "no-scope": "weak",
  };

/**
 * The grade a set of caveats comes to: the worst of them, or `firm` for none.
 *
 * `firm` is the starting point rather than a case, which is the honest way
 * round: a forecast is as good as its inputs and the inputs are what the
 * caveats are about, so nothing wrong with them is nothing to deduct.
 *
 * It is still a forecast at `firm`, and the sentence the panel leads with says
 * so in every grade. The grade is about the evidence, not about whether the
 * future is knowable.
 */
export function projectionConfidence(
  caveats: readonly ProjectionCaveat[],
): ProjectionConfidence {
  return caveats.reduce<ProjectionConfidence>(
    (worst, caveat) => worstConfidence(worst, CAVEAT_CONFIDENCE[caveat]),
    "firm",
  );
}

/**
 * Everything the caveats are read off: how the pace was measured, how old the
 * rows are, and what the scope list can say.
 *
 * Counts and flags rather than the readings, the rates and the deliverables
 * themselves. Three reasons, and the third is the important one.
 *
 * It keeps this file out of the business of measuring. Whether a reading was
 * reconstructed is `burnDownReading`'s judgement, whether a line is sized is
 * `isEstimated`'s, and whether two paces disagree is `classifyPaceShift`'s —
 * each of those is argued out where it belongs, and a second opinion formed
 * here would be the one a reader saw.
 *
 * It makes every rule below a comparison between two numbers, which is a thing
 * a test can pin to the boundary and a reader can check against the page.
 *
 * And it means the same evidence shape serves a project and, later, a row of
 * Day 039's portfolio, where the readings are not in hand at all.
 */
export type ProjectionEvidence = {
  /** Days the pace was measured across, both ends counted. */
  readonly paceDays: number;
  /** How many stored readings the pace was measured from. */
  readonly readingCount: number;
  /** How many of those readings were reconstructed rather than measured. */
  readonly reconstructedCount: number;
  /** How far behind today the last reading is, in days. */
  readonly daysSinceLastReading: number;
  /** Whether the recent pace parts from the average, or null with no comparison. */
  readonly paceShift: PaceShift | null;
  /** Whether the recent window is the whole history over again. */
  readonly wholeHistoryWindow: boolean;
  /** How many deliverables the project has at all. */
  readonly lineCount: number;
  /** How many unfinished deliverables carry no estimate. */
  readonly unsizedUndeliveredCount: number;
  /**
   * What the unfinished estimates come to in money, which is the figure the
   * projected cost is built out of.
   *
   * Cents rather than minutes, because money is what the forecast adds to the
   * burn and money is where the two ways of having nothing to project meet. A
   * list whose open lines are all unsized comes to nothing; so does a list of
   * sized lines on a project whose rate has been cleared. Those are different
   * things to go and fix and the same thing to a forecast — there is no
   * remaining cost, so the projected cost is the burn with a future tense's
   * label on it.
   *
   * Read off the same number the forecast is given, not computed a second time
   * from the lines, so a rule about whether there is a cost to project and the
   * cost itself cannot come from different arithmetic.
   */
  readonly remainingWorkCents: number;
  /**
   * What the unfinished estimates come to in whole minutes, before a rate
   * touched them.
   *
   * The pair with the figure above it is what tells the two ways of having
   * nothing to project apart, and nothing else can. Minutes of nought is a
   * scope list that says nothing about the work left — unsized lines, or
   * estimates that cancel each other out. Minutes above nought with money at
   * nought is the other one entirely: the hours are written down and the rate
   * they would be valued at is nought or below, so the figure to go and fix is
   * on the project rather than in the scope list.
   *
   * Without it a caveat has to hedge between the two, and a hedge sends a
   * reader to check a rate that is fine as often as not.
   */
  readonly remainingWorkMinutes: number;
};

/**
 * The shortest history a pace is worth measuring over: a week.
 *
 * Under a week the pace is a statement about particular days rather than about
 * the engagement. Two hard days at the start of a project divide into a pace
 * that, carried across a quarter, forecasts five times the contract — and the
 * project may simply have had a kick-off workshop. A week is the shortest span
 * that contains both a Monday and a Friday and at least one of whatever the
 * team does weekly.
 *
 * It does not withhold the forecast, which would be the other way of handling
 * it and the worse one. A project three days old with a frightening pace is
 * worth looking at precisely because it is three days old; the figure is shown
 * and graded `weak`, and the sentence says the pace is three days of evidence.
 */
export const MEASURABLE_PACE_DAYS = 7;

/**
 * The fewest readings a pace is worth measuring from: three.
 *
 * Days and readings are different things and both can be too few. A fortnight
 * holding two rows is a straight line drawn between two points, and a straight
 * line between two points is not evidence of a trend — it is the definition of
 * one, which is the problem. Three is the first number that can disagree with
 * itself.
 *
 * Separate from the day count rather than folded into it, because the two
 * failures look identical in the result and are fixed differently. A short
 * history needs time; a sparse one means the snapshots have not been written,
 * which is the chart's own problem and a different sentence.
 */
export const MEASURABLE_PACE_READINGS = 3;

/**
 * How far behind today the readings may fall before the pace stops being a
 * statement about now: three days.
 *
 * Worth saying plainly where this can and cannot fire. The project page reads
 * its readings through `refreshedBurnSnapshots`, which records today before it
 * hands them back — so from that caller the last reading is always today and
 * this caveat is unreachable by construction. It is here for the readers that
 * do not write: the portfolio Day 039 ranks every active project in cannot
 * afford a capture per row, and a pace measured to a fortnight ago is exactly
 * what it will be ranking on.
 *
 * Three days for those readers, because a project nobody has opened since
 * Friday is three days behind when a Monday-morning portfolio reads it, and
 * nothing has gone wrong. Flagging that would put a note on half the list
 * every Monday, and the notes that matter would be read as weekend noise.
 *
 * Past three days the pace is about a stretch that has ended. It is still the
 * best pace there is — `recentBurnRate` deliberately measures to the last
 * reading rather than to today, so the figure survives — but a date counted
 * forward from today at a pace that stopped a fortnight ago is a forecast with
 * a gap in the middle of it, and the gap is what this names.
 *
 * Deliberately a day looser than the burn-down chart's own staleness note,
 * which flags anything over a day. That sentence is about a *line*, and a line
 * stopping short is visible on the chart whether or not it matters; this is
 * about whether to believe a date, and a weekend should not change the answer.
 */
export const READINGS_CURRENT_WITHIN_DAYS = 3;

/**
 * What is wrong with a forecast built on this evidence, worst basis first.
 *
 * The one function that turns measurements into caveats, and it is written as
 * a sequence of independent tests rather than a chain: a project can have a
 * short history *and* unsized scope, and a reader who was told only the first
 * would go and wait a week to fix a problem that a form would have fixed.
 * `creepBlindSpots` is the same shape for the same reason.
 *
 * The order is the declaration order of `PROJECTION_CAVEATS`, which runs from
 * the basis of the forecast outwards. It is not severity order and does not
 * need to be — the grade is folded separately, so the list can be ordered for
 * reading rather than for ranking.
 */
export function projectionCaveats(
  evidence: ProjectionEvidence,
): ProjectionCaveat[] {
  const caveats: ProjectionCaveat[] = [];

  // Days first: the span the pace was divided by is the most fundamental
  // thing about it, and a pace measured over two days is not improved by
  // having four readings in it.
  if (evidence.paceDays < MEASURABLE_PACE_DAYS) caveats.push("short-history");

  if (evidence.readingCount < MEASURABLE_PACE_READINGS) {
    caveats.push("few-readings");
  }

  /*
    Only once the history is long enough to be worth measuring. A project three
    days old has already been told its history is short, and adding that there
    is no second span to compare it against says the same thing twice and gives
    a reader nothing further to do about it.
  */
  if (
    evidence.wholeHistoryWindow &&
    evidence.paceDays >= MEASURABLE_PACE_DAYS
  ) {
    caveats.push("no-window");
  }

  /*
    A pace that has moved is the caveat with the most bearing on the figure
    below it, because the forecast used one of the two paces and the other one
    would have given a different date. `null` is not a shift — there was no
    comparison to make — and `steady` is a comparison that agreed, which is
    the one case here worth nothing being said about.
  */
  if (evidence.paceShift === "faster" || evidence.paceShift === "slower") {
    caveats.push("pace-changed");
  }

  /*
    Any reconstructed reading at all, not a majority of them. A backfilled day
    values the hours that were logged at the rate and the price the project
    carries *now*, because nothing recorded what either was at the time — so a
    rate that has been raised since makes the early days of the pace look
    steeper than they were, and one that has been cut makes them flatter. One
    such day in a fortnight's window is enough to move the forecast, and the
    reader cannot tell which days they are from the figure.
  */
  if (evidence.reconstructedCount > 0) caveats.push("reconstructed-history");

  if (evidence.daysSinceLastReading > READINGS_CURRENT_WITHIN_DAYS) {
    caveats.push("stale-readings");
  }

  /*
    Unfinished lines with no estimate make the projected cost a *floor* rather
    than an estimate: the work is coming, and nothing says what it costs. That
    is the one caveat here whose direction is known, and knowing the direction
    is what makes it worth a sentence of its own — every other weakness could
    move the figure either way, and this one can only move it up.

    Only the unfinished ones. A delivered line with no estimate costs the
    delivery share its precision, which is the scope panel's problem and
    already its sentence; it costs the forecast nothing, because the work is
    done and the hours it took are in the burn.
  */
  if (evidence.unsizedUndeliveredCount > 0) caveats.push("unsized-scope");

  /*
    A scope list that values nothing is the same hole as an empty one, and it
    is the one that looks like data. The lines are there, so the page cannot
    say the scope is missing; the money they come to is nought, so the
    remaining cost is nought, the projected final cost is the burn, and a
    project with a quarter of work ahead of it reports that it lands inside its
    contract. Two things reach it — every open line unsized, or a rate cleared
    to nothing so sized lines value at nought — and a reader needs to know
    which, so the sentence names both and the scope tab shows which one it is.

    Only with lines in the list, so this and `no-scope` cannot both fire: an
    empty list already has its own sentence and a reader told twice that
    nothing says how much work is left has learned nothing the second time. A
    list whose lines are *all delivered* would reach here too, and
    `projectProjection` refuses that project before any of this is asked —
    there is no remaining work to forecast and the burn panel has already said
    what it cost.
  */
  if (evidence.lineCount > 0 && evidence.remainingWorkCents <= 0) {
    caveats.push("unvalued-scope");
  }

  /*
    No deliverables at all is the strongest caveat in the file, and it is the
    one most easily mistaken for good news. With nothing in the scope list the
    remaining work costs nothing, so the projected final cost is the burn, the
    projected overage is whatever has already been overspent, and a project
    with three months of work ahead of it reports a forecast of no overage.
    That is the present tense wearing a future tense's label, and the words
    module withholds the figure rather than printing it caveated.
  */
  if (evidence.lineCount === 0) caveats.push("no-scope");

  return caveats;
}
