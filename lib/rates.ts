import { costOfMinutes } from "@/lib/money";

/**
 * What an hour on a project is worth, and what the hours logged against it
 * have therefore cost.
 *
 * Two columns decide the first question and they are deliberately not one.
 * A client carries a default rate, because a rate is agreed with a client and
 * not renegotiated per engagement. A project carries an override, because the
 * rush job and the favour are both real and neither should move the client's
 * default. Resolving between them is three lines of code and the single most
 * repeated decision in the app: every burn figure, every projection, every
 * invoice line is this answer multiplied by some minutes.
 *
 * So it is written down once, here, as pure functions over plain numbers. The
 * resolution says *where* the rate came from as well as what it is, because a
 * page showing a figure has to be able to say whether the reader should go and
 * fix the project or the client — and because "no rate at all" and "a rate of
 * nothing" are different facts that both come out as zero.
 *
 * Nothing in this file reads a row, formats a string, or knows what a page
 * looks like. Minutes in, cents out, both whole numbers: the repo's two units,
 * and the conversion between them happens in exactly one place.
 */

/**
 * The part of a project a rate is read from: its override, or NULL for none.
 *
 * A structural subset rather than `Project` itself, the same choice
 * `lib/scope.ts` makes about deliverables — so these functions can be called
 * with a literal in a test, with a projected query result, and with a row
 * carried alongside its client. Resolving a rate does not need a name or a
 * status, and asking for them would make every caller build a row it has not
 * got.
 */
export type RateOverride = {
  /** Hourly rate override in cents. NULL defers to the client's default. */
  readonly rateCents: number | null;
};

/**
 * The part of a client a rate is read from: the default every one of their
 * projects bills at unless it says otherwise.
 *
 * Not nullable, because the column is not: a client with no rate holds zero
 * rather than NULL. That is exactly why the two shapes are separate types and
 * not one nullable number — the project's NULL means "ask the client" and the
 * client's zero means "nobody has said", and a single field could not carry
 * both.
 */
export type RateDefault = {
  /** Default billing rate in cents per hour. Zero means none was set. */
  readonly defaultRateCents: number;
};

/**
 * Where the rate a figure was worked out at came from.
 *
 * Carried beside the amount because the amount alone cannot be acted on. Two
 * projects can both burn at $150 an hour, one because somebody typed it on the
 * project and one because the client bills at it, and a reader who wants to
 * change the number has to go to a different form in each case. More
 * importantly, zero has two meanings: a project deliberately overridden to
 * nothing is not the same as a project nobody has set a rate for anywhere, and
 * a burn summary that said "$0.00 burned" for both would be hiding a missing
 * rate behind a figure that looks like a measurement.
 *
 * Order is resolution order: the project is asked first, the client second,
 * and `none` is what is left when neither answers.
 */
export const RATE_SOURCES = ["project", "client", "none"] as const;

export type RateSource = (typeof RATE_SOURCES)[number];

/**
 * A resolved rate: what an hour is worth, and which row said so.
 *
 * The pair travels together everywhere a rate does. Splitting them would mean
 * every caller that wants to explain a figure has to resolve the rate twice —
 * once for the number and once for the provenance — and the two calls would
 * eventually be made with different arguments.
 *
 * `cents` is cents per hour, the unit both columns are stored in, and it is
 * what it was read as rather than what it ought to be: a negative override is
 * reported as a negative rate. Repairing it here would mean a project billing
 * at a figure no form shows, and the one row that needs a person to look at it
 * would be the one row that looked fine.
 */
export type EffectiveRate = {
  /** Cents per hour. Zero when nothing anywhere set a rate. */
  readonly cents: number;
  /** Which row the amount came from. */
  readonly source: RateSource;
};

/**
 * The answer when no rate has been set anywhere: nothing an hour, from
 * nowhere.
 *
 * Frozen and shared rather than built per call, so a caller cannot mutate
 * the rate every unrated project in a list is holding. The readonly fields
 * say the same thing to the compiler; this says it to a page that got the
 * object through a boundary the types did not survive.
 */
export const UNRATED: EffectiveRate = Object.freeze({
  cents: 0,
  source: "none",
});

/**
 * The project's own answer about its rate, or null if it has not got one.
 *
 * Null for NULL, which is the whole reason the column is nullable: a project
 * with no override is not a project that bills at nothing, it is a project
 * that has not been asked. Returning a rate of zero here would be the single
 * most expensive bug available in this file — every engagement that had never
 * had a rate typed on it would burn nothing, for ever, silently.
 *
 * A zero override *is* an answer, and comes back as one: somebody opened the
 * form and said this project does not bill by the hour. The source says the
 * project said so, which is what lets a page print "overridden to nothing"
 * rather than "no rate set".
 */
export function projectRate(project: RateOverride): EffectiveRate | null {
  if (project.rateCents === null) return null;
  return { cents: project.rateCents, source: "project" };
}

/**
 * The client's answer about their default rate, or null if they have not got
 * one.
 *
 * Zero is read as "nobody has said" rather than as "this client bills at
 * nothing", which is the opposite of the reading a zero override gets a few
 * lines above. The asymmetry is in the schema and not in this file: the
 * project's column is nullable, so a project can say nothing and can say zero,
 * and the client's is a not-null zero default, so a client has no way to
 * distinguish the two. Zero is what every client row starts life holding, and
 * treating it as a decision would mean every client created before anyone
 * thought about rates had decided to work for free.
 *
 * It costs one thing, and it is worth naming: a client who genuinely does bill
 * at nothing cannot say so on their own row, and has to say it per project.
 * That is the right way round — the project override can express it, and
 * nothing silently resolves to a rate that nobody typed.
 *
 * A null client is accepted and answers null, for callers holding a project
 * read without its client — the edit form, a list that joined nothing. The
 * resolution then falls through to "none", which is honest about what is
 * known: the source says no rate was found, not that none exists.
 *
 * A default below zero is carried, like a negative override: nothing in the
 * app writes one, and a project burning backwards is the visible symptom that
 * sends somebody to the row.
 */
export function clientRate(client: RateDefault | null): EffectiveRate | null {
  if (client === null || client.defaultRateCents === 0) return null;
  return { cents: client.defaultRateCents, source: "client" };
}

/**
 * What a project's hours are actually worth: its override, else its client's
 * default, else nothing.
 *
 * The chain every burn figure in the app starts from, written as a chain —
 * the two rungs answer for themselves and this says only what order they are
 * asked in. A condition written out here instead would be a third opinion
 * about what a NULL and a zero mean, and the three would drift.
 *
 * `UNRATED` rather than a rate of zero built on the spot, so a project with no
 * rate anywhere is the same value wherever it is resolved. The figures that
 * come out of it are zero either way; the source is what a page needs, and it
 * says `none` rather than naming a row that did not answer.
 */
export function resolveRate(
  project: RateOverride,
  client: RateDefault | null,
): EffectiveRate {
  return projectRate(project) ?? clientRate(client) ?? UNRATED;
}

/**
 * Whether this rate can actually turn hours into money.
 *
 * Above zero, not merely non-zero. A rate of nothing produces a burn of
 * nothing however many hours go into it, which is a true figure and a useless
 * one: a page that showed "0% of the contract consumed" after a month of work
 * would be reporting a missing rate as good news. A rate below zero is worse
 * and is the same answer here — it bills, but backwards, and no figure built
 * on it should be presented as a measurement.
 *
 * Named rather than written out at each caller because the comparison is about
 * to be made by the burn summary, the health classifier and the projection,
 * and three places deciding separately whether zero counts is three places
 * that can disagree on the page at once.
 */
export function hasRate(rate: EffectiveRate): boolean {
  return rate.cents > 0;
}

/**
 * Whether this rate is below zero, which no form in the app can produce.
 *
 * `hasRate` already refuses it, but refusing is not the same as explaining:
 * the two reasons a rate cannot bill want different sentences and different
 * actions. "No rate is set for this project" is a form to go and fill in; "the
 * rate on this project is minus $150 an hour" is a row somebody has to repair,
 * and the figures beside it are not wrong so much as inverted.
 *
 * Kept as a question about the rate rather than about the source, because
 * either row can hold one and the sentence is the same in both cases — the
 * source then says which form to open.
 */
export function isNegativeRate(rate: EffectiveRate): boolean {
  return rate.cents < 0;
}

/**
 * What `minutes` of work came to at this rate, in whole cents — the burn.
 *
 * The conversion the whole phase is built on, and the only place in the app
 * where minutes become money. Through `costOfMinutes` rather than the division
 * written out again, so the rounding is the same arithmetic an invoice line
 * will use: an hour and a third at $150 is $200.00 here and $200.00 there, and
 * a burn figure that disagreed with the invoice it predicts would be worse
 * than no burn figure.
 *
 * The resolved rate rather than a loose number of cents, so a caller cannot
 * reach this function without having gone through the resolution — passing a
 * project's `rateCents` straight in is exactly the bug that bills an
 * inheriting project at nothing, and the types now refuse it.
 *
 * Both degenerate rates come out as something a reader can act on rather than
 * being refused. No rate burns nothing, which is why `hasRate` exists to be
 * asked first; a negative rate burns backwards, which is visible. Minutes
 * below zero — only reachable from a hand-edited row — likewise produce a
 * negative burn rather than being clamped, because a total that quietly
 * repaired its inputs would disagree with the list the reader is looking at.
 *
 * It takes minutes rather than a list of entries, and the caller has to total
 * them first: twenty minutes converted three times comes to a cent less than
 * the hour it is, and a summary built entry by entry would not match the same
 * hours billed as one line. Minutes are integers, so the total is exact — that
 * is the reason the unit is minutes, and converting once is how the reason
 * gets used.
 */
export function burnedCents(minutes: number, rate: EffectiveRate): number {
  return costOfMinutes(minutes, rate.cents);
}
