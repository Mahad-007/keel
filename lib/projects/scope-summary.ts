import { describeEstimate, UNESTIMATED_LABEL } from "@/lib/deliverables/list";
import { formatMinutes } from "@/lib/minutes";
import { formatCents } from "@/lib/money";
import type { ScopeSummary } from "@/lib/scope";

/**
 * The words a scope summary is read in.
 *
 * `lib/scope.ts` works out what a project's scope adds up to; nothing in it
 * knows what a number is called or when a number is worth showing at all.
 * That is this file: a label, a figure, and — where the figure would mislead
 * on its own — the sentence that says what it does and does not cover.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * list's do: deciding that a total of twelve hours across ten deliverables
 * means something different when four of them are unsized is a rule about the
 * data, and a rule is testable where JSX is not. The panel maps over what
 * comes out of here and sets the type.
 *
 * Plain language is the whole point of the day. "Implied hourly rate" rather
 * than "rate", "Still to do" rather than "remaining", and a figure that cannot
 * be worked out says why instead of rendering a zero that reads as a fact.
 */

/**
 * One line of the summary: what it is called, what it says, and the caveat a
 * reader needs to read it correctly.
 *
 * A value that is always a string, never a number, because half of these are
 * not numbers — "Not estimated" is the honest reading of an unsized list, and
 * a panel that had to choose between a figure and a sentence per row would
 * make that choice four times.
 *
 * The note is null rather than empty when there is nothing to add. A row with
 * no caveat is a row with no caveat; an empty paragraph under it would space
 * the panel out for the sake of what is not there.
 */
export type ScopeFigure = {
  /** What the figure is called, in words a client would recognise. */
  label: string;
  /** The figure itself, or what stands in for it when there is none. */
  value: string;
  /** How to read it, where the figure alone would mislead. */
  note: string | null;
};

/**
 * An hours figure as it reads inside a sentence.
 *
 * Hours rather than `1h 30m` here, because this is the unit the estimate was
 * agreed in: the working behind the implied rate is "five thousand dollars
 * over forty hours", which is the sentence somebody said out loud when the
 * project was quoted. `formatMinutes` is for the figures in the column, where
 * an exact duration is what a reader wants to compare.
 *
 * The number arrives already rounded to the hundredth by `estimatedHours`, so
 * nothing is rounded again here — rounding a figure twice is how a panel ends
 * up disagreeing with itself.
 */
export function hoursPhrase(hours: number): string {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * A count of scope lines with the word for them attached.
 *
 * The noun agrees with the count it is attached to, which is what makes "1 of
 * 1 deliverable" read as English — the summary's sentences are mostly a count
 * of part of the list against the whole of it, and the whole is what the noun
 * belongs to.
 *
 * "Deliverable" rather than "line" or "item", because that is the word the
 * form, the list and the empty state all use. A summary that renamed them
 * would read as being about something else on the page.
 */
export function deliverablesPhrase(count: number): string {
  return `${count} ${count === 1 ? "deliverable" : "deliverables"}`;
}

/**
 * A share of the estimate as a percentage to read.
 *
 * Whole percent, because the share is derived from estimates and a figure of
 * "30.4%" claims a precision the inputs never had. Rounded rather than
 * truncated, so the figure is the nearest percent to the fraction.
 *
 * The share arrives unrounded and unclamped from `deliveredShare`, and it is
 * not clamped here either: a list with a negative estimate in it can be over
 * a hundred percent delivered, and a panel quietly printing "100%" would hide
 * the bad row behind a plausible figure.
 *
 * A share that is greater than nothing but rounds to nothing is written as
 * "less than 1%" instead. "0%" beside a line saying one deliverable is done
 * says the rounding's answer rather than the truth, and the reader would
 * conclude the done line was a mistake — a half-day handed over against a
 * three-month estimate really is less than one percent of it.
 *
 * A share short of the whole that rounds up to it is written as "more than
 * 99%", which is the same rule at the other end and the more consequential
 * one: "100% of the estimated work" says the project is finished, and the
 * reader stops looking for the deliverable that is still open.
 */
export function formatSharePercent(share: number): string {
  const percent = Math.round(share * 100);
  if (percent === 0 && share > 0) return "less than 1%";
  if (percent === 100 && share < 1) return "more than 99%";
  return `${percent}%`;
}

/**
 * What the unsized lines do to the total, in words — or nothing at all when
 * every line has an estimate on it.
 *
 * This is the caveat that decides how far to trust the rest of the panel, so
 * it says the consequence rather than only the count: a total that does not
 * cover the whole list is a different number from one that does, and a reader
 * who is told four of ten are unsized still has to work out what follows.
 *
 * Taking the two counts rather than the whole summary, because that is what it
 * reads and a caller with a count in each hand should not have to build a
 * summary to ask.
 */
export function describeUnestimated(
  lineCount: number,
  unestimated: number,
): string | null {
  if (unestimated === 0) return null;
  if (unestimated >= lineCount) {
    return "No line on the list has an estimate on it, so there is nothing to total.";
  }
  const verb = unestimated === 1 ? "has" : "have";
  return `${unestimated} of ${deliverablesPhrase(lineCount)} ${verb} no estimate, so this total does not cover the whole list.`;
}

/**
 * Whether the list holds an estimate nobody could have typed in.
 *
 * Every "Not estimated", "None yet" and "Nothing left" in this file is an
 * interpretation of a zero, and one negative line makes those interpretations
 * wrong: two lines cancelling out is not an unsized list, and nought minutes
 * left is not a finished one. Where this is true the figures go back to being
 * plain arithmetic — the banner above them is what explains why they do not
 * add up, and a panel that paraphrased them as well would be stating things
 * about the project that are not so.
 */
function hasNegativeLine(summary: ScopeSummary): boolean {
  return summary.negativeEstimateCount > 0;
}

/**
 * What the scope list was sized at, as a line of the panel.
 *
 * "Estimated work" rather than "Total" or "Scope": the figure is a sum of
 * guesses about how long things will take, and the label is the one place to
 * say so before a reader starts treating it as a measurement.
 *
 * An unsized list says `UNESTIMATED_LABEL` — the same two words the list puts
 * on an unsized line — rather than `0m`. A total of zero minutes is a claim
 * that the work takes no time, which is the reading that makes a scope panel
 * lie, and importing the words rather than retyping them is what stops the
 * summary and the list disagreeing about what a missing estimate is called.
 */
export function estimatedFigure(summary: ScopeSummary): ScopeFigure {
  return {
    label: "Estimated work",
    value: estimatedValue(summary),
    note: describeUnestimated(summary.lineCount, summary.unestimatedCount),
  };
}

/**
 * Whether there is a total to show, asked of the lines rather than of the
 * total.
 *
 * `isEstimated` is a question about one row — has anything been typed into its
 * estimate column — and a sum of rows is not a row. Asking it of the total is
 * what made this figure need a negative-line guard: two lines of minus two
 * hours and plus two hours sum to zero, and a total of zero answered "no" to a
 * question about rows that both had estimates on them.
 *
 * The count answers it directly. Every line unsized means there is nothing to
 * total and the label says so; one line sized means there is a figure, whatever
 * it comes to — including a zero that two lines cancelled out to, which is then
 * printed as the arithmetic it is.
 */
function estimatedValue(summary: ScopeSummary): string {
  if (summary.unestimatedCount >= summary.lineCount) return UNESTIMATED_LABEL;
  return formatMinutes(summary.estimatedMinutes);
}

/**
 * How much of the list has been handed over, counted two ways.
 *
 * The count and the share answer the same question differently and the
 * sentence needs both: four of five deliverables is nearly finished unless the
 * fifth was the month-long piece, and the share weighted by estimate is the
 * half that says which. `lib/scope.ts` works both out; this decides when each
 * is worth saying.
 *
 * A share is left out where it would only repeat the count — nothing done is
 * nought percent, and everything done is all of it by construction — so it
 * appears exactly in the mixed case, which is the one where the two figures can
 * disagree.
 *
 * A finished list says so as a fact rather than as a fraction. "All 5
 * deliverables are marked done" is the sentence somebody reads once and stops;
 * "5 of 5 deliverables marked done, 100% of the estimated work" is the same
 * news with two sums to check first.
 *
 * The whole estimate delivered with lines still open is the one share that
 * must not be printed as a percentage. "100% of the estimated work" beside a
 * count of three out of four says the project is finished and the reader stops
 * looking for the fourth line — when what has actually happened is that the
 * fourth line has no estimate on it, which is the thing worth saying.
 *
 * A share above one keeps its percentage, oddity and all. That only happens
 * with a negative estimate on the list, and the panel flags the row rather
 * than trying to narrate it.
 *
 * With nothing to take a share of, the sentence says so rather than quoting a
 * percentage of zero. That covers an unsized list and the stranger case of
 * estimates that cancel each other out, both of which `deliveredShare`
 * reports as no share at all.
 */
export function describeDelivered(summary: ScopeSummary): string {
  const { deliveredCount: delivered, deliveredShare, lineCount } = summary;
  if (lineCount === 0) return "Nothing has been agreed yet.";
  if (delivered === 0) {
    return `None of ${deliverablesPhrase(lineCount)} is marked done yet.`;
  }
  if (delivered >= lineCount) {
    return lineCount === 1
      ? "The one deliverable on the list is marked done."
      : `All ${lineCount} deliverables are marked done.`;
  }
  const counted = `${delivered} of ${deliverablesPhrase(lineCount)} marked done`;
  if (deliveredShare === null) {
    return `${counted}, though the estimates do not total to anything a share can be taken of.`;
  }
  if (deliveredShare === 1) {
    return `${counted}, which is all of the estimated work — what is still open has no estimate on it.`;
  }
  return `${counted}, ${formatSharePercent(deliveredShare)} of the estimated work.`;
}

/**
 * What has been handed over, as a line of the panel.
 *
 * The figure is the estimate of the delivered lines, not what delivering them
 * cost — nothing in Keel knows that yet, and the two differing is the subject
 * of a later phase. So the label says "Delivered" and the sentence under it
 * counts deliverables, which keeps the figure attached to the list it came
 * from.
 */
export function deliveredFigure(summary: ScopeSummary): ScopeFigure {
  return {
    label: "Delivered",
    value: deliveredValue(summary),
    note: describeDelivered(summary),
  };
}

/**
 * Three readings of nought minutes delivered, and they are not the same
 * thing.
 *
 * Nothing marked done is a real answer and "None yet" is it — `0m` would be a
 * duration where the truth is an absence. A line marked done that nobody
 * sized is a different answer again: something was handed over, and the panel
 * cannot say how much of the work it was. That one is `describeEstimate`'s to
 * word, the same function the list calls on each line, so a total of nothing
 * is never described here in words the list would not use.
 *
 * Decided by the count before the minutes, the way the still-to-do figure is,
 * so the two rows cannot describe the same list differently — one of them
 * claiming nothing has been delivered while the other counts the line that
 * was.
 */
function deliveredValue(summary: ScopeSummary): string {
  if (hasNegativeLine(summary)) return formatMinutes(summary.deliveredMinutes);
  if (summary.deliveredCount === 0) return "None yet";
  return describeEstimate(summary.deliveredMinutes);
}

/**
 * Why the still-to-do figure is bigger than a reader who has started things
 * expects.
 *
 * The rule it describes is `isDelivered`'s: a deliverable in progress is not
 * partly delivered, so its whole estimate stays here until somebody marks it
 * done. Said once, plainly, because the alternative is a reader deciding the
 * figure is broken — and the rule is deliberate. Half credit for a started
 * line would make the work left shrink every time somebody pressed Start,
 * which is the one direction this figure must never move on its own.
 */
export const REMAINING_INCLUDES_STARTED =
  "Everything not marked done, which includes anything in progress — a started deliverable keeps its whole estimate here until it is handed over.";

/**
 * What the list says is left, as a line of the panel.
 *
 * "Still to do" rather than "Remaining", which is the word a burn-down chart
 * uses and would invite the reading that this figure knows about time logged.
 * It does not: this is the estimate of the lines nobody has ticked, and it
 * moves when a status changes rather than when the clock runs.
 */
export function remainingFigure(summary: ScopeSummary): ScopeFigure {
  return {
    label: "Still to do",
    value: remainingValue(summary),
    note: describeRemaining(summary),
  };
}

/**
 * The figure itself, decided by what is still open rather than by what the
 * minutes come to.
 *
 * The two come apart, and the difference matters: a project with one
 * eight-hour line done and one unsized line still to write has nought minutes
 * left on the clock and a deliverable outstanding. Keying "Nothing left" off
 * the minutes would call that project finished, which is the single most
 * misleading thing this panel could say — and an estimate is optional on the
 * add form, so it takes no hand-edited row to get there.
 *
 * So the order is: is anything still open, then what does the estimate of
 * what is open come to — which is `describeEstimate`'s question, and it gives
 * the same answer here that the list gives on a line of its own.
 */
function remainingValue(summary: ScopeSummary): string {
  if (hasNegativeLine(summary)) return formatMinutes(summary.remainingMinutes);
  if (summary.lineCount === 0) return "Nothing agreed";
  if (openCount(summary) === 0) return "Nothing left";
  return describeEstimate(summary.remainingMinutes);
}

/**
 * How many lines are not marked done — which is what "still to do" is about.
 *
 * The figure and the sentence under it both turn on this, and they were asking
 * it two different ways: one comparing the delivered count against the line
 * count, the other subtracting. Two spellings of one question is how a row
 * ends up saying nothing is left above a sentence counting what is.
 */
function openCount(summary: ScopeSummary): number {
  return summary.lineCount - summary.deliveredCount;
}

/**
 * How to read the figure, which depends on why it says what it says.
 *
 * A finished list and an empty one need nothing: "Nothing left" and "Nothing
 * agreed" are their own explanations, and the delivered line above has already
 * counted the deliverables.
 *
 * An open line with no estimate on it is the case worth a sentence. The figure
 * reads "Not estimated" where a reader expected hours, and the reason is not
 * in the list below at a glance — the line is there, it just has nothing in
 * its estimate column.
 */
function describeRemaining(summary: ScopeSummary): string | null {
  const open = openCount(summary);
  if (open === 0 || hasNegativeLine(summary)) return null;
  if (summary.remainingMinutes === 0) {
    return open === 1
      ? "The one deliverable still open has no estimate on it."
      : `None of the ${deliverablesPhrase(open)} still open has an estimate on it.`;
  }
  return REMAINING_INCLUDES_STARTED;
}

/**
 * The working behind the implied rate, or why there is none.
 *
 * The rate is the one figure in the panel nobody typed in: it is the contract
 * value divided by the estimate, and both of those are on screen elsewhere. So
 * the note is the division written out — "$5,000.00 over 40 hours estimated" —
 * because a derived number with no working beside it is a number a reader
 * either trusts blindly or ignores, and this one is too consequential for
 * either.
 *
 * Five sentences, as flat guards in the order the figures go wrong rather than
 * nested inside a test for a missing rate — the rate is missing for three
 * different reasons and the nesting hid which test was deciding which.
 *
 * Estimates that cancel out to nothing get their own sentence too, for the
 * same reason the other way round: the list is sized, so telling the reader
 * that nothing on it is estimated would send them to fill in fields that are
 * already full.
 *
 * A total below zero gets its own sentence rather than being folded in with a
 * missing estimate, because the two want different things done about them. A
 * list nobody has sized needs estimating; a list totalling below zero has a
 * row with a negative estimate on it, which is a typo somebody should go and
 * find — and only the database can produce it, so saying so plainly saves the
 * hunt.
 *
 * A contract value of zero is treated as one nobody has filled in, which is
 * what the rest of the app takes it for — the column defaults to zero and the
 * header renders it as "Not set". The arithmetic disagrees, and quite
 * reasonably: `impliedRateCents` reports a rate of zero, because a project
 * agreed at no charge really does pay nothing an hour. But a panel cannot tell
 * those two apart from the column alone, and "$0.00/hr" against an unfilled
 * field reads as a discovery rather than as a blank.
 *
 * It also says what the figure is for. A rate that moves whenever somebody
 * edits an estimate is not a rate to bill at; it is the sentence "you agreed
 * to work for this much an hour", which is worth reading and not worth
 * quoting.
 */
export function describeImpliedRate(summary: ScopeSummary): string {
  if (summary.estimatedMinutes < 0) {
    return "The estimates on this list total below zero, so there is no rate to work out. One of the lines has a negative number of hours on it.";
  }
  if (summary.estimatedMinutes === 0 && hasNegativeLine(summary)) {
    return "The estimates on this list cancel out to no hours at all, so there is nothing to divide the contract value by. One of the lines has a negative estimate on it.";
  }
  if (summary.impliedRateCents === null) {
    return "Nothing on the list is estimated, so there are no hours to divide the contract value by.";
  }
  if (!hasContractValue(summary)) {
    return "No contract value is set on this project, so there is no rate to work out — the estimate is here, the price is not.";
  }
  return `${formatCents(summary.contractValueCents)} over ${hoursPhrase(summary.estimatedHours)} estimated. It moves whenever an estimate does, so it is a figure to read rather than a rate to bill at.`;
}

/**
 * Whether the project has a price on it at all.
 *
 * Zero cents is the column's default, so it means "nobody has said" far more
 * often than it means "agreed at no charge" — which is the reading the project
 * list and the page header already take, and the reason the header prints
 * "Not set" rather than an amount.
 *
 * One predicate, consulted by the figure and by the sentence under it, because
 * these two cannot be allowed to disagree: a row reading "$0.00/hr" above a
 * note saying no contract value is set would leave a reader with nothing to
 * believe.
 */
function hasContractValue(summary: ScopeSummary): boolean {
  return summary.contractValueCents !== 0;
}

/**
 * What the contract works out to an hour, as a line of the panel.
 *
 * "Implied" is the word doing the work in the label: a fixed-price project
 * does not have an hourly rate, it has a price and a guess at how long the job
 * will take, and this is what dividing one by the other says. A reader who
 * takes it for the project's rate will go looking for the field it came out
 * of, and there isn't one — the rate override on the overview tab is a
 * different number with a different job.
 *
 * `/hr` rather than "per hour", matching the rate override and the client's
 * default, so the three rates on this project read as the same kind of figure.
 *
 * Where there is no rate the row stays rather than disappearing. The note is
 * the only place that says what is missing — an estimate, or a price — and a
 * row that vanished would take the explanation with it.
 */
export function impliedRateFigure(summary: ScopeSummary): ScopeFigure {
  return {
    label: "Implied hourly rate",
    value: impliedRateValue(summary),
    note: describeImpliedRate(summary),
  };
}

/**
 * The rate, or the two words that stand in for one.
 *
 * A rate needs both halves of the division, so the absence of either is the
 * same answer here and the note is what distinguishes them. The same two
 * conditions the note's first sentences turn on, asked through the same
 * predicate, so the figure and its explanation are always about the same
 * project.
 */
function impliedRateValue(summary: ScopeSummary): string {
  const rate = summary.impliedRateCents;
  if (rate === null || !hasContractValue(summary)) return "No rate yet";
  return `${formatCents(rate)}/hr`;
}

/**
 * The whole summary, in the order it is read.
 *
 * The estimate first, because every figure under it is a part or a quotient of
 * it and none of them means anything until a reader knows what the list adds
 * up to. Then what is done and what is left, which are the two halves of that
 * total and are put next to each other so they can be seen to add up. The rate
 * last, because it is the conclusion: the one figure that is about the deal
 * rather than about the work.
 *
 * One array rather than four calls from the panel, so the order is a decision
 * made once, in the place that explains it, and a figure added later cannot
 * land in a different position on a different screen.
 */
export function scopeSummaryFigures(summary: ScopeSummary): ScopeFigure[] {
  return [
    estimatedFigure(summary),
    deliveredFigure(summary),
    remainingFigure(summary),
    impliedRateFigure(summary),
  ];
}

/**
 * Why the figures above do not add up, when they do not.
 *
 * A negative estimate is the one input that breaks the panel's arithmetic: the
 * delivered and still-to-do figures stop being parts of the total, a share can
 * land outside nought to one, and the implied rate disappears or inverts. The
 * calculation deliberately does not repair any of that — a total that quietly
 * fixed its inputs would disagree with the list the reader is looking at — so
 * the panel has to say what happened instead.
 *
 * Counted off the lines rather than inferred from the totals, because the
 * worst case leaves the totals looking fine: minus two hours against plus two
 * hours reads as nought estimated minutes, and every figure here would then
 * describe the project as unsized while two of its lines carry estimates.
 *
 * The form refuses a negative estimate, so a row holding one was written
 * directly to the database. Saying so is the useful half: a reader who knows
 * the figures are off wants to know which line to look at, and the list below
 * the panel shows the negative figure on the line that holds it.
 *
 * Null the rest of the time, which is almost always. This is a sentence that
 * appears when something is genuinely wrong, not a disclaimer under every
 * project.
 */
export function describeEstimateProblem(summary: ScopeSummary): string | null {
  if (!hasNegativeLine(summary)) return null;
  const bad = summary.negativeEstimateCount;
  const subject =
    bad === 1 ? "One deliverable has" : `${deliverablesPhrase(bad)} have`;
  return `${subject} a negative estimate, so the figures here do not add up the way they should. The form will not accept one, so the line was written straight to the database — it shows a negative figure in the list below.`;
}

/**
 * What the whole panel is and is not, said once underneath it.
 *
 * Every figure in it comes off the estimates on the scope list. None of it
 * knows how long the work has actually taken, because nothing in Keel records
 * that yet — and a panel of hours against a contract value looks exactly like
 * a panel that does. A reader who takes "Still to do: 28h" for a measurement
 * is being misled by a figure that is only ever a restatement of what was
 * agreed.
 *
 * One sentence under the figures rather than a caveat on each: the rows carry
 * the caveats that are specific to them, and this one is true of all four.
 */
export const SCOPE_FROM_ESTIMATES =
  "These are the estimates on the list, not time spent — a line counts as delivered when somebody marks it done, not when the hours run out.";
