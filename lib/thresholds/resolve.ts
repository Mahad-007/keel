import {
  THRESHOLD_KEYS,
  THRESHOLD_SETTINGS,
  type ThresholdKey,
} from "./settings";

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

/**
 * The figure a single row has to offer for one setting, or null if it has not
 * got one.
 *
 * One rung of the chain, and it exists so the two rungs are the same code
 * rather than two conditions written out in the resolution below. The rows are
 * symmetric here — unlike a rate, where a client's zero and a project's NULL
 * mean different things and the two rungs could not share an implementation —
 * so sharing it is what keeps the client's answer and the project's from
 * drifting apart.
 *
 * A null row answers null, for callers holding a project read without its
 * client: a list that joined nothing, a form that only has the one row. The
 * resolution then falls through to the default, which is honest — the figure
 * in force is the one the app would apply, and the source says it came from
 * nowhere in particular.
 *
 * Nothing is validated. A column outside its bounds is a row somebody
 * hand-edited, and it is reported by `thresholdProblems` rather than quietly
 * replaced with the default here: a project classified at a threshold no form
 * shows is exactly the thing a reader cannot debug.
 */
export function rowThreshold(
  key: ThresholdKey,
  row: ThresholdOverrides | null,
): number | null {
  if (row === null) return null;
  return row[key] ?? null;
}

/**
 * The threshold in force for one setting: the project's, else the client's,
 * else the default.
 *
 * The chain, written as a chain. A condition spelled out here instead would be
 * a second opinion about what an unset column means, and there would then be
 * five settings' worth of places for it to disagree with itself.
 *
 * The default comes from the spec rather than from an argument, because there
 * is exactly one default per setting and a caller free to supply its own would
 * be a caller free to classify a project at a figure no form could show.
 */
export function resolveThreshold(
  key: ThresholdKey,
  project: ThresholdOverrides | null,
  client: ThresholdOverrides | null,
): ResolvedThreshold {
  const own = rowThreshold(key, project);
  if (own !== null) return { value: own, source: "project" };

  const inherited = rowThreshold(key, client);
  if (inherited !== null) return { value: inherited, source: "client" };

  return { value: THRESHOLD_SETTINGS[key].fallback, source: "default" };
}

/**
 * Every threshold in force for one project, resolved in one pass.
 *
 * The call a page makes. The single-setting resolution stays exported because
 * it is the thing worth testing one at a time, but nothing that classifies a
 * project should be asking for one threshold: the verdict is reached from
 * three of them at once, and three separate resolutions are three chances to
 * pass a different pair of rows.
 *
 * Built by walking `THRESHOLD_KEYS`, so a sixth setting is resolved the day it
 * is added to the spec rather than the day somebody notices it was left out of
 * this function. The cast is the price of building a complete record in a
 * loop; the keys come from the same list the type is derived from, so every
 * key is filled exactly once.
 */
export function resolveThresholds(
  project: ThresholdOverrides | null,
  client: ThresholdOverrides | null,
): ResolvedThresholds {
  const resolved: Partial<Record<ThresholdKey, ResolvedThreshold>> = {};
  for (const key of THRESHOLD_KEYS) {
    resolved[key] = resolveThreshold(key, project, client);
  }
  return resolved as ResolvedThresholds;
}

/**
 * The thresholds in force when nothing anywhere has been configured.
 *
 * Every default, each saying it came from nowhere in particular. Frozen and
 * shared rather than rebuilt per call, the same arrangement `UNRATED` has, so
 * a caller cannot mutate the thresholds every unconfigured project in a list
 * is holding.
 *
 * It exists for the callers that genuinely have no rows to resolve from: a
 * pure function under test, a fixture, a figure worked out before the client
 * is known. Naming it is what keeps those callers from reaching for the spec
 * and assembling a second copy of the defaults by hand — which is the version
 * that would still say 80% the day the default moved.
 */
export const DEFAULT_THRESHOLDS: ResolvedThresholds = Object.freeze(
  resolveThresholds(null, null),
);

/**
 * A row with none of the five set: every column NULL.
 *
 * The shape a client or a project starts life in, named once. Its callers are
 * the places that have to produce a whole row rather than a patch — a test
 * fixture standing in for a stored client, a duplicate that deliberately
 * carries no settings over — and the alternative is five nulls written out at
 * each of them, which is five places to miss the sixth setting the day it is
 * added.
 *
 * Complete rather than partial, unlike `ThresholdOverrides` itself. A caller
 * that wants to say "nothing is set here" is usually filling in a row type
 * that demands every column, and `{}` would not satisfy it.
 *
 * Frozen, like the resolved defaults, because it is shared by every fixture
 * that spreads it: a caller that mutated it would move thresholds in tests it
 * has never heard of.
 */
export const NO_THRESHOLD_OVERRIDES: Required<ThresholdOverrides> =
  Object.freeze({
    nearlySpentPercent: null,
    aheadOfDeliveryPercent: null,
    farAheadOfDeliveryPercent: null,
    recentRateWindowDays: null,
    paceShiftPercent: null,
  });

/**
 * The five settings off a row, as a complete record with NULL for the ones it
 * has not got.
 *
 * For the callers that have to carry settings from one row to another —
 * duplicating a project, today — rather than resolve them. A copy that spelled
 * the five fields out itself would be a copy that silently drops the sixth
 * setting the day it is added, which is the quietest possible way to lose a
 * client's agreed tolerance.
 *
 * Complete rather than partial, so what comes out says something about every
 * setting: the copy is being told what the source held, including that it held
 * nothing. A partial result would leave a caller unable to tell "not set" from
 * "not read".
 *
 * Nothing is validated. A stored figure out of range is carried as it stands,
 * because the callers that ask this are deciding whether a row can be copied
 * at all and `hasUsableThresholds` is the question they ask next — repairing
 * it here would hand them a row that passed a check it should have failed.
 */
export function pickThresholdOverrides(
  row: ThresholdOverrides,
): Required<ThresholdOverrides> {
  const picked: Record<string, number | null> = {};
  for (const key of THRESHOLD_KEYS) {
    picked[key] = row[key] ?? null;
  }
  return picked as Required<ThresholdOverrides>;
}

/**
 * A row that carries both rungs of the chain at once: a project's own settings
 * and its client's, joined.
 *
 * The shape every page actually holds, and the same arrangement `JoinedRate`
 * makes for exactly the same reason — `getProjectWithClient` reads the client's
 * settings alongside the project's because a page that needed them separately
 * would be a second query for five integers.
 *
 * Structural, so it is satisfied by the join, by a projected query result, and
 * by a literal in a test.
 */
export type JoinedThresholds = ThresholdOverrides & {
  /** The client's settings, as the join carried them. */
  readonly clientThresholds: ThresholdOverrides;
};

/**
 * The thresholds in force for a project read together with its client.
 *
 * One line, and it exists so that line is written once. The failure mode of
 * spelling it out at each page is passing the project twice or forgetting the
 * client half — which resolves every setting to the app's default and judges an
 * engagement by figures its client explicitly did not agree to, silently, with
 * the banner reading like a measurement.
 */
export function resolveJoinedThresholds(
  row: JoinedThresholds,
): ResolvedThresholds {
  return resolveThresholds(row, row.clientThresholds);
}
