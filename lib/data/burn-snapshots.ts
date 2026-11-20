import type { BurnSnapshotOrigin } from "@/lib/burndown/origin";
import type { BurnPoint } from "@/lib/burndown/series";

/**
 * Data access for the `burn_snapshots` table: what each project had burned at
 * the end of each day.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a burn reading. The table is written
 * two ways and read one way, which is the shape of the whole milestone: a
 * reading taken for a day as it happens, a reconstruction of the days that
 * happened before the table existed, and a list of a project's readings in
 * date order for whatever wants to draw them.
 *
 * The arithmetic is not here. A reading is a `BurnPoint` — Day 032's burn
 * summary with a date on it — and this module stores one and reads one back,
 * so the figures a chart plots are the figures the overview panel would have
 * shown on the day. What this file owns is the columns: which of them the
 * point maps onto, and what happens when a day is recorded twice.
 */

/**
 * What writing a reading needs: which project, the reading, and whether it was
 * measured or reconstructed.
 *
 * The point carries the day along with the figures, because they are one
 * thing: a burn summary dated to the wrong day is not a reading of anything,
 * and a separate `onDate` argument is exactly how a backfill writing a hundred
 * days comes to write them all under one date.
 *
 * `origin` defaults to `recorded`, the stronger claim, which is safe only
 * because the one caller that cannot make it — the backfill — names its origin
 * explicitly. See `lib/burndown/origin.ts` for why that is the right way
 * round.
 */
export type NewBurnSnapshotInput = {
  /** The project this is a reading of. Must already exist. */
  readonly projectId: string;
  /** The day, and the burn as it stood at the end of it. */
  readonly point: BurnPoint;
  /** Whether the reading was measured on the day or reconstructed later. */
  readonly origin?: BurnSnapshotOrigin;
};
