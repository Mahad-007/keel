import { eq, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  projectStatusEvents,
  type ProjectStatusEvent,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { parseProjectStatus, type ProjectStatus } from "@/lib/projects/status";

import { optionalText, requiredText } from "./fields";

/**
 * Data access for `project_status_events`, the trail of every status a project
 * has been in.
 *
 * There is no update and no delete, and that is the point rather than an
 * omission: a history that can be rewritten is not evidence of anything. Rows
 * leave only with the project they belong to, which the foreign key cascades.
 */

export type NewProjectStatusEventInput = {
  projectId: string;
  /** The status left behind. Null only for a project's opening event. */
  fromStatus: ProjectStatus | null;
  toStatus: ProjectStatus;
  /** Why, in whoever's words. Blank and absent both store as NULL. */
  reason?: string | null;
};

/**
 * Appends one row to the trail and hands it back.
 *
 * This writes what it is told: the guard deciding whether the move was allowed
 * lives in `lib/projects/transitions.ts`, and `transitionProject` is what
 * applies it before calling here. Keeping them apart is what lets a project
 * created directly as `closed` record an opening event that no transition rule
 * would permit as a move.
 */
export async function recordProjectStatusEvent(
  input: NewProjectStatusEventInput,
  database: Database = db,
): Promise<ProjectStatusEvent> {
  const projectId = requiredText(input.projectId, "status event project");
  const toStatus = parseProjectStatus(input.toStatus);
  const fromStatus =
    input.fromStatus === null ? null : parseProjectStatus(input.fromStatus);

  const [row] = await database
    .insert(projectStatusEvents)
    .values({
      id: newId("pse"),
      projectId,
      fromStatus,
      toStatus,
      reason: optionalText(input.reason),
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

/**
 * The order rows went in, read backwards. SQLite hands every row of a table
 * like this one an implicit `rowid` one higher than the last, so it is the
 * insertion order exactly — which for an append-only table is the order the
 * things happened in.
 *
 * `createdAt` is the obvious thing to sort by and the wrong one. It is
 * millisecond-precision, and two moves in the same millisecond tie on it; the
 * id does not break that tie either, since an id's leading characters are the
 * same millisecond and the rest is random. It is also the application's clock,
 * which can go backwards. The trail is the one table where "what order did
 * this happen in" must not be a guess.
 */
const NEWEST_FIRST = sql`${projectStatusEvents}.rowid desc`;

/**
 * One project's trail, newest first.
 *
 * Newest first because the question a reader brings to a project page is what
 * happened last — the reopening they are looking at the consequences of, not
 * the day it was set up.
 */
export async function listProjectStatusEvents(
  projectId: string,
  database: Database = db,
): Promise<ProjectStatusEvent[]> {
  return database
    .select()
    .from(projectStatusEvents)
    .where(eq(projectStatusEvents.projectId, projectId))
    .orderBy(NEWEST_FIRST);
}
