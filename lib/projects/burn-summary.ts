import {
  overspentCents,
  remainingMinutesAtRate,
  type BurnSummary,
} from "@/lib/burn";
import { formatCents } from "@/lib/money";
import type { EffectiveRate, RateSource } from "@/lib/rates";
import { formatMinutes } from "@/lib/minutes";
import { notChargeablePhrase } from "@/lib/time/days";

import { entriesPhrase, NOTHING_LOGGED_LABEL } from "./time-rollup";

import { hasContractValue, NO_CONTRACT_VALUE_LABEL } from "./detail";
import type { PanelFigure } from "./figure";
import { formatSharePercent } from "./scope-summary";

/**
 * The words a burn summary is read in.
 *
 * `lib/burn.ts` works out what a project has consumed of what it was agreed
 * for; nothing in it knows what a figure is called, when a figure is worth
 * showing, or what a reader should conclude from it. That is this file: a
 * label, a value, and — where the number alone would mislead — the sentence
 * that says how to read it.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * summary's and the rollup's do: deciding that nought burned against eighty
 * hours logged means a missing rate rather than a cheap project is a rule
 * about the data, and a rule is testable where JSX is not.
 *
 * This is the most consequential panel in the app so far. "You have burned
 * 112% of this contract" is a sentence somebody takes into a difficult
 * conversation, and the figure behind it is a product of three columns any
 * one of which may be empty. So every value here either says something the
 * arithmetic supports or says plainly that it cannot — and the note under it
 * is the working, so a reader can check the claim rather than having to
 * believe it.
 */

/**
 * Whether there is a burn worth showing at all.
 *
 * Two ways to have one. Time logged is the obvious one: hours have gone in,
 * and what they came to is the question. A contract value with nothing logged
 * is the other, and it is worth a panel too — "nothing burned, the whole
 * $5,000.00 still there" is the opening state of every engagement, and a
 * panel that appeared only once somebody had logged against it would leave a
 * reader wondering where the figure went.
 *
 * Neither means nothing to say. A project with no price and no hours is a row
 * somebody has just created, and four figures reading "Not set" and "None
 * yet" above it would be a panel reporting that the project is new.
 *
 * Here rather than in the panel, for the reason the sentences are: it is a
 * fact about the burn rather than about one tab, and the panel's most
 * consequential decision — render nothing at all — is testable where JSX is
 * not.
 */
export function hasBurnToShow(summary: BurnSummary): boolean {
  return summary.entryCount > 0 || summary.contractedCents !== 0;
}

/**
 * Whether the burn figure is a measurement rather than a gap.
 *
 * The dangerous combination this panel can reach: hours logged, and no rate
 * anywhere to value them. The arithmetic comes out at nought burned, which
 * makes the remainder the whole contract and the share nought percent — three
 * figures all saying the engagement has barely started, about a project that
 * may have eaten its budget twice over. Of the four, only the burn figure
 * names the gap; the other two would state amounts.
 *
 * So the two derived figures ask this before they say anything. Not whether
 * there is a rate — a project nobody has logged against has burned nothing
 * whatever its rate is, and that nought is a measurement, so the whole
 * contract really is still there.
 *
 * A rate deliberately overridden to nothing counts as valued. Somebody said
 * this project does not bill by the hour, so nought burned is what they meant
 * and the contract really is untouched by the hours.
 */
export function hasValuedBurn(summary: BurnSummary): boolean {
  return summary.rate.source !== "none" || summary.loggedMinutes === 0;
}

/**
 * Whether there is a price for the burn to be measured against.
 *
 * Asked of the share rather than of the amount, so the two cannot come apart:
 * the remainder and the percentage are the two figures that need a price, and
 * `consumedShare` is already null for both of the prices that cannot carry one
 * — the zero that nobody filled in and the below-zero that somebody typed into
 * the database. A second `> 0` written out here would be a third opinion about
 * which prices count, and it would be the one the page believed.
 *
 * It decides whether those two rows are drawn at all rather than what they
 * say. Two rows reading "No price set" under a row that has just said the same
 * thing is a panel repeating itself three times about one empty field — so the
 * contracted figure says it once and the comparisons wait until there is
 * something to compare.
 */
export function hasPriceToMeasureAgainst(summary: BurnSummary): boolean {
  return summary.consumedShare !== null;
}

/**
 * Why there is nothing for the figures below to be measured against, when
 * there is not.
 *
 * The one thing a reader can do about it: the price is a field on the edit
 * form, and until it is filled in the remaining figure and the percentage are
 * both about half a comparison. Said once here rather than repeated under
 * each of them, because it is one missing fact rather than three.
 *
 * Null when a price is set, which is almost always. An amount somebody agreed
 * needs no explanation — it is the one figure on this panel that was typed in
 * rather than derived.
 */
export function describeContracted(summary: BurnSummary): string | null {
  if (hasContractValue(summary.contractedCents)) return null;
  return "No contract value is set on this project, so there is nothing for the hours to be measured against. It is a field on the edit form.";
}

/**
 * What the engagement was agreed for, as the first line of the panel.
 *
 * First, because every figure under it is a part of it or a judgement on it,
 * and none of them means anything until a reader knows what the agreement
 * was. It is also the only figure here that somebody typed in — the other
 * three are arithmetic over it — and a panel of derived numbers should open
 * with the one that was agreed.
 *
 * "Contracted" rather than "Contract value", which is what the header calls
 * it. The header is stating a fact about the project; this is one of four
 * figures in a column, and the shorter word keeps it reading as a quantity
 * beside "Burned" and "Remaining" rather than as a repeat of the heading
 * above it.
 */
export function contractedFigure(summary: BurnSummary): PanelFigure {
  return {
    label: "Contracted",
    value: hasContractValue(summary.contractedCents)
      ? formatCents(summary.contractedCents)
      : NO_CONTRACT_VALUE_LABEL,
    note: describeContracted(summary),
  };
}

/**
 * Which row said what an hour is worth, as a clause.
 *
 * The provenance is half of what makes a burn figure actionable. A reader who
 * thinks the rate is wrong has to know which form to open, and the two forms
 * are a long way apart — the project's override is on this project's edit
 * page, the client's default is on the client's. "$150.00/hr" alone sends
 * them hunting.
 *
 * A record over every source rather than a chain of conditions, so adding a
 * fourth place a rate could come from is a compile error here rather than a
 * sentence that quietly stops mentioning it.
 */
const RATE_SOURCE_PHRASE: Record<RateSource, string> = {
  project: "the rate set on this project",
  client: "the client's default rate",
  none: "no rate is set on this project or its client",
};

/**
 * What the hours were valued at and on whose authority, as a clause for the
 * middle of a sentence.
 *
 * With no rate anywhere the amount is left out altogether. "$0.00/hr, no rate
 * is set" would be two readings of the same gap, one of them dressed as a
 * measurement — and the figure it is explaining is already a zero that needs
 * no help looking like one.
 *
 * A rate overridden to nothing keeps its amount and its provenance, because
 * that is a decision somebody made and the clause is how a reader tells it
 * from the gap: "$0.00/hr, the rate set on this project" is a sentence about a
 * project that does not bill by the hour.
 */
export function describeRateBasis(rate: EffectiveRate): string {
  if (rate.source === "none") return RATE_SOURCE_PHRASE.none;
  return `${formatCents(rate.cents)}/hr, ${RATE_SOURCE_PHRASE[rate.source]}`;
}

/**
 * The part of the burn somebody has already decided to absorb, or nothing
 * when none of it is.
 *
 * The one clarification the burn figure genuinely needs. Every logged minute
 * is in it, chargeable or not, because the work happened and it cost what it
 * cost — but a reader comparing this panel against an invoice will find the
 * invoice smaller, and the difference is this. Saying so is what stops the
 * burn figure looking like a mistake.
 *
 * It says the minutes and the money, because the two are different arguments.
 * The hours are what was given away; the amount is what it cost to give away,
 * and against a contract value the amount is the half that matters.
 *
 * The amount is left out when the rate cannot value it. Nought cents of
 * absorbed time is not a write-off worth no money, it is a write-off nobody
 * can price — and `$0.00` beside five hours would read as the reassurance it
 * is not.
 *
 * `notChargeablePhrase` rather than the subtraction written out again, so the
 * hours here and the hours in the day heading that produced them are worded
 * by one rule.
 */
export function describeWriteOff(summary: BurnSummary): string | null {
  const phrase = notChargeablePhrase(
    summary.loggedMinutes,
    summary.billableMinutes,
  );
  if (phrase === null) return null;
  const absorbed = summary.burnedCents - summary.chargeableCents;
  if (absorbed === 0) {
    return `Includes ${phrase}, which is burned all the same — deciding not to charge for an hour does not give the hour back.`;
  }
  return `Includes ${phrase}, worth ${formatCents(absorbed)} of the burn — deciding not to charge for it does not give the time back.`;
}

/**
 * What the burn figure says when the hours cannot be priced.
 *
 * Not `$0.00`. A project with eighty hours on it and no rate anywhere has
 * burned an unknown amount, and nought is the one answer that is certainly
 * wrong — it would put the project at the healthy end of every list for the
 * sole reason that nobody had filled a rate in, which is the most expensive
 * reading this panel could offer.
 *
 * It says what is missing rather than that something is. "No rate set" is a
 * form to go and open; "Unknown" is a shrug.
 */
export const BURN_NOT_VALUED_LABEL = "No rate set";

/**
 * The working behind the burn: how many hours, from how many entries, at what
 * rate and on whose authority.
 *
 * A burn figure is a product of two numbers neither of which is on this panel,
 * so without the working it is a figure a reader either trusts blindly or
 * ignores — and this one is too consequential for either. "40h across 12
 * entries, at $150.00/hr, the client's default rate" is a sentence somebody
 * can check; "$6,000.00" is one they can only believe.
 *
 * With no rate anywhere the sentence says so and stops short of an amount. The
 * hours are a fact and they are still worth stating — they are the half of the
 * calculation that is known, and they are what makes the missing rate urgent
 * rather than tidy-up work.
 *
 * The write-off follows rather than being folded in, because it is a second
 * thing to know rather than a qualification of the first. A reader who does
 * not care whether any of it was chargeable has already finished the sentence
 * they came for.
 */
export function describeBurned(summary: BurnSummary): string {
  if (summary.loggedMinutes === 0) {
    return "Nothing has been logged against this project yet, so nothing has been burned.";
  }
  const hours = `${formatMinutes(summary.loggedMinutes)} across ${entriesPhrase(
    summary.entryCount,
  )}`;
  const working =
    summary.rate.source === "none"
      ? `${hours}, and ${describeRateBasis(summary.rate)} — the hours are recorded, what they came to is not.`
      : `${hours}, at ${describeRateBasis(summary.rate)}.`;
  const absorbed = describeWriteOff(summary);
  return absorbed === null ? working : `${working} ${absorbed}`;
}

/**
 * What the hours logged against this project have cost, as a line of the
 * panel.
 *
 * Second, directly under the price, because the whole panel is the comparison
 * between these two and the two figures a reader subtracts should be next to
 * each other.
 *
 * "Burned" rather than "Spent" or "Cost". It is the word the industry uses for
 * exactly this — value consumed out of a fixed budget — and it carries the
 * right implication, which is that the amount is gone whether or not anything
 * was delivered for it.
 *
 * Nothing logged says "None yet" rather than `$0.00`, the same two words the
 * rollup uses for the same absence: a project nobody has worked on has not
 * burned nothing, it has not started.
 */
export function burnedFigure(summary: BurnSummary): PanelFigure {
  return {
    label: "Burned",
    value: burnedValue(summary),
    note: describeBurned(summary),
  };
}

/**
 * The amount, or the words that stand in for one.
 *
 * Decided by the hours first and the rate second, which is the order the two
 * absences matter in: a project nobody has logged against needs no rate to
 * explain its nought, and saying "No rate set" against no hours would send a
 * reader to fix a field that is not yet holding anything back.
 */
function burnedValue(summary: BurnSummary): string {
  if (summary.loggedMinutes === 0) return NOTHING_LOGGED_LABEL;
  if (summary.rate.source === "none") return BURN_NOT_VALUED_LABEL;
  return formatCents(summary.burnedCents);
}

/**
 * What is left of the contract value, in the terms somebody acts on.
 *
 * Four sentences, as flat guards in the order the news gets worse, because the
 * figure above means four different things and only one of them is "there is
 * budget left".
 *
 * Over the contract, the amount is said again as a positive number after the
 * word "over". The value above it carries a minus sign, which is correct and
 * is not what a reader repeats out loud — and the sentence after it is the
 * only place the consequence gets stated: hours logged from here are hours
 * nobody is paying for, which is a decision to make rather than a figure to
 * note.
 *
 * Exactly spent gets its own sentence, for the reason `ON_THE_ESTIMATE_LABEL`
 * exists: it happens more often than the arithmetic suggests, because round
 * contracts meet round rates, and "$0.00 left" is a true figure that reads as
 * a rendering fault.
 *
 * With budget left the sentence is in hours rather than in money. The amount
 * is already the value above it, and saying it twice tells a reader nothing
 * they cannot see — what they actually want is how much more work it pays for,
 * which is the one thing on this panel that is about next week rather than
 * about last month.
 *
 * Without a rate there are no hours to convert into, and the sentence says so
 * rather than restating the amount. The burn figure above has already said
 * which form to open.
 */
export function describeRemaining(summary: BurnSummary): string {
  const over = overspentCents(summary.contractedCents, summary.burnedCents);
  if (over > 0) {
    return `${formatCents(over)} over the contract value. Hours logged from here are hours the agreement does not pay for.`;
  }
  if (summary.remainingCents === 0) {
    return "The contract value is spent to the cent. The next hour logged is the first the agreement does not pay for.";
  }
  const minutes = remainingMinutesAtRate(summary.remainingCents, summary.rate);
  if (minutes === null) {
    return "No rate is set, so there is no saying how much more work this pays for.";
  }
  return `About ${formatMinutes(minutes)} more at ${formatCents(summary.rate.cents)}/hr, if the rate holds and nothing more is written off.`;
}

/**
 * What is left of the contract value, as a line of the panel.
 *
 * Third, because it is the subtraction of the two figures above it and a
 * reader should meet it having already seen both halves. It is also the figure
 * somebody came for: "how much room is left" is the question a burn summary
 * gets opened to answer.
 *
 * Signed rather than clamped, so a project that has gone over says so in the
 * column as well as in the sentence. "-$2,500.00" is a figure a reader stops
 * at; "$0.00" is one they read as a budget that has just run out, which is a
 * materially better situation than the one they are in.
 *
 * Where the burn could not be priced the figure declines to state an amount.
 * The subtraction would come out at the whole contract value, which is the
 * most reassuring thing this panel could say about the project it is least
 * able to describe.
 */
export function remainingFigure(summary: BurnSummary): PanelFigure {
  return {
    label: "Remaining",
    value: hasValuedBurn(summary)
      ? formatCents(summary.remainingCents)
      : BURN_NOT_VALUED_LABEL,
    note: describeRemaining(summary),
  };
}

/**
 * The working behind the percentage: the two amounts it was divided from.
 *
 * Both of them are already on the panel, which is the point — the sentence is
 * a reconciliation rather than new information, and a reader who finds "60%"
 * surprising can see in one line which half of the division surprised them.
 * The same reasoning the implied rate's note follows, and the same shape:
 * "$3,000.00 of the $5,000.00 agreed".
 *
 * A share is the figure on this panel most likely to be repeated out loud, and
 * a figure repeated out loud needs to be checkable. "You have burned 112% of
 * this contract" is a sentence that starts a difficult conversation, and the
 * person saying it should be able to show the two numbers it came from without
 * leaving the panel.
 *
 * With no rate to value the hours there is no share, and the sentence says
 * which half is missing rather than restating the absence. The time is known;
 * what it is worth is not.
 */
export function describeConsumed(summary: BurnSummary): string {
  if (!hasValuedBurn(summary)) {
    return "No rate is set, so the hours cannot be turned into a share of the contract. The time is recorded; what it has consumed is not.";
  }
  return `${formatCents(summary.burnedCents)} of the ${formatCents(
    summary.contractedCents,
  )} agreed.`;
}

/**
 * What the share says when there is no price to take a share of.
 *
 * `burnFigures` keeps this row out of a panel with no contract value, so the
 * words are not ordinarily reachable. They exist because the alternative is a
 * branch that throws or a percentage of zero, and a figure function that
 * cannot answer for every summary it is typed to accept is one a later caller
 * will discover the hard way — a portfolio table drawing rows unconditionally
 * is exactly the caller Day 039 adds.
 */
export const NO_PRICE_TO_SHARE_LABEL = "No price set";

/**
 * How much of the contract the hours have eaten, as the last line of the
 * panel.
 *
 * Last, because it is the conclusion: the three figures above are amounts, and
 * this is the one that says whether they are good or bad news. It is also the
 * figure that travels — a percentage is what gets said in a meeting, and the
 * amounts are what somebody checks it against afterwards.
 *
 * `formatSharePercent` rather than a percentage worked out here, so the three
 * panels on this project round a share the same way. It is the function that
 * writes "less than 1%" rather than nought and "more than 100%" rather than
 * exactly a hundred, and both of those matter more here than they did on the
 * scope tab: "100% consumed" on a project that has gone a hair over says the
 * budget is exactly spent, and the reader stops looking.
 *
 * Unclamped, so a project at 168% says so. That is the figure this whole phase
 * was built to surface, and no rounding or capping stands between it and the
 * reader.
 */
export function consumedFigure(summary: BurnSummary): PanelFigure {
  return {
    label: "Consumed",
    value: consumedValue(summary),
    note: describeConsumed(summary),
  };
}

/**
 * The percentage, or the words that stand in for one.
 *
 * The rate is asked about before the price, matching the order the burn figure
 * decides in: a share worked out from a burn that no rate could value would be
 * nought percent of a contract that may be gone, which is the one answer on
 * this panel that could lose somebody money.
 */
function consumedValue(summary: BurnSummary): string {
  if (!hasValuedBurn(summary)) return BURN_NOT_VALUED_LABEL;
  if (summary.consumedShare === null) return NO_PRICE_TO_SHARE_LABEL;
  return formatSharePercent(summary.consumedShare);
}

/**
 * The whole burn summary, in the order it is read.
 *
 * The price first, because it is what was agreed and everything under it is a
 * reading of it. Then the burn, which is the other half of the comparison, so
 * the two amounts a reader subtracts sit next to each other. Then the
 * subtraction, then the division — the two conclusions, in the order of how
 * much they commit to.
 *
 * One array rather than four calls from the panel, so the order is a decision
 * made once in the place that explains it, and a figure added later cannot
 * land in a different position on a different screen.
 *
 * With no price the last two drop out. Both of them are comparisons against a
 * number nobody has filled in, and both would have to say so — three rows
 * running "Not set", "No price set", "No price set" is a panel repeating
 * itself about one empty field. The contracted row says it once, with the
 * sentence that says where the field is, and the burn is still shown because
 * the hours were still spent.
 */
export function burnFigures(summary: BurnSummary): PanelFigure[] {
  const figures = [contractedFigure(summary), burnedFigure(summary)];
  if (!hasPriceToMeasureAgainst(summary)) return figures;
  return [...figures, remainingFigure(summary), consumedFigure(summary)];
}

/**
 * What to say when the hours have no rate to be valued at.
 *
 * The one gap on this panel that makes it useless rather than incomplete, so
 * it is said above the figures rather than under one of them: two of the four
 * rows have already declined to state an amount, and a reader who has not been
 * told why will read the panel as broken rather than as waiting.
 *
 * It names both places a rate can come from, because either fixes it and they
 * are on different pages. The project's override is the narrower answer and
 * comes first; the client's default is the one worth setting if every project
 * for them bills the same.
 */
export const NO_RATE_TO_BURN_AT =
  "No rate is set on this project or on its client, so the hours logged against it cannot be valued. Set an override on this project, or a default rate on the client, and the figures below start working.";

/**
 * Everything wrong with this burn that a reader needs told, in the order they
 * would meet it.
 *
 * An array rather than one sentence, the same arrangement the rollup keeps:
 * two things wrong are two things to fix, and running them together would make
 * one paragraph of two unrelated problems. Almost always empty.
 *
 * Gathered here rather than in the component because deciding what counts as a
 * problem is a rule about the data, and the panel's job is to set the type.
 */
export function burnProblems(summary: BurnSummary): string[] {
  const problems: string[] = [];
  if (!hasValuedBurn(summary)) problems.push(NO_RATE_TO_BURN_AT);
  return problems;
}
