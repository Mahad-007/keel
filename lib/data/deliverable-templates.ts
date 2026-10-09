import { asc, count, eq, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  deliverableTemplateLines,
  deliverableTemplates,
  type DeliverableTemplate,
  type DeliverableTemplateLine,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import type { TemplateLineDraft } from "@/lib/templates/capture";
import type { SummarisedTemplate } from "@/lib/templates/summary";

import { optionalText, requiredText, wholeMinutes } from "./fields";

/**
 * Data access for the two template tables: a saved scope list and the lines it
 * is made of.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a template row — the same shape as
 * `deliverables.ts`. Both tables live in one module because neither is useful
 * without the other: a template with no lines is not a template, and a line
 * with no template is nothing at all, so every write here touches both and
 * does it in one transaction.
 *
 * Positions are not among the fields a caller sets, for the same reason they
 * are not on a deliverable: the order is the list's, and this module numbers
 * the lines densely from zero as it writes them.
 */

export type NewDeliverableTemplateInput = {
  name: string;
  /** What the template is for. Blank and absent both store as NULL. */
  description?: string | null;
  /** The lines, in the order they are to be applied. At least one. */
  lines: readonly TemplateLineDraft[];
};

/**
 * The order a template's lines are always read in: the positions this module
 * wrote, with the id breaking ties.
 *
 * Ties should be impossible, but a hand-edited row can duplicate a position,
 * and a template that applies in a different order each time is the worst way
 * to find that out.
 */
const IN_ORDER = [
  asc(deliverableTemplateLines.sortOrder),
  asc(deliverableTemplateLines.id),
] as const;

/**
 * Writes a template and its lines, and hands back the template row.
 *
 * Everything checkable without a query is checked first, so a blank name or a
 * fractional estimate costs no round trip. The two inserts are one
 * transaction: a template row whose lines failed to write is a template that
 * looks applicable and adds nothing, which is worse than no template at all.
 *
 * A template with no lines is refused rather than stored. It is the one shape
 * of this table that can do nothing but disappoint — it would sit in the
 * picker offering to add nothing — and the caller that would have created one
 * is looking at an empty scope list, which is a sentence to show rather than a
 * row to write.
 */
export async function createDeliverableTemplate(
  input: NewDeliverableTemplateInput,
  database: Database = db,
): Promise<DeliverableTemplate> {
  const now = new Date().toISOString();
  const name = requiredText(input.name, "template name");
  const description = optionalText(input.description);

  if (input.lines.length === 0) {
    throw new Error("a template needs at least one deliverable on it");
  }

  const templateId = newId("tpl");
  const lines = input.lines.map((line, index) => ({
    // Its own prefix: an id in a log line should say whether it points at the
    // template or at one of its lines.
    id: newId("tln"),
    templateId,
    title: requiredText(line.title, "template line title"),
    description: optionalText(line.description),
    estimatedMinutes: wholeMinutes(
      line.estimatedMinutes,
      "template line estimate",
    ),
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }));

  return database.transaction(async (tx) => {
    const [template] = await tx
      .insert(deliverableTemplates)
      .values({ id: templateId, name, description, createdAt: now, updatedAt: now })
      .returning();
    await tx.insert(deliverableTemplateLines).values(lines);
    return template;
  });
}

/** One template by id, or null if there is no template with that id. */
export async function getDeliverableTemplate(
  id: string,
  database: Database = db,
): Promise<DeliverableTemplate | null> {
  const [row] = await database
    .select()
    .from(deliverableTemplates)
    .where(eq(deliverableTemplates.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * One template's lines, in the order they are to be applied.
 *
 * Scoped to a template rather than listing the table, because that is the only
 * way they are ever read — and the index covers both halves of the query, so
 * they come back without a sort.
 */
export async function listTemplateLines(
  templateId: string,
  database: Database = db,
): Promise<DeliverableTemplateLine[]> {
  return database
    .select()
    .from(deliverableTemplateLines)
    .where(eq(deliverableTemplateLines.templateId, templateId))
    .orderBy(...IN_ORDER);
}

/**
 * Every template, each with what it adds up to, ordered the way a person
 * reads a list: by name.
 *
 * One query with the counts done in SQL, rather than a list of templates
 * followed by a read of each one's lines. A picker with twelve templates on it
 * is one line of text per template, and reading sixty rows to render twelve
 * labels is the kind of thing that is invisible until the table is a year old.
 *
 * A left join, so a template with no lines still appears. Nothing writes one —
 * `createDeliverableTemplate` refuses — but an inner join would make such a
 * row vanish from every list in the app rather than show up as the `empty`
 * label the size words already have for it, and a row nothing can see is a row
 * nobody can fix.
 *
 * `lower(name)` for the same reason the client list uses it: a reader scanning
 * for "Website build" does not expect it filed after "retainer" because of a
 * capital letter. The id breaks ties, because two templates are allowed to
 * share a name and a list that reorders itself between reloads is a list
 * nobody trusts.
 */
export async function listDeliverableTemplates(
  database: Database = db,
): Promise<SummarisedTemplate[]> {
  return database
    .select({
      id: deliverableTemplates.id,
      name: deliverableTemplates.name,
      description: deliverableTemplates.description,
      lineCount: count(deliverableTemplateLines.id),
      // `coalesce` on both aggregates, because a left join with no match
      // sums over no rows at all and SQLite answers NULL — which would reach
      // the summary as a missing number rather than as a zero.
      estimatedMinutes: sql<number>`coalesce(sum(${deliverableTemplateLines.estimatedMinutes}), 0)`,
      unestimatedCount: sql<number>`coalesce(sum(case when ${deliverableTemplateLines.estimatedMinutes} = 0 then 1 else 0 end), 0)`,
    })
    .from(deliverableTemplates)
    .leftJoin(
      deliverableTemplateLines,
      eq(deliverableTemplateLines.templateId, deliverableTemplates.id),
    )
    .groupBy(deliverableTemplates.id)
    .orderBy(sql`lower(${deliverableTemplates.name})`, asc(deliverableTemplates.id));
}
