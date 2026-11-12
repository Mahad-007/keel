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
