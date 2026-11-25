import type { ThresholdKey } from "./settings";

/**
 * Which figure is actually in force for a project, and which row said so.
 *
 * The same shape of question `lib/rates.ts` answers about a rate, and
 * deliberately the same answer: ask the project, then its client, then fall
 * back to the figure with the reasoning attached. A threshold is agreed with a
 * client — a retainer and a fixed-price build have different tolerances, and
 * the tolerance belongs to the engagement rather than to the week — and
 * overridden on a project, because the one job that is a favour does not move
 * everything else the client has.
 *
 * Written once, here, because five settings times two rows times every page
 * that reads a verdict is a lot of places to re-derive a chain. The chain
 * itself is one line; what is worth having written down is *which* chain, and
 * that the answer carries where it came from.
 *
 * Provenance travels with the value for the reason it does with a rate: the
 * number alone cannot be acted on. Two projects can both be flagged at 70% of
 * their contract, one because somebody typed it on the project and one because
 * the client is set that way, and a reader who wants to change it has a
 * different form to open in each case. A resolved figure that could not say
 * which row produced it would send half of them to the wrong page.
 */

/**
 * The thresholds set on one row: any of the five, or none of them.
 *
 * Partial, and absent means the same thing as NULL. A client row and a project
 * row both hold five nullable columns, so the shape a query produces satisfies
 * this with every key present and most of them null — and a test or a form can
 * write the one setting it is about. Nothing downstream can tell the two apart,
 * which is the point: "not set here" has exactly one meaning and two
 * spellings.
 *
 * Zero is not one of those spellings, unlike a rate — where a project's zero
 * override is a decision to bill nothing and a client's zero is a column
 * nobody has filled in. Every setting here is bounded at one or above, because
 * a threshold of nothing flags every project or no project at all, so zero is
 * refused at the form and at the column rather than given a meaning.
 */
export type ThresholdOverrides = {
  readonly [K in ThresholdKey]?: number | null;
};

/**
 * Where a threshold in force came from.
 *
 * Order is resolution order: the project is asked first, the client second,
 * and `default` is the figure this repo ships when neither answers. Three
 * rather than the rate's three-with-`none`, because the last rung is a real
 * number and not an absence — there is always a threshold in force, which is
 * the difference between a judgement and a measurement. A project with no rate
 * cannot be valued at all; a project with no configured thresholds is
 * classified by the defaults, and the banner says so.
 */
export const THRESHOLD_SOURCES = ["project", "client", "default"] as const;

export type ThresholdSource = (typeof THRESHOLD_SOURCES)[number];

/**
 * One threshold in force: the figure, in its stored unit, and the row it came
 * from.
 *
 * The pair travels together wherever a threshold does, for the reason
 * `EffectiveRate` does: splitting them means every caller that wants to
 * explain a setting resolves it twice, and the two calls are eventually made
 * with different arguments.
 *
 * `value` is in the unit the column holds — whole percent, or days — and not
 * the fraction the classifiers compare. The conversion happens at the one
 * boundary that needs it, so a resolved threshold can be printed beside the
 * box somebody typed it into without being multiplied back up.
 */
export type ResolvedThreshold = {
  /** The figure in force, in the setting's stored unit. */
  readonly value: number;
  /** Which row produced it. */
  readonly source: ThresholdSource;
};

/** Every threshold in force for one project, keyed by setting. */
export type ResolvedThresholds = Readonly<
  Record<ThresholdKey, ResolvedThreshold>
>;
