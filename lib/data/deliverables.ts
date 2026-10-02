import type { DeliverableStatus } from "@/lib/deliverables/status";

/**
 * Data access for the `deliverables` table: the lines a project's scope was
 * agreed as.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a deliverable row — the same shape as
 * `projects.ts`.
 *
 * Positions are not among the fields a caller sets. A deliverable is created
 * at the end of its project's list and moves only through `moveDeliverable`
 * or `reorderDeliverables`, which keep the list dense from zero. One door
 * means a saved edit cannot quietly rearrange somebody's scope.
 */

export type NewDeliverableInput = {
  /** The project whose scope this is part of. Must already exist. */
  projectId: string;
  title: string;
  /** The detail behind the title. Blank and absent both store as NULL. */
  description?: string | null;
  /**
   * The estimate in whole minutes. Zero — the default — means nobody has
   * estimated it yet, which the scope summaries flag rather than total as
   * nothing.
   */
  estimatedMinutes?: number;
  /** Defaults to `pending`: agreeing scope is not starting it. */
  status?: DeliverableStatus;
};
