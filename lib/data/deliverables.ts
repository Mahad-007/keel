import { eq, max } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { deliverables, projects, type Deliverable } from "@/lib/db/schema";
import { nextSortOrder } from "@/lib/deliverables/order";
import {
  DEFAULT_DELIVERABLE_STATUS,
  parseDeliverableStatus,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
import { newId } from "@/lib/id";

import { optionalText, requiredText, wholeMinutes } from "./fields";

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

/**
 * A deliverable without a project is not scope, and the foreign key would stop
 * one anyway — but it would stop it with a constraint error naming a column.
 * Checking here means the caller gets a message naming the id it passed, which
 * is the one thing that says what went wrong.
 */
async function requireProject(
  id: string,
  database: Database,
): Promise<string> {
  const projectId = requiredText(id, "deliverable project");
  const [row] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) throw new Error(`no project with id ${projectId}`);
  return row.id;
}

/**
 * The position at the end of a project's list, which is where new scope goes.
 *
 * `max()` rather than reading the rows: appending does not care what order the
 * list is in, only where it stops, and a project with forty deliverables
 * should not read forty rows to add the forty-first.
 */
async function endOfList(
  projectId: string,
  database: Database,
): Promise<number> {
  const [row] = await database
    .select({ highest: max(deliverables.sortOrder) })
    .from(deliverables)
    .where(eq(deliverables.projectId, projectId));
  return nextSortOrder(row?.highest ?? null);
}

/**
 * Writes one deliverable at the end of its project's list and hands back the
 * saved row.
 *
 * Everything that can be checked without a query is checked first, so the
 * common mistake — a blank title, a fractional estimate — costs no round trip,
 * and the project lookup only happens for a deliverable that is otherwise
 * valid.
 *
 * Finding the end of the list and inserting are one transaction, and an
 * immediate one: a deferred transaction takes no write lock until the insert,
 * so two deliverables added at once would both read the same highest position
 * and the second would land on top of the first. Two rows sharing a position
 * is the one thing a dense order must not allow, because the list then comes
 * back in whatever sequence SQLite feels like.
 */
export async function createDeliverable(
  input: NewDeliverableInput,
  database: Database = db,
): Promise<Deliverable> {
  const now = new Date().toISOString();
  const title = requiredText(input.title, "deliverable title");
  const description = optionalText(input.description);
  const estimatedMinutes = wholeMinutes(
    input.estimatedMinutes ?? 0,
    "deliverable estimate",
  );
  const status = parseDeliverableStatus(
    input.status ?? DEFAULT_DELIVERABLE_STATUS,
  );

  return database.transaction(
    async (tx) => {
      const projectId = await requireProject(input.projectId, tx);
      const [row] = await tx
        .insert(deliverables)
        .values({
          id: newId("dlv"),
          projectId,
          title,
          description,
          estimatedMinutes,
          status,
          sortOrder: await endOfList(projectId, tx),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    },
    { behavior: "immediate" },
  );
}
