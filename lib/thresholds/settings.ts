import { PACE_SHIFT_THRESHOLD, RECENT_RATE_WINDOW_DAYS } from "@/lib/projection/rate";
import {
  AHEAD_OF_DELIVERY_GAP,
  FAR_AHEAD_OF_DELIVERY_GAP,
  NEARLY_SPENT_SHARE,
} from "@/lib/scope-creep";

import { PERCENT_WHOLE, percentFromShare } from "./scale";

/**
 * Every number in this app that is a judgement rather than a measurement, in
 * one list, with its default and the range it may be set to.
 *
 * Five of them, and each one arrived with a paragraph of reasoning attached to
 * a constant: four fifths of a contract is where the money stops being
 * comfortable, a quarter of it ahead of the delivery is where a gap stops
 * being recoverable, a fortnight is the shortest window that survives a week
 * off. Every one of those paragraphs is a claim about *an* engagement, and
 * none of them is a claim about all of them — a retainer and a fixed-price
 * build do not have the same tolerance, and a figure that is well chosen for
 * one is a flag that never fires or never stops for the other.
 *
 * So the figures move, and the reasoning stays where it is. The constants in
 * `lib/scope-creep.ts` and `lib/projection/rate.ts` keep their long comments
 * and become the defaults here rather than being replaced by them: this file
 * holds no second opinion about what the right number is, only about what may
 * be typed over it.
 *
 * A spec rather than five pairs of columns handled one at a time. The
 * resolution, the form, the validation, the sentence naming where a setting
 * came from and the row showing it are all the same code five times over, and
 * written five times over is five places a sixth setting has to be added and
 * four places it will be forgotten. Driven off this record, a new setting is
 * an entry here and two columns.
 */

/**
 * The settings, in the order a form lays them out: the two that classify the
 * money and the work first, because those are the ones a reader has met on a
 * banner, then the two the projection rests on.
 *
 * Named for the unit they are stored in rather than for the fraction the
 * arithmetic uses. The column holds 80 and the classifier compares 0.8, and a
 * key called `nearlySpentShare` sitting over a stored 80 is exactly the sort of
 * near-miss that gets handed to a comparison unconverted — which fires at
 * eighty times the contract and therefore never fires at all.
 */
export const THRESHOLD_KEYS = [
  "nearlySpentPercent",
  "aheadOfDeliveryPercent",
  "farAheadOfDeliveryPercent",
  "recentRateWindowDays",
  "paceShiftPercent",
] as const;

/** One configurable judgement. */
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];

/**
 * The unit a setting is typed and stored in.
 *
 * Two, and they are not interchangeable. A percent is a share of something —
 * of the contract, of the average pace — and is converted to a fraction before
 * any comparison is made with it. A count of days is already the unit the
 * arithmetic uses and is handed through untouched.
 *
 * Carried on the spec rather than inferred from the key's name, because the
 * form has to print the unit beside the box and the conversion has to know
 * whether to divide. Inferring either from a suffix would work until a setting
 * arrives whose name does not end the way the rule expects.
 */
export const THRESHOLD_UNITS = ["percent", "days"] as const;

export type ThresholdUnit = (typeof THRESHOLD_UNITS)[number];

/**
 * What a setting is called, what it does, what it defaults to, and how far it
 * may be moved.
 *
 * `label` is the form's label and the name used wherever a setting is shown in
 * a sentence, so the field somebody types in and the row explaining what is in
 * force are called the same thing.
 *
 * `hint` is the one line under the box. It says what the setting does to the
 * app rather than restating the label, because a reader looking at five
 * numbers needs to know which one is making the banner on their project say
 * what it says.
 *
 * `fallback` is the figure in force when nothing has been set anywhere, in the
 * stored unit. Every one of them is derived from the constant that documents
 * it, so this record cannot come to offer a default the classifier does not
 * apply.
 *
 * `min` and `max` bound what a person may type, inclusive at both ends. They
 * are not taste: outside them a setting makes some comparison in the app
 * unreachable, which is a flag that can never fire or one that never stops,
 * and either is worse than the default. Each entry says which.
 */
export type ThresholdSetting = {
  /** What the setting is called, in a form label and in a sentence. */
  readonly label: string;
  /** What it does, in one line, under the box. */
  readonly hint: string;
  /** The unit it is typed and stored in. */
  readonly unit: ThresholdUnit;
  /** The figure in force when nothing has been set, in the stored unit. */
  readonly fallback: number;
  /** The lowest value that may be stored, inclusive. */
  readonly min: number;
  /** The highest value that may be stored, inclusive. */
  readonly max: number;
};

/**
 * The five settings, their defaults, and the bounds outside which they would
 * break something.
 *
 * Every `fallback` is read from the constant that explains it rather than
 * written out again. That is the point of importing them: the paragraph
 * arguing for four fifths of a contract stays beside the comparison that
 * applies it, and this record cannot offer a default the classifier does not
 * use. A `percentFromShare` on each of the three shares is the whole of the
 * conversion, and `scale.test.ts` pins it.
 */
export const THRESHOLD_SETTINGS: Record<ThresholdKey, ThresholdSetting> = {
  /**
   * Bounded below at 1 and not 0: a nearly-spent threshold of nothing flags
   * every project from its first logged hour, and a banner that is always
   * amber is a banner nobody reads. Bounded above at the whole, because being
   * over the contract is not a setting — it is fixed at the whole price — and
   * a watch band opening past it would be a band no project could ever be in.
   */
  nearlySpentPercent: {
    label: "Contract nearly spent",
    hint: "The share of the contract value at which a project is flagged as worth watching.",
    unit: "percent",
    fallback: percentFromShare(NEARLY_SPENT_SHARE),
    min: 1,
    max: PERCENT_WHOLE,
  },
  /**
   * The gap, in points of the contract, not a share of the gap. Bounded above
   * at the whole because that is the largest gap a project within its contract
   * can show — all of the money, none of the work — and a threshold past it
   * would only be reachable by a project that had already overspent, which the
   * money axis has flagged anyway.
   */
  aheadOfDeliveryPercent: {
    label: "Burn ahead of delivery",
    hint: "How far the burn may run ahead of the delivered work before the project is flagged.",
    unit: "percent",
    fallback: percentFromShare(AHEAD_OF_DELIVERY_GAP),
    min: 1,
    max: PERCENT_WHOLE,
  },
  /**
   * The same measurement at the point it stops being recoverable. Nothing here
   * enforces that it sits above the setting above it — the two are resolved
   * separately, one may be inherited and the other overridden, and a form
   * cannot see both halves. `coherence.ts` is where a pair that crosses over is
   * reported.
   */
  farAheadOfDeliveryPercent: {
    label: "Burn far ahead of delivery",
    hint: "The gap at which the project is called over rather than merely watched.",
    unit: "percent",
    fallback: percentFromShare(FAR_AHEAD_OF_DELIVERY_GAP),
    min: 1,
    max: PERCENT_WHOLE,
  },
  /**
   * Bounded below at two days, because a pace measured over one day is that
   * day's burn and not a pace — the comparison it exists for is whether recent
   * weeks resemble the average, and a single day resembles nothing. Bounded
   * above at a quarter, which is where "recent" stops being true: a window
   * that long on a year-long engagement is most of the average it is being
   * compared against, so the two would always agree and the caveat would never
   * fire.
   */
  recentRateWindowDays: {
    label: "Recent pace window",
    hint: "How many days back the recent burn pace is measured over.",
    unit: "days",
    fallback: RECENT_RATE_WINDOW_DAYS,
    min: 2,
    max: 90,
  },
  /**
   * Bounded above one short of the whole, which is the last value at which
   * both halves of the comparison can still fire. The test is symmetric — a
   * ratio a quarter either side of one — so at the whole, "slower" would need
   * a pace of nothing or less, and a project that merely halved its pace would
   * be reported as steady.
   */
  paceShiftPercent: {
    label: "Pace change",
    hint: "How far the recent pace must part from the average before the projection says so.",
    unit: "percent",
    fallback: percentFromShare(PACE_SHIFT_THRESHOLD),
    min: 1,
    max: PERCENT_WHOLE - 1,
  },
};
