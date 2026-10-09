import { asc, count, eq, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  deliverableTemplateLines,
  deliverableTemplates,
  type DeliverableTemplate,
  type DeliverableTemplateLine,
  type Deliverable,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { negativeEstimateCount } from "@/lib/scope";
import { capturedTemplateLines } from "@/lib/templates/capture";
import type { TemplateLineDraft } from "@/lib/templates/capture";
import type { SummarisedTemplate } from "@/lib/templates/summary";

import { createDeliverable, listDeliverables } from "./deliverables";
import { optionalText, requiredText, wholeMinutes } from "./fields";
import { getProject } from "./projects";

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

/**
 * Why a project's scope list was not saved as a template.
 *
 * A code rather than a thrown error, and rather than a sentence: neither of
 * these is a bug — both are reachable from a page that was right when it
 * rendered — and the words belong to the form, which already has them for the
 * reader. Two spellings of "there is nothing to save" is how a data layer and
 * a page end up disagreeing about what happened.
 */
export type TemplateCaptureReason =
  | "no-such-project"
  | "empty-scope"
  | "negative-estimate";

/** The outcome of asking a project for a template. */
export type TemplateCaptureResult =
  | {
      readonly ok: true;
      readonly template: DeliverableTemplate;
      /** How many lines were captured, which is what the notice reports. */
      readonly lineCount: number;
    }
  | { readonly ok: false; readonly reason: TemplateCaptureReason };

/** What saving a template off a project asks the person for. */
export type TemplateCaptureInput = {
  name: string;
  description?: string | null;
};

/**
 * Saves a project's scope list as a template.
 *
 * Reading the deliverables and writing the template are one transaction, and
 * an immediate one. A deferred transaction takes no write lock until the first
 * insert, so a deliverable added between the read and the write would be
 * missing from a template that claims to be the project's scope — and the
 * reader would have no way to tell, because the count in the notice would
 * agree with the list that was read rather than the one on screen.
 *
 * Which columns cross over is `capturedTemplateLines`' decision, not this
 * function's. The status and the positions stay behind, so a template taken
 * off a half-finished project is still a description of work to be agreed.
 */
export async function saveTemplateFromProject(
  projectId: string,
  input: TemplateCaptureInput,
  database: Database = db,
): Promise<TemplateCaptureResult> {
  return database.transaction(
    async (tx) => {
      const project = await getProject(projectId, tx);
      if (project === null) return { ok: false, reason: "no-such-project" };

      const lines = capturedTemplateLines(
        await listDeliverables(projectId, tx),
      );
      // A template of nothing would sit in the picker offering to add nothing.
      // `createDeliverableTemplate` refuses one; this is the same refusal,
      // phrased as an answer rather than an exception, because an empty scope
      // list is a situation rather than a mistake.
      if (lines.length === 0) return { ok: false, reason: "empty-scope" };

      /*
        An estimate below zero is a row somebody wrote straight to the
        database — the form refuses one — and `createDeliverableTemplate`
        would throw on it from inside this transaction, which reaches the
        reader as "nothing was written, try again". Retrying cannot fix a bad
        row, so it is an answer rather than an exception: the scope panel is
        already flagging the line, and this says that is the thing to go and
        fix. One spelling of the rule, shared with the panel that flags it.
      */
      if (negativeEstimateCount(lines) > 0) {
        return { ok: false, reason: "negative-estimate" };
      }

      const template = await createDeliverableTemplate(
        { name: input.name, description: input.description, lines },
        tx,
      );
      return { ok: true, template, lineCount: lines.length };
    },
    { behavior: "immediate" },
  );
}

/**
 * Why a template was not applied to a project.
 *
 * Codes rather than sentences, for the reason `TemplateCaptureReason` gives:
 * every one of these is reachable from a page that was correct when it
 * rendered, and the words for a reader live with the form.
 */
export type TemplateApplyReason =
  | "no-such-project"
  | "no-such-template"
  | "empty-template"
  | "unusable-template";

/** The outcome of asking for a template to be added to a project's scope. */
export type TemplateApplyResult =
  | {
      readonly ok: true;
      readonly template: DeliverableTemplate;
      /** The rows written, in the order they now read on the project. */
      readonly deliverables: Deliverable[];
    }
  | { readonly ok: false; readonly reason: TemplateApplyReason };

/**
 * Adds a template's lines to the end of a project's scope list.
 *
 * Appended, never substituted: whatever was already agreed stays exactly where
 * it was. A template that replaced the list would delete the two lines
 * somebody had typed before reaching for it, and there is nowhere to put those
 * back from.
 *
 * Each line goes through `createDeliverable` rather than being inserted here.
 * That is the one door new scope comes through — it is what keeps positions
 * dense from zero, what defaults a new line to `pending`, and what validates
 * the fields — and a second insert path would be a second set of rules for the
 * same table to drift from. The cost is a few statements per line, which for a
 * template of eight is not worth a column of duplicated logic.
 *
 * One immediate transaction around the lot. Half a template is the one outcome
 * worth ruling out: a reader told four deliverables were added and looking at
 * two has no way to know which two are missing, and no way to ask for the rest
 * without getting duplicates of the four.
 */
export async function applyTemplateToProject(
  templateId: string,
  projectId: string,
  database: Database = db,
): Promise<TemplateApplyResult> {
  return database.transaction(
    async (tx) => {
      const project = await getProject(projectId, tx);
      if (project === null) return { ok: false, reason: "no-such-project" };

      const template = await getDeliverableTemplate(templateId, tx);
      if (template === null) return { ok: false, reason: "no-such-template" };

      const lines = await listTemplateLines(templateId, tx);
      // Nothing writes a lineless template, so this is a row that was put
      // there by hand. An apply that reported success and added nothing would
      // be worse than saying so.
      if (lines.length === 0) return { ok: false, reason: "empty-template" };

      /*
        Same guard as the capture, at the other end. A template line below zero
        is a hand-written row — nothing saves one — and `createDeliverable`
        would throw on it halfway through the loop below, which rolls the apply
        back and tells the reader to try again. The template is the thing that
        needs fixing, and the reader cannot see its lines from here, so the
        answer has to say so.
      */
      if (negativeEstimateCount(lines) > 0) {
        return { ok: false, reason: "unusable-template" };
      }

      const deliverables: Deliverable[] = [];
      for (const line of lines) {
        deliverables.push(
          await createDeliverable(
            {
              projectId,
              title: line.title,
              description: line.description,
              estimatedMinutes: line.estimatedMinutes,
            },
            tx,
          ),
        );
      }

      return { ok: true, template, deliverables };
    },
    { behavior: "immediate" },
  );
}
