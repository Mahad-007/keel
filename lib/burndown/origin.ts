/**
 * Where a stored burn reading came from: a day that was measured, or a day
 * that was reconstructed afterwards.
 *
 * The distinction is the honest part of this milestone. A reading taken on the
 * day it describes was taken against the contract value and the rate as they
 * stood that morning, which is exactly why the figures are stored rather than
 * recomputed — a burn-down worked out from today's rate would rewrite every
 * point behind it the moment somebody corrected a typo in the hourly figure.
 *
 * A reconstructed reading cannot make that claim. The backfill knows how many
 * minutes were logged on each past day, because the entries carry the day they
 * were worked on, and it knows nothing whatever about what the project was
 * agreed for in March — no column anywhere recorded it. So it values those
 * minutes at today's rate against today's price and says so on the row, and a
 * chart can mark the stretch of history that is a reconstruction rather than a
 * measurement.
 *
 * Two values and no third. "Corrected" or "amended" would be a fourth column's
 * worth of meaning in a word — the questions a reader asks of a point are what
 * it says and whether it was there at the time, and anything else belongs to
 * the row that changed it.
 */
export const BURN_SNAPSHOT_ORIGINS = ["recorded", "backfilled"] as const;

export type BurnSnapshotOrigin = (typeof BURN_SNAPSHOT_ORIGINS)[number];

/**
 * What a reading is unless somebody says otherwise: measured, on the day.
 *
 * The default is the stronger claim, which is the right way round only because
 * the one path that cannot make it — the backfill — is the one path that names
 * its origin explicitly. Defaulting to `backfilled` would caveat every honest
 * point in the table to protect the few that need it.
 */
export const DEFAULT_BURN_SNAPSHOT_ORIGIN: BurnSnapshotOrigin = "recorded";
