import type { ProjectStatus } from "@/lib/projects/status";

/**
 * Data access for the `projects` table. Plain async functions, one optional
 * database handle each, and nothing outside this file touches Drizzle for a
 * project row — the same shape as `clients.ts`.
 */

export type NewProjectInput = {
  /** The client the engagement belongs to. Must already exist. */
  clientId: string;
  name: string;
  /** Defaults to `draft`: a project exists before it is agreed to. */
  status?: ProjectStatus;
  /** The whole agreed value of the engagement, in whole cents. */
  contractValueCents?: number;
  /**
   * Hourly rate override in whole cents. `null` — the default — means "bill at
   * the client's rate", which is a different statement from a zero override.
   */
  rateCents?: number | null;
};

/**
 * Only the fields present are written, so a patch can touch one column. There
 * is deliberately no `startedAt` or `closedAt` here: both are derived from the
 * status the project moves to, not set by hand.
 */
export type ProjectPatch = Partial<NewProjectInput>;
