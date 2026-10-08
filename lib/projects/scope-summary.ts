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
 */
export function formatSharePercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
