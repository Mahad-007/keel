import { describeEstimate } from "@/lib/deliverables/list";
import { formatMinutes } from "@/lib/minutes";
import { unestimatedCount } from "@/lib/scope";
import type {
  DeliverableRollup,
  EstimateComparison,
  LoggedTotals,
  ProjectRollup,
} from "@/lib/time/rollup";

import type { PanelFigure } from "./figure";

import { describeUnestimated, formatSharePercent } from "./scope-summary";

/**
 * The words a time rollup is read in.
 *
 * `lib/time/rollup.ts` works out what a project has logged against each line
 * of its scope; nothing in it knows what a figure is called, when a figure is
 * worth showing, or what a reader should conclude from it. That is this file:
 * a label, a cell, and — where the number alone would mislead — the sentence
 * that says how to read it.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * summary's do: deciding that a line nobody estimated cannot be over its
 * estimate is a rule about the data, and a rule is testable where JSX is not.
 *
 * This is the first place in Keel where a figure is capable of being an
 * accusation. "6h logged against 4h estimated" is a sentence somebody takes
 * into a conversation with a client, so every cell here either says something
 * the arithmetic supports or says plainly that it cannot.
 */

/**
 * What the logged column says on a line nobody has put time against.
 *
 * "None yet" rather than `0m`, the same two words the scope summary puts on
 * nothing delivered. A duration of nought reads as a measurement — somebody
 * worked on this and it took no time — where the truth is an absence, and on
 * this table the absence is often the interesting part: an estimated line with
 * nothing against it three weeks in is the row to look at.
 */
export const NOTHING_LOGGED_LABEL = "None yet";

/**
 * A logged total as its cell reads.
 *
 * `formatMinutes` otherwise, so the column is exact durations a reader can
 * compare against the estimates beside them rather than decimal hours they
 * would have to convert.
 */
export function describeLogged(minutes: number): string {
  if (minutes === 0) return NOTHING_LOGGED_LABEL;
  return formatMinutes(minutes);
}

/**
 * What a line sitting exactly on its estimate says.
 *
 * It happens more often than the arithmetic suggests — half-hour estimates
 * and half-hour entries — and "0m over" would be a true sentence that nobody
 * reads as "this one is fine".
 */
export const ON_THE_ESTIMATE_LABEL = "On the estimate";

/**
 * A difference between logged and estimated time, in the words for its
 * direction.
 *
 * Three readings of one subtraction, and the third depends on something the
 * number cannot know. Over is over. Exactly on it has its own words. Under is
 * two different pieces of news: a line still open with an hour of its estimate
 * unspent has an hour *left*, and a line already handed over with an hour
 * unspent came in an hour *under*. The same figure, and a reader acting on it
 * would do opposite things — one is budget to spend and the other is budget
 * that was never needed.
 *
 * Done-ness is asked of the scope list's status rather than guessed from the
 * hours, which is the whole reason `rollUpDeliverable` carries it. Guessing
 * would mean a line was called finished because its estimate ran out, and
 * that is precisely the project this product exists to catch.
 *
 * The sign is taken off before formatting, because the direction is in the
 * word: "-1h left" would be read as an hour in deficit by anybody scanning a
 * column.
 */
export function describeVariance(
  varianceMinutes: number,
  delivered: boolean,
): string {
  if (varianceMinutes > 0) return `${formatMinutes(varianceMinutes)} over`;
  if (varianceMinutes === 0) return ON_THE_ESTIMATE_LABEL;
  const unspent = formatMinutes(-varianceMinutes);
  return delivered ? `${unspent} under` : `${unspent} left`;
}

/**
 * How much of the estimate has gone, as a percentage — or nothing at all,
 * when the percentage would only repeat the figure beside it.
 *
 * Three shares say nothing new. No share at all means there was no estimate
 * to take one of, which the cell has already said in words. Nought percent is
 * a line with nothing logged, which the logged column has already said.
 * Exactly one is a line on its estimate, which is what "On the estimate"
 * means. Printing those would put a number in every row and teach a reader to
 * stop looking at the column.
 *
 * Everywhere else it earns its place, because the difference alone cannot
 * scale: twenty minutes over is nothing on a forty-hour line and half as much
 * work again on a half-hour one, and 101% against 167% is the only part of
 * the row that says which.
 *
 * `formatSharePercent` rather than a second rounding written here, so the two
 * shares on a project page — the scope summary's delivered share and this one
 * — round the same way and treat the same near-misses the same.
 */
export function describeShare(share: number | null): string | null {
  if (share === null || share === 0 || share === 1) return null;
  return `${formatSharePercent(share)} of it`;
}

/**
 * What the comparison cell reads on a line nobody sized.
 *
 * It says there is no estimate rather than printing a dash, because a dash in
 * a column of judgements reads as a figure that failed to load. And it says
 * *compare* rather than "none", because the line is not missing data a reader
 * should go and type in — it is missing the one number this column divides
 * by, and the hours beside it are still perfectly real.
 */
export const NO_ESTIMATE_TO_COMPARE = "No estimate to compare";

/**
 * What the comparison cell reads on a finished line with no time against it.
 *
 * The arithmetic would say the line came in under by its whole estimate,
 * which is the most flattering sentence this table could produce and almost
 * never the true one. Work that was handed over took time; what has happened
 * is that the time was logged against the project, or against another line,
 * or not at all. Saying the estimate was beaten would turn a gap in the
 * record into a win.
 *
 * It is also the row that makes every other figure on the table suspect, so
 * it is worth naming rather than folding into "4h under" where a reader
 * scanning the column would never stop on it.
 */
export const DONE_WITH_NOTHING_LOGGED = "Marked done with nothing logged";

/**
 * What a line, or a whole project, has done to its estimate: the difference
 * and — where it adds anything — the share.
 *
 * Both in one cell rather than two columns, because they are one judgement
 * read at two scales and splitting them would put a mostly-empty column on
 * the table. A middle dot between them, the same separator a day heading uses
 * for its qualifying figures.
 *
 * The two refusals come first and in this order. No estimate means there is
 * nothing to say at all. A delivered line with no hours against it has
 * arithmetic that would say the wrong thing, so it is answered before the
 * arithmetic runs.
 *
 * `delivered` is a separate argument rather than a field, because a project
 * has no such thing — a project is never handed over, it is closed — and
 * inventing a field for it would invite a caller to ask whether this one is
 * done.
 */
export function describeAgainstEstimate(
  compared: EstimateComparison & { readonly loggedMinutes: number },
  delivered: boolean,
): string {
  if (compared.varianceMinutes === null) return NO_ESTIMATE_TO_COMPARE;
  if (delivered && compared.loggedMinutes === 0) {
    return DONE_WITH_NOTHING_LOGGED;
  }

  const variance = describeVariance(compared.varianceMinutes, delivered);
  const share = describeShare(compared.loggedShare);
  return share === null ? variance : `${variance} · ${share}`;
}

/**
 * How much of a row's logged time will not reach an invoice, or nothing at
 * all when all of it will.
 *
 * Said only where the two figures differ, which is almost never — time logged
 * against a client engagement is chargeable unless somebody says otherwise.
 * Printing "6h, 6h of it chargeable" on every row would be a clause that is
 * always true and therefore never read, and the one row where it mattered
 * would look like the rest. The same rule a day heading follows, for the same
 * reason.
 *
 * Said as what is *not* chargeable rather than what is, because the total is
 * already in the cell above it and the interesting figure is the gap between
 * the hours and the invoice. On a rollup that gap has a particular meaning:
 * it is the part of an overrun somebody has already decided to absorb, which
 * is a different conversation from the part they have not.
 */
export function describeNotChargeable(totals: LoggedTotals): string | null {
  if (totals.billableMinutes === totals.loggedMinutes) return null;
  const free = totals.loggedMinutes - totals.billableMinutes;
  return `${formatMinutes(free)} not chargeable`;
}

/**
 * What the four columns of the rollup table are called.
 *
 * "Against the estimate" rather than "Variance" or "Difference": the first is
 * an accountant's word and the other two describe the arithmetic rather than
 * the question. A reader scanning this table is asking how each line is doing
 * against what was agreed, and the heading should be that question.
 *
 * "Estimated" and "Logged" in that order, so the pair reads left to right as
 * what was promised and then what it took. Reversing them would put the
 * figure that moves in front of the figure it is being judged against.
 *
 * One object rather than four strings in the markup, so the headings and the
 * cells that say the same things in words cannot drift apart.
 */
export const ROLLUP_COLUMNS = {
  deliverable: "Deliverable",
  estimated: "Estimated",
  logged: "Logged",
  against: "Against the estimate",
} as const;

/**
 * One row of the rollup table, already in words.
 *
 * Every cell is a string by the time it reaches the markup, because three of
 * the four are sometimes a sentence rather than a figure — "Not estimated",
 * "None yet", "No estimate to compare" — and a component deciding that per
 * cell would be making the same judgement in four places with no test over
 * any of them.
 *
 * The id travels with the row as its key. Two deliverables can share a title
 * — "Revision round" twice is ordinary — so keying on the title would make
 * React reuse the wrong row the moment one of them moved.
 */
export type RollupRow = {
  readonly deliverableId: string;
  readonly title: string;
  readonly estimated: string;
  readonly logged: string;
  /** The part of the logged time that will not be invoiced, or null. */
  readonly notChargeable: string | null;
  readonly against: string;
};

/**
 * One rolled-up deliverable as the table shows it.
 *
 * The estimate goes through `describeEstimate`, the same function the scope
 * list calls on each of its lines, so a deliverable this table calls "Not
 * estimated" is one the scope tab calls "Not estimated" too. Writing the zero
 * check out again here is how two pages end up disagreeing about what a
 * missing estimate is.
 */
export function rollupRow(line: DeliverableRollup): RollupRow {
  return {
    deliverableId: line.deliverableId,
    title: line.title,
    estimated: describeEstimate(line.estimatedMinutes),
    logged: describeLogged(line.loggedMinutes),
    notChargeable: describeNotChargeable(line),
    against: describeAgainstEstimate(line, line.delivered),
  };
}

/**
 * How many stretches of work a figure was built from, with the word for them.
 *
 * It is on the project's total and not on every row because that is where it
 * is worth reading: twelve hours over an estimate is one piece of news if it
 * came from one entry somebody mistyped and another if it came from nineteen
 * afternoons. A count beside every row would be a column of small numbers
 * nobody scans.
 */
function entriesPhrase(count: number): string {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

/**
 * What the project's logged total is built from: how many entries, and how
 * much of it will not be invoiced.
 *
 * Nothing logged says so plainly rather than counting nought entries. It is
 * the ordinary state of a project in its first week and the sentence should
 * read like a fact rather than like a measurement of emptiness.
 */
export function describeLoggedTotal(rollup: ProjectRollup): string {
  if (rollup.entryCount === 0) {
    return "No time has been logged against this project yet.";
  }
  const counted = `Across ${entriesPhrase(rollup.entryCount)}.`;
  const free = describeNotChargeable(rollup);
  return free === null ? counted : `${counted} ${free}.`;
}

/**
 * What the project has logged, as a line of the panel.
 *
 * First, because every figure under it is a part of it or a judgement on it.
 * It is also the one figure here that is a plain fact — the hours happened,
 * whatever anybody estimated — and a panel of comparisons should open with
 * the thing being compared.
 */
export function loggedFigure(rollup: ProjectRollup): PanelFigure {
  return {
    label: "Logged",
    value: describeLogged(rollup.loggedMinutes),
    note: describeLoggedTotal(rollup),
  };
}

/**
 * What the scope list was sized at, as a line of the panel.
 *
 * The figure a reader is about to judge the hours against, and it is the Day
 * 015 total rather than anything worked out here — the same number the scope
 * tab shows, so a reader moving between the two tabs is not quietly handed
 * two different estimates for one project.
 *
 * The caveat under it is the scope summary's own, through the same function.
 * A total that does not cover the whole list is exactly as misleading here as
 * it is there, and more so: on this panel it is the denominator of a
 * percentage somebody might repeat out loud.
 *
 * A project with no deliverables gets its own sentence rather than that
 * caveat. "No line has an estimate" would send a reader looking for lines to
 * fill in, and there are none — what is missing is the scope list itself.
 */
export function estimatedFigure(rollup: ProjectRollup): PanelFigure {
  return {
    label: "Estimated",
    value: describeEstimate(rollup.estimatedMinutes),
    note:
      rollup.lines.length === 0
        ? "No deliverables have been agreed, so there is nothing for these hours to be set against."
        : describeUnestimated(
            rollup.lines.length,
            unestimatedCount(rollup.lines),
          ),
  };
}

/**
 * The working behind the project's comparison, or what to do when there is
 * none.
 *
 * The division written out — "6h estimated, 7h 15m logged" — because a
 * derived figure with no working beside it is one a reader either trusts
 * blindly or ignores, and this one is consequential enough that neither is
 * acceptable. The same reasoning the implied rate's note follows, and the
 * same two numbers are already on the panel above, so the sentence is a
 * reconciliation rather than new information.
 *
 * With nothing estimated the sentence says what would make the figure work
 * rather than restating the absence. The estimate figure above has already
 * said the list is unsized; what a reader needs here is that sizing it is
 * what turns this panel on.
 */
export function describeProjectComparison(rollup: ProjectRollup): string {
  if (rollup.varianceMinutes === null) {
    return "Put an estimate on the deliverables and this figure starts saying whether the project is running over.";
  }
  return `${formatMinutes(rollup.estimatedMinutes)} estimated, ${formatMinutes(
    rollup.loggedMinutes,
  )} logged.`;
}

/**
 * How the project as a whole stands against its scope list, as a line of the
 * panel.
 *
 * `delivered` is false, always. A project is never handed over — it is
 * closed, which is a different act with its own status column — so the
 * unspent half of an estimate is budget left rather than budget that was
 * never needed. Reading a closed project's remaining estimate as "came in
 * under" would be a judgement this panel has no business making.
 */
export function againstEstimateFigure(rollup: ProjectRollup): PanelFigure {
  return {
    label: ROLLUP_COLUMNS.against,
    value: describeAgainstEstimate(rollup, false),
    note: describeProjectComparison(rollup),
  };
}

/**
 * The point past which unattributed time stops being a footnote.
 *
 * More than half the hours against no line means the table below covers a
 * minority of the work, and every row in it understates what the project has
 * actually cost. That is worth a clause, because the figures would otherwise
 * look reassuring for the one reason a reader cannot see.
 *
 * Half rather than a tuned threshold: it is the point at which the
 * unattributed figure is larger than everything the table accounts for put
 * together, which is a fact about the arithmetic rather than a judgement
 * somebody has to agree with.
 */
const MOSTLY_UNATTRIBUTED = 0.5;

/**
 * What the unattributed figure means, which is not that anything is wrong.
 *
 * Time against no line is an answer — the call, the invoicing, the afternoon
 * of email the scope list has no line for — and the sentence says where it
 * went rather than asking for it to be tidied up. What it does say is where
 * the minutes are and are not counted, because that is the only way the
 * project total and the column of rows can be seen to reconcile.
 *
 * A project with every entry attributed is told so. It is a one-line
 * reassurance that the table below accounts for everything, which is
 * precisely the thing a reader would otherwise have to check by adding the
 * column up.
 *
 * Nothing at all when nothing has been logged. There is then no attribution
 * to have an opinion about, and the logged figure above has already said so.
 */
export function describeUnattributed(rollup: ProjectRollup): string | null {
  if (rollup.entryCount === 0) return null;

  const loose = rollup.unattributed;
  if (loose.loggedMinutes === 0) {
    return "Every entry on this project is attributed to a line of the scope list.";
  }

  const counted = `Across ${entriesPhrase(
    loose.entryCount,
  )}. Counted in the total above and in none of the rows below — there is no line of scope for it to be set against.`;
  if (loose.loggedMinutes > rollup.loggedMinutes * MOSTLY_UNATTRIBUTED) {
    return `${counted} That is most of the time logged on this project, so the rows below account for the smaller part of it.`;
  }
  return counted;
}

/**
 * What went against the project itself rather than a line, as a line of the
 * panel.
 *
 * Last of the four, because it is the figure that qualifies the other three
 * rather than one of the comparisons. It is also the only one that cannot be
 * worked out from the table below, which is the reason it is on the panel at
 * all: without it the rows add up to less than the total and nothing says
 * where the difference went.
 */
export function unattributedFigure(rollup: ProjectRollup): PanelFigure {
  return {
    label: "Against no deliverable",
    value: describeLogged(rollup.unattributed.loggedMinutes),
    note: describeUnattributed(rollup),
  };
}

/**
 * The project's half of the rollup, in the order it is read.
 *
 * Logged first, because it is the fact; estimated second, because it is what
 * the fact is being held against; the comparison third, because it is the
 * conclusion the first two lead to. Then the unattributed figure, which is
 * not a comparison at all but the qualification that makes the table below
 * reconcile with the total above.
 *
 * One array rather than four calls from the panel, so the order is a decision
 * made once in the place that explains it — the same arrangement
 * `scopeSummaryFigures` keeps next door, and these render through the same
 * row component.
 */
export function rollupFigures(rollup: ProjectRollup): PanelFigure[] {
  return [
    loggedFigure(rollup),
    estimatedFigure(rollup),
    againstEstimateFigure(rollup),
    unattributedFigure(rollup),
  ];
}

/**
 * Why the rows do not add up to the total, when they do not.
 *
 * Time attributed to a line this page was not given. It should never happen,
 * and when it does the cause is two reads a moment apart — the scope list
 * fetched before a deliverable was added, or the entries fetched after it was.
 * The minutes are in the project's total and in none of the rows, so without
 * a sentence the table is simply wrong by that much and a reader would go
 * looking for the arithmetic error.
 *
 * It says to reload, because reloading is the fix and the reader has no other
 * move: nothing is broken in the data, and the next render will have both
 * lists from the same moment. The same reading `entryAttribution` gives a row
 * whose line it cannot name.
 *
 * Null the rest of the time, which is always. This is a sentence that appears
 * when something has genuinely gone out of step, not a disclaimer under every
 * project.
 */
export function describeUnmatchedTime(rollup: ProjectRollup): string | null {
  if (rollup.unmatchedMinutes === 0) return null;
  return `${formatMinutes(
    rollup.unmatchedMinutes,
  )} is attributed to a deliverable this page does not have, so it is in the total above and in none of the rows below. The scope list and the time list were read a moment apart; reloading should settle it.`;
}
