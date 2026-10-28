import { eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import { deliverables, projects } from "@/lib/db/schema";

import { requiredText } from "./fields";

/**
 * The checks a row makes about the project it claims to hang off.
 *
 * Two tables need them — a time entry and a running timer both name a project
 * and optionally one of that project's deliverables — and both need the same
 * two sentences for the two ways it can be wrong. The foreign keys promise
 * less than that: `project_id` promises the project exists, and
 * `deliverable_id` promises the deliverable exists *somewhere*, which is not
 * the same as on this engagement.
 *
 * Here rather than duplicated in each module, because the second copy is the
 * one that drifts: the day one of them stops comparing the deliverable's
 * project is the day time can be attributed across engagements, and the
 * rollups on both projects are wrong at once with nothing in the data saying
 * so.
 */

/**
 * The project's id if it exists, or a thrown error naming the id that was
 * passed.
 *
 * The foreign key would refuse the write anyway, and it would refuse it with a
 * message naming a column. Checking here means the caller gets the one thing
 * that says what went wrong, which is the id it asked for.
 */
export async function requireProject(
  id: string,
  database: Database,
  field: string,
): Promise<string> {
  const projectId = requiredText(id, field);
  const [row] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) throw new Error(`no project with id ${projectId}`);
  return row.id;
}

/**
 * Which project a deliverable belongs to, or null if there is no deliverable
 * with that id.
 *
 * One query, and the project is compared by the callers rather than put in the
 * WHERE clause, because the two failures are not the same kind of thing: a
 * deliverable that was deleted while a form sat open is news for whoever is
 * looking at the form, and one belonging to another engagement is a submission
 * nobody could have made from a page this app rendered.
 */
export async function deliverableProject(
  id: string,
  database: Database,
): Promise<string | null> {
  const [row] = await database
    .select({ projectId: deliverables.projectId })
    .from(deliverables)
    .where(eq(deliverables.id, id))
    .limit(1);
  return row?.projectId ?? null;
}

/**
 * Work attributed to another project's line would be counted against an
 * estimate on an engagement it was not worked for, so the rollup would be
 * wrong on both projects at once. The foreign key only promises the
 * deliverable exists somewhere, which is why this is checked here.
 *
 * One sentence in one place, because every write that attributes work —
 * creating an entry, re-attributing one, starting a timer — refuses the same
 * thing.
 */
export function foreignDeliverable(id: string, projectId: string): Error {
  return new Error(`deliverable ${id} does not belong to project ${projectId}`);
}

/**
 * The deliverable's id if it is one of that project's, or a thrown error
 * saying which of the two things was wrong.
 */
export async function requireProjectDeliverable(
  id: string,
  projectId: string,
  database: Database,
): Promise<string> {
  const owner = await deliverableProject(id, database);
  if (owner === null) throw new Error(`no deliverable with id ${id}`);
  if (owner !== projectId) throw foreignDeliverable(id, projectId);
  return id;
}
