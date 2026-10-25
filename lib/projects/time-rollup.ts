import { describeEstimate } from "@/lib/deliverables/list";
import { formatMinutes } from "@/lib/minutes";
import { negativeEstimateCount, unestimatedCount } from "@/lib/scope";
import { notChargeablePhrase } from "@/lib/time/days";
import {
  loggedShare,
  type DeliverableRollup,
  type EstimateComparison,
  type LoggedTotals,
  type ProjectRollup,
} from "@/lib/time/rollup";

import type { PanelFigure } from "./figure";

import {
  deliverablesHave,
  deliverablesPhrase,
  describeUnestimated,
  estimatedTotalValue,
  formatSharePercent,
} from "./scope-summary";

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
 * Whether there is anything to roll up yet.
 *
 * A project nobody has logged against has no rollup: four figures reading
 * "None yet" above a table of rows reading "None yet" answers a question
 * nobody asked, and the list underneath already says that nothing has been
 * logged. The panel appears with the first entry.
 *
 * Here rather than in the panel, for the reason the sentences are: it is a
 * rule about the rollup rather than about one tab, every page that grows a
 * rollup later should make the same call, and the panel's most consequential
 * decision — render nothing at all — is testable where JSX is not.
 */
export function hasTimeToRollUp(rollup: ProjectRollup): boolean {
  return rollup.entryCount > 0;
}

/**
 * Whether there is a scope list for the hours to be set against.
 *
 * The one notion behind every other answer this panel gives about an empty
 * agreement: which figures are worth printing, whether the table is drawn or
 * a sentence stands in for it, and whether a caveat may point at "the rows
 * below". Six places used to ask `lines.length === 0` for themselves, which
 * is six chances to disagree about what a missing scope list is — and they
 * did, until a reader was told four times over that a project had none.
 *
 * Asked of the lines rather than of the estimate total, because a list of
 * unsized lines is still a list. "Nothing is estimated" and "nothing is
 * agreed" are different states with different sentences, and this is the
 * second one.
 */
export function hasScopeToRollUp(rollup: ProjectRollup): boolean {
  return rollup.lines.length > 0;
}

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
 * `notChargeablePhrase` over the two figures a rollup already carries. The
 * day heading beside it says exactly this about exactly this subtraction, and
 * a rollup row disagreeing with the day that produced it — about the one
 * figure on the panel that reaches an invoice — is the kind of inconsistency
 * nobody can debug from the screen.
 *
 * On a rollup the gap has a particular meaning the day heading's does not: it
 * is the part of an overrun somebody has already decided to absorb, which is
 * a different conversation from the part they have not. Same words, because a
 * reader should not have to learn two.
 */
export function describeNotChargeable(totals: LoggedTotals): string | null {
  return notChargeablePhrase(totals.loggedMinutes, totals.billableMinutes);
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
function describeLoggedTotal(rollup: ProjectRollup): string {
  if (!hasTimeToRollUp(rollup)) {
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
 * A project with no deliverables never gets this figure at all: there is no
 * total to show and nothing for an estimate caveat to be about, so
 * `rollupFigures` drops it and the panel's own sentence says where a scope
 * list gets written. Which is why there is no empty-list wording here — it
 * would be a sentence no reader could reach.
 *
 * The unsized count is taken once and handed to both halves. The value and
 * the caveat are two readings of the same number, and counting twice is how a
 * figure reading "Not estimated" comes to sit above a note saying three of
 * five lines are sized.
 */
export function estimatedFigure(rollup: ProjectRollup): PanelFigure {
  const unestimated = unestimatedCount(rollup.lines);
  return {
    label: "Estimated",
    value: estimatedTotalValue(
      rollup.lines.length,
      unestimated,
      rollup.estimatedMinutes,
    ),
    note: describeUnestimated(rollup.lines.length, unestimated),
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
 *
 * Two ways to have no estimate, and they want different things done about
 * them — the same split `describeImpliedRate` makes, for the same reason.
 * Estimates that cancel out to nothing need a row fixing rather than rows
 * filling in, and the caveat above the panel says which. Only the ordinary
 * unsized list is asked to be sized.
 *
 * The third way — no deliverables at all — is not worded here, because this
 * figure is not drawn for such a project: `rollupFigures` keeps only the
 * hours, and the panel's own sentence says where a scope list gets written.
 */
function describeProjectComparison(rollup: ProjectRollup): string {
  if (rollup.varianceMinutes !== null) {
    return `${formatMinutes(rollup.estimatedMinutes)} estimated, ${formatMinutes(
      rollup.loggedMinutes,
    )} logged.`;
  }
  if (negativeEstimateCount(rollup.lines) > 0) {
    return "The estimates on this list cancel out to no hours at all, so there is nothing for the logged time to be set against.";
  }
  return "Put an estimate on the deliverables and this figure starts saying whether the project is running over.";
}

/**
 * How the project as a whole stands against its scope list, as a line of the
 * panel.
 *
 * A project is never handed over — it is closed, which is a different act
 * with its own status column — so it has no `delivered` of its own and the
 * unspent half of an estimate is ordinarily budget left rather than budget
 * that was never needed. The one exception is the scope list saying so: with
 * every line marked done there is no work left for the remaining estimate to
 * be spent on, and "3h left" would be inviting a reader to spend hours
 * against an agreement that is finished. That is `scopeDelivered`, which the
 * rollup carries so this does not decide it a second time.
 */
export function againstEstimateFigure(rollup: ProjectRollup): PanelFigure {
  return {
    label: ROLLUP_COLUMNS.against,
    value: describeAgainstEstimate(rollup, rollup.scopeDelivered),
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
function describeUnattributed(rollup: ProjectRollup): string | null {
  if (!hasTimeToRollUp(rollup)) return null;

  const loose = rollup.unattributed;
  if (loose.loggedMinutes === 0) {
    /*
      Nothing went against the project itself — but with minutes pointing at a
      line this page does not have, "every entry is attributed to a line of
      the scope list" would contradict the caveat printed directly above it.
      Both would be about the same stale read, and the reader would have to
      decide which of the two to believe. The caveat is the one with the
      explanation in it, so this says nothing.
    */
    if (rollup.unmatchedMinutes > 0) return null;
    return "Every entry on this project is attributed to a line of the scope list.";
  }

  /*
    With no scope list there is no table under this figure, so the sentence
    cannot point at rows. It says what is true instead — there is no line for
    any of this time to be set against — and the panel's own sentence under
    the figures says where a scope list gets written.
  */
  const across = `Across ${entriesPhrase(loose.entryCount)}.`;
  if (!hasScopeToRollUp(rollup)) {
    return `${across} There are no deliverables on this project, so there is no line of scope for any of it to be set against.`;
  }

  const counted = `${across} Counted in the total above and in none of the rows below — there is no line of scope for it to be set against.`;
  /*
    Through `loggedShare` rather than a multiplication written out here. It is
    the one division this panel needs that the arithmetic layer did not
    already hand over, and the layer that divides is the layer with the tests
    for dividing — including the nought denominator this branch is only safe
    from by having returned above.
  */
  const share = loggedShare(loose.loggedMinutes, rollup.loggedMinutes);
  if (share !== null && share > MOSTLY_UNATTRIBUTED) {
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
  /*
    With no scope list the last three figures are three ways of saying the
    same thing: nothing is estimated, there is nothing to compare, and all of
    the time went against no line. Printing them would state one fact four
    times — the panel's own sentence says it a fifth, and that one says what
    to do about it. So only the fact survives: the hours, which are real.
  */
  if (!hasScopeToRollUp(rollup)) return [loggedFigure(rollup)];

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
 *
 * Two wordings, because a stale read can leave the page with no rows at all:
 * when the scope list came back empty the panel draws `NO_SCOPE_TO_ROLL_UP`
 * instead of a table, and pointing at "the rows below" would be pointing at
 * nothing. `describeUnattributed` draws the same distinction for the same
 * reason.
 *
 * It names the project's total rather than placing it. This is a caveat, so
 * the panel prints it above the figures — where "the total above" would point
 * a reader at the heading. The rows really are below it, and those it points
 * at; `describeUnattributed` sits under the fourth figure and can say "above"
 * about the first, which is why only one of the two is positional.
 */
export function describeUnmatchedTime(rollup: ProjectRollup): string | null {
  if (rollup.unmatchedMinutes === 0) return null;
  const stray = `${formatMinutes(
    rollup.unmatchedMinutes,
  )} is attributed to a deliverable this page does not have`;
  const reload =
    "The scope list and the time list were read a moment apart; reloading should settle it.";
  if (!hasScopeToRollUp(rollup)) {
    return `${stray}, so it is in the project's total and there is no row for it — the scope list came back empty while the time list still points at a line. ${reload}`;
  }
  return `${stray}, so it is in the project's total and in none of the rows below. ${reload}`;
}

/**
 * The line above the table: how many lines it holds, how many have anything
 * against them, and how many have gone past what they were sized at.
 *
 * The last count is the headline, and it is here rather than left to the eye
 * because the rows are not sorted by it — they are in the order the scope was
 * agreed, which is the order a reader can match against the scope tab, and a
 * project with nineteen deliverables can hide two overruns in the middle of
 * it.
 *
 * The middle count is the one that says how far to trust the table. Three
 * lines with time against them out of nineteen is an engagement where almost
 * nothing is attributed yet, and the fourteen rows reading "None yet" are
 * about bookkeeping rather than about the work.
 */
export function describeRollupTable(rollup: ProjectRollup): string {
  const { lines } = rollup;
  const alone = lines.length === 1;
  const counted = deliverablesPhrase(lines.length);
  const worked = lines.filter((line) => line.loggedMinutes > 0).length;
  if (worked === 0) {
    return `${counted}, with no time logged against ${
      alone ? "it" : "any of them"
    } yet.`;
  }

  const having = alone
    ? `${counted}, with time logged against it.`
    : `${counted}, ${worked} of them with time logged.`;
  return `${having} ${describePastEstimate(lines)}`;
}

/**
 * What the lead-in says about overruns, or why it cannot say anything.
 *
 * "None has gone past its estimate" is a reassurance, and a reassurance about
 * lines that have no estimate is false comfort of the worst kind: every row
 * below reads "No estimate to compare", and the sentence above them says the
 * project is fine. So the lines that *can* be compared are counted first, and
 * where there are none the sentence says that instead.
 *
 * A line is comparable when it has a variance, which is `varianceMinutes`
 * being non-null rather than a second zero check written out here — so a line
 * this sentence passes over is exactly a line the table's last column refuses
 * to judge.
 *
 * Which means the reassurance has to say how much of the list it covers, not
 * just withhold itself when it covers none. One sized line under its estimate
 * beside eighteen unsized ones is not a project where "None has gone past its
 * estimate" is a fair reading — it is true of every line and heard as being
 * about the list. So an unqualified "None" is kept for the list where every
 * line could be judged, and anything short of that names the count it speaks
 * for.
 *
 * Only the reassurance is qualified. "One has gone past its estimate" claims
 * nothing about the lines it leaves out, so a reader cannot take comfort from
 * it that the unsized rows do not support.
 *
 * The lone-line wordings are picked off `lines` rather than from a flag the
 * caller works out and passes in. Two arguments where one decides the other
 * can be handed a contradictory pair, and the singular branches rely on that
 * invariant: `over === 1` below is really `over > 0`, safe only on a list of
 * one.
 */
function describePastEstimate(lines: readonly DeliverableRollup[]): string {
  const alone = lines.length === 1;
  const comparable = lines.filter(
    (line) => line.varianceMinutes !== null,
  ).length;
  if (comparable === 0) {
    return alone
      ? "It has no estimate for the time to be set against."
      : "None of them has an estimate for the time to be set against.";
  }

  const over = lines.filter(
    (line) => line.varianceMinutes !== null && line.varianceMinutes > 0,
  ).length;
  if (alone) {
    return over === 1
      ? "It has gone past its estimate."
      : "It has not gone past its estimate.";
  }
  if (over === 0) {
    if (comparable === lines.length) return "None has gone past its estimate.";
    if (comparable === 1) {
      return "The one line with an estimate on it has not gone past it.";
    }
    return `None of the ${comparable} with an estimate has gone past it.`;
  }
  if (over === 1) return "One has gone past its estimate.";
  return `${over} have gone past their estimates.`;
}

/**
 * Why a row says a line nobody has touched is already over, when it does.
 *
 * A negative estimate. Nothing in the app writes one — the estimate field
 * refuses it — so the row was written straight to the database, and the
 * arithmetic here does not repair it: a line estimated at minus two hours
 * with nothing logged against it comes out as two hours over, which is the
 * single most confusing cell this table can produce.
 *
 * Counted off the lines rather than inferred from the figures, the same way
 * `describeEstimateProblem` does it for the scope summary, because the
 * figures are exactly what a cancelling pair of lines hides: plus two hours
 * and minus two hours leave the project's estimate reading nought, and the
 * panel would then say the project is unestimated while two of its lines are
 * sized.
 *
 * It points at the scope list rather than explaining the arithmetic, because
 * that is where the bad row is visible and where it can be fixed.
 */
export function describeNegativeEstimates(
  rollup: ProjectRollup,
): string | null {
  const bad = negativeEstimateCount(rollup.lines);
  if (bad === 0) return null;
  return `${deliverablesHave(bad)} a negative estimate, so the comparisons here do not mean what they say — a line sized below zero reads as over before anything is logged against it. The form will not accept one, so the row was written straight to the database; the scope list shows which.`;
}

/**
 * Everything wrong with this rollup that a reader needs told, in the order
 * they would meet it.
 *
 * The negative estimate first, because it makes individual cells say false
 * things; the unmatched minutes second, because they make the column fail to
 * add up. Both are about the figures rather than about the project, and both
 * are almost always absent — an array, so the panel renders what there is
 * without asking which.
 *
 * Gathered here rather than in the component because deciding what counts as
 * a problem is a rule about the data, and the panel's job is to set the type.
 */
export function rollupProblems(rollup: ProjectRollup): string[] {
  return [describeNegativeEstimates(rollup), describeUnmatchedTime(rollup)].filter(
    (problem): problem is string => problem !== null,
  );
}

/**
 * What the panel says instead of a table when there is time but no scope.
 *
 * It names where the fix is. The hours are real and the panel can show them;
 * what is missing is the other half of every comparison, and that half is
 * written on a different tab — a reader told only that there is nothing to
 * compare would be left with a true sentence and no next move.
 */
export const NO_SCOPE_TO_ROLL_UP =
  "This project has no deliverables, so there is nothing for these hours to be set against. Agree the scope on the Scope tab and each line gets a row here.";

/**
 * What the whole panel is and is not, said once underneath it.
 *
 * Two things a reader could otherwise take from it. The first is that an
 * estimate is a guess somebody made before the work started, so a line over
 * it is a thing to go and look at rather than a thing that is wrong —
 * treating the column as a scorecard is how a team learns to pad estimates.
 * The second is that none of this is money: whether an overrun matters
 * depends on what the project was agreed for, which these figures do not
 * read.
 *
 * One sentence under the figures rather than a caveat on each, the same
 * arrangement the scope summary keeps: the rows carry what is specific to
 * them and this is true of all of them.
 */
export const ROLLUP_IS_HOURS_ONLY =
  "These are hours against hours. An estimate is a guess made before the work started, so a line past it is somewhere to look rather than something to answer for — and what an overrun costs depends on what the project was agreed for, which these figures do not read.";
