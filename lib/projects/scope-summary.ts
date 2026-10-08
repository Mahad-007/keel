import { isEstimated, UNESTIMATED_LABEL } from "@/lib/deliverables/list";
import { formatMinutes } from "@/lib/minutes";
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
    value: isEstimated(summary.estimatedMinutes)
      ? formatMinutes(summary.estimatedMinutes)
      : UNESTIMATED_LABEL,
    note: describeUnestimated(summary.lineCount, summary.unestimatedCount),
  };
}
