/**
 * The running clock: what it is, how long it has been going, and what it
 * becomes when it stops.
 *
 * Pure, like every other module in `lib/time/`. The row lives in
 * `active_timers` and the writes live in `lib/data/active-timers.ts`; the
 * arithmetic that turns an instant and a clock reading into whole minutes is
 * here, where it can be tested against a fixed `now` instead of against
 * whatever the machine running the tests thinks the time is.
 */

/**
 * The value the `slot` column always holds, and the reason the table can hold
 * at most one row: a unique index on a column with one possible value.
 *
 * It is a word rather than a number because a column of `1`s invites being
 * read as a count, and it is here rather than in the schema because the schema
 * imports its constants from `lib/` everywhere else. Phase 8 replaces the
 * default with the owner's id, at which point the index means "one timer per
 * user" and this constant goes away.
 */
export const RUNNING_TIMER_SLOT = "only";
