/**
 * The chargeable filter on a time log: all time, only what will be charged
 * for, or only what will not.
 *
 * The flag is the one column on a time entry that changes what the hour is
 * worth, so it is the one a reader filters on constantly — "what is going on
 * this invoice" and "what am I giving away" are the two questions, and they
 * are the same list narrowed two different ways.
 *
 * A filter is a value rather than the absence of one, for the reason
 * `lib/projects/filter.ts` gives: the unfiltered option is what a link has to
 * be able to point at to clear the filter, and what a tab row has to be able
 * to mark as current.
 */

/** No filter at all: chargeable and not, together. */
export const ALL_TIME = "all";

/** Only time meant to be charged for. */
export const CHARGEABLE_TIME = "chargeable";

/** Only time that will not reach an invoice. */
export const FREE_TIME = "free";

export type BillableFilter =
  | typeof ALL_TIME
  | typeof CHARGEABLE_TIME
  | typeof FREE_TIME;

/**
 * Unfiltered first, then the two halves. The order a tab row renders in, and
 * it puts the option that shows everything where a reader looks for the way
 * back out of a filter.
 */
export const BILLABLE_FILTERS = [
  ALL_TIME,
  CHARGEABLE_TIME,
  FREE_TIME,
] as const satisfies readonly BillableFilter[];

/** What a log with no `?billable=` param means: every entry. */
export const DEFAULT_BILLABLE_FILTER: BillableFilter = ALL_TIME;
