import { and, asc, eq, max } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { deliverables, projects, type Deliverable } from "@/lib/db/schema";
import {
  moveOne,
  nextSortOrder,
  orderChanges,
  orderMismatch,
  type DeliverablePosition,
  type MoveDirection,
} from "@/lib/deliverables/order";
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
      const sortOrder = await endOfList(projectId, tx);
      const [row] = await tx
        .insert(deliverables)
        .values({
          id: newId("dlv"),
          projectId,
          title,
          description,
          estimatedMinutes,
          status,
          sortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    },
    { behavior: "immediate" },
  );
}

/** One deliverable by id, or null if there is no deliverable with that id. */
export async function getDeliverable(
  id: string,
  database: Database = db,
): Promise<Deliverable | null> {
  const [row] = await database
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * The order a scope list is always read in: the positions the two parties
 * agreed, with the id breaking ties.
 *
 * Ties should be impossible — the data layer keeps positions dense and
 * unique — but a hand-edited row can duplicate one, and a list that shuffles
 * between reloads is the worst way to find that out.
 */
const IN_ORDER = [asc(deliverables.sortOrder), asc(deliverables.id)] as const;

/**
 * One project's deliverables, in their agreed order.
 *
 * Scoped to a project rather than listing the table, because a scope list is
 * only ever read one project at a time — and the index covers both halves of
 * that query, so the list comes back without a sort.
 */
export async function listDeliverables(
  projectId: string,
  database: Database = db,
): Promise<Deliverable[]> {
  return database
    .select()
    .from(deliverables)
    .where(eq(deliverables.projectId, projectId))
    .orderBy(...IN_ORDER);
}

/**
 * Only the fields present are written, so a patch can touch one column.
 *
 * Two are deliberately missing. `projectId` is not an edit — moving a
 * deliverable to another engagement is deleting it from one scope and adding it
 * to another, and doing it as a patch would leave it holding a position in a
 * list it is no longer in. `sortOrder` has its own door for the same reason the
 * project's status does: a form saving a title must not be able to rearrange
 * the list behind it.
 */
export type DeliverablePatch = Partial<
  Omit<NewDeliverableInput, "projectId">
>;

/**
 * Applies the fields present in the patch and returns the updated row, or null
 * if there is no deliverable with that id.
 *
 * An empty patch is a no-op rather than a write, so a form submitted without a
 * change does not bump `updatedAt` and make an untouched deliverable look
 * edited — the same rule `updateProject` follows.
 */
export async function updateDeliverable(
  id: string,
  patch: DeliverablePatch,
  database: Database = db,
): Promise<Deliverable | null> {
  const values: Partial<typeof deliverables.$inferInsert> = {};
  if (patch.title !== undefined) {
    values.title = requiredText(patch.title, "deliverable title");
  }
  if (patch.description !== undefined) {
    values.description = optionalText(patch.description);
  }
  if (patch.estimatedMinutes !== undefined) {
    values.estimatedMinutes = wholeMinutes(
      patch.estimatedMinutes,
      "deliverable estimate",
    );
  }
  if (patch.status !== undefined) {
    values.status = parseDeliverableStatus(patch.status);
  }

  if (Object.keys(values).length === 0) return getDeliverable(id, database);

  values.updatedAt = new Date().toISOString();
  const [row] = await database
    .update(deliverables)
    .set(values)
    .where(eq(deliverables.id, id))
    .returning();
  return row ?? null;
}

/** The positions a project's deliverables hold now, in the order they hold. */
async function currentPositions(
  projectId: string,
  database: Database,
): Promise<DeliverablePosition[]> {
  return database
    .select({ id: deliverables.id, sortOrder: deliverables.sortOrder })
    .from(deliverables)
    .where(eq(deliverables.projectId, projectId))
    .orderBy(...IN_ORDER);
}

/**
 * Writes the positions that changed, one statement each.
 *
 * Deliberately not an `updatedAt` bump: a deliverable that moved down the list
 * was not edited, and a scope list where every row says it changed this morning
 * because somebody reordered it tells the reader nothing. The position is the
 * only column a move touches.
 */
async function writePositions(
  changes: readonly DeliverablePosition[],
  database: Database,
): Promise<void> {
  for (const { id, sortOrder } of changes) {
    await database
      .update(deliverables)
      .set({ sortOrder })
      .where(eq(deliverables.id, id));
  }
}

/**
 * Closes the gaps a delete leaves, so positions stay dense from zero.
 *
 * Nothing about reading the list needs it — the order is relative, and a list
 * numbered 0, 2, 3 reads the same as 0, 1, 2. It matters because `sortOrder` is
 * meant to *be* the position: the scope snapshots and templates later in the
 * roadmap copy an order between projects, and comparing "third in the list"
 * against a stored 4 is the kind of mismatch nobody finds until it is wrong in
 * front of a client.
 */
async function compactPositions(
  projectId: string,
  database: Database,
): Promise<void> {
  const remaining = await currentPositions(projectId, database);
  await writePositions(
    orderChanges(
      remaining,
      remaining.map((position) => position.id),
    ),
    database,
  );
}

/**
 * Removes the deliverable and returns it, or null if there was none with that
 * id.
 *
 * Deleted outright rather than archived: a deliverable that was really part of
 * the engagement and has been finished is `done`, and one that was dropped is a
 * scope change the Day 020 snapshots record. What is left is a line typed by
 * mistake, and keeping those in every scope list is how a list stops being read.
 *
 * Removing a row out of the middle of a list would leave a gap in the
 * positions, so the remaining deliverables are renumbered in the same
 * transaction. A delete that half happened is not something a scope list should
 * be able to show.
 */
export async function deleteDeliverable(
  id: string,
  database: Database = db,
): Promise<Deliverable | null> {
  return database.transaction(
    async (tx) => {
      const [row] = await tx
        .delete(deliverables)
        .where(eq(deliverables.id, id))
        .returning();
      if (!row) return null;

      await compactPositions(row.projectId, tx);
      return row;
    },
    { behavior: "immediate" },
  );
}

/**
 * Sets a project's scope order outright and returns the list as it now reads.
 *
 * `orderedIds` must name every one of the project's deliverables exactly once.
 * A reorder is a statement about the whole list, and `orderMismatch` explains
 * why a partial one cannot be applied; this throws on such a request because it
 * means the caller built the list wrong, which no amount of retyping fixes.
 *
 * Reading the current positions and writing the new ones is one immediate
 * transaction. A deferred one takes no write lock until the first update, so two
 * reorders arriving together would each decide what to write from the same
 * starting order and interleave into a list neither of them asked for.
 */
export async function reorderDeliverables(
  projectId: string,
  orderedIds: readonly string[],
  database: Database = db,
): Promise<Deliverable[]> {
  return database.transaction(
    async (tx) => {
      const current = await currentPositions(projectId, tx);
      const problem = orderMismatch(
        current.map((position) => position.id),
        orderedIds,
      );
      if (problem !== null) throw new Error(problem);

      await writePositions(orderChanges(current, orderedIds), tx);
      return listDeliverables(projectId, tx);
    },
    { behavior: "immediate" },
  );
}

/**
 * Moves one deliverable a single place up or down its project's list and
 * returns the list as it now reads, or null if there is no deliverable with
 * that id.
 *
 * Only the id is needed: which project's list it belongs to is a fact about the
 * row, not something a caller should have to pass and could get wrong. The
 * deliverable at the end of the list in the direction asked for stays where it
 * is — see `moveBy` for why that is an answer rather than an error.
 */
export async function moveDeliverable(
  id: string,
  direction: MoveDirection,
  database: Database = db,
): Promise<Deliverable[] | null> {
  return database.transaction(
    async (tx) => {
      const deliverable = await getDeliverable(id, tx);
      if (deliverable === null) return null;

      const current = await currentPositions(deliverable.projectId, tx);
      const desired = moveOne(
        current.map((position) => position.id),
        id,
        direction,
      );

      await writePositions(orderChanges(current, desired), tx);
      return listDeliverables(deliverable.projectId, tx);
    },
    { behavior: "immediate" },
  );
}

/**
 * Moves one deliverable from the status it is in to the next one, and hands
 * back the row as written — or null if it was not in that status, which
 * includes there being no such deliverable at all.
 *
 * `from` is not decoration. A status press is made against a list the reader
 * can see, and between the render and the press somebody else may have marked
 * the same line done. A plain write would overrule them silently; this one
 * cannot, because the status it expects is part of the WHERE clause. One
 * statement, so there is no window between checking and writing for the row to
 * change in — which is the whole reason this is not `updateDeliverable` with a
 * read in front of it.
 *
 * Null is deliberately ambiguous between "gone" and "already something else":
 * one statement cannot tell those apart, and the caller that wants to say which
 * reads the row for its message. Either way nothing was written.
 *
 * `updatedAt` moves, unlike a reorder. Starting a deliverable or marking it done
 * is a change to what the line says about the work, which is exactly what that
 * column is for.
 */
export async function setDeliverableStatus(
  id: string,
  from: DeliverableStatus,
  to: DeliverableStatus,
  database: Database = db,
): Promise<Deliverable | null> {
  const expected = parseDeliverableStatus(from);
  const next = parseDeliverableStatus(to);

  const [row] = await database
    .update(deliverables)
    .set({ status: next, updatedAt: new Date().toISOString() })
    .where(and(eq(deliverables.id, id), eq(deliverables.status, expected)))
    .returning();
  return row ?? null;
}
