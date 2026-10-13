import { asc, count, desc, eq, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  scopeSnapshotLines,
  scopeSnapshots,
  type ScopeSnapshot,
  type ScopeSnapshotLine,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import {
  capturedSnapshotLines,
  type SnapshotLineDraft,
} from "@/lib/snapshots/capture";
import { diffScope } from "@/lib/snapshots/diff";
import type { SummarisedSnapshot } from "@/lib/snapshots/summary";

import { listDeliverables } from "./deliverables";
import {
  isRecordableMinutes,
  isWholeCents,
  optionalText,
  recordedMinutes,
  requiredText,
  wholeCents,
} from "./fields";
import { getProject } from "./projects";

/**
 * Data access for the two snapshot tables: a project's scope as it stood at
 * one moment, and the lines it stood as.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a snapshot row — the same shape as
 * `deliverable-templates.ts`. Both tables live in one module because neither
 * is useful without the other: a snapshot with no lines records nothing, and a
 * line with no snapshot is dated to no moment at all, so every write here
 * touches both and does it in one transaction.
 *
 * Nothing here updates a row. A snapshot is a record of what was agreed, and a
 * record that can be brought into line with what is agreed now is worth
 * nothing — so there is no patch function, no `updatedAt`, and no door for one
 * to come in through later. The only writes are the capture itself.
 */

/**
 * What writing a snapshot needs: which project, what to call it, what the
 * project was agreed for at that moment, and the lines.
 *
 * `contractValueCents` is supplied rather than read off the project here, so
 * that the caller which read the scope list also supplies the price it was
 * read beside. The comparison is meaningless if the two come from different
 * instants, and a function that fetched the price itself would make that
 * mismatch invisible.
 */
export type NewScopeSnapshotInput = {
  /** The project whose scope this is a record of. Must already exist. */
  projectId: string;
  /** What the snapshot is, in a person's words. Blank and absent store NULL. */
  label?: string | null;
  /** What the project was agreed for at the captured moment, in cents. */
  contractValueCents: number;
  /** The lines, in the order they were agreed. At least one. */
  lines: readonly SnapshotLineDraft[];
};

/**
 * Writes a snapshot and its lines, and hands back the snapshot row.
 *
 * The two inserts are one transaction. A snapshot row whose lines failed to
 * write is worse than no snapshot at all: it would sit in the picker dated to
 * the right moment and compare as though every line of the project had been
 * added since.
 *
 * What is **not** checked here is the point of the function. A snapshot line's
 * title, description and status are written exactly as they were read, with no
 * trimming and no narrowing of the status — a deliverable's own columns were
 * guarded on the way in, so anything odd in them is a row somebody wrote by
 * hand, and that row is precisely what a record of the moment has to contain.
 * Repairing it here would make the comparison report a change the reader
 * cannot see, which is the one thing a diff must not do.
 *
 * The estimate goes through `recordedMinutes` rather than `wholeMinutes`: a
 * negative is recorded as it stands, and only a value too large to read back
 * is refused. The contract value keeps the ordinary `wholeCents` guard,
 * because it comes off the project column that has always had one.
 *
 * A snapshot with no lines is refused rather than stored, the same refusal
 * `createDeliverableTemplate` makes. It is the one shape of this table that
 * can say nothing: a comparison against it reports the whole scope list as
 * added, which is what the scope list already shows.
 */
export async function createScopeSnapshot(
  input: NewScopeSnapshotInput,
  database: Database = db,
): Promise<ScopeSnapshot> {
  const capturedAt = new Date().toISOString();
  const projectId = requiredText(input.projectId, "snapshot project");
  const label = optionalText(input.label);
  const contractValueCents = wholeCents(
    input.contractValueCents,
    "snapshot contract value",
  );

  if (input.lines.length === 0) {
    throw new Error("a scope snapshot needs at least one deliverable on it");
  }

  const snapshotId = newId("snp");
  const lines = input.lines.map((line, index) => ({
    // Its own prefix: an id in a log line should say whether it points at the
    // snapshot or at one of its lines.
    id: newId("sln"),
    snapshotId,
    deliverableId: line.deliverableId,
    title: line.title,
    description: line.description,
    estimatedMinutes: recordedMinutes(
      line.estimatedMinutes,
      "snapshot line estimate",
    ),
    status: line.status,
    sortOrder: index,
  }));

  return database.transaction(async (tx) => {
    const [snapshot] = await tx
      .insert(scopeSnapshots)
      .values({
        id: snapshotId,
        projectId,
        label,
        contractValueCents,
        capturedAt,
      })
      .returning();
    await tx.insert(scopeSnapshotLines).values(lines);
    return snapshot;
  });
}


/**
 * The order a snapshot's lines are always read in: the positions this module
 * wrote, with the id breaking ties.
 *
 * Ties should be impossible, but a hand-edited row can duplicate a position,
 * and a record of what was agreed that reads in a different order each time is
 * not much of a record.
 */
const IN_ORDER = [
  asc(scopeSnapshotLines.sortOrder),
  asc(scopeSnapshotLines.id),
] as const;

/** One snapshot by id, or null if there is no snapshot with that id. */
export async function getScopeSnapshot(
  id: string,
  database: Database = db,
): Promise<ScopeSnapshot | null> {
  const [row] = await database
    .select()
    .from(scopeSnapshots)
    .where(eq(scopeSnapshots.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * One snapshot's lines, in the order they were agreed.
 *
 * Scoped to a snapshot rather than listing the table, because that is the only
 * way they are ever read — and the index covers both halves of the query, so
 * they come back without a sort.
 */
export async function listSnapshotLines(
  snapshotId: string,
  database: Database = db,
): Promise<ScopeSnapshotLine[]> {
  return database
    .select()
    .from(scopeSnapshotLines)
    .where(eq(scopeSnapshotLines.snapshotId, snapshotId))
    .orderBy(...IN_ORDER);
}

/**
 * Every snapshot of one project, newest first, each with what its scope list
 * added up to.
 *
 * One query with the counts done in SQL, rather than a list of snapshots
 * followed by a read of each one's lines. A project with a snapshot per month
 * is one line of text per snapshot, and reading two hundred rows to render
 * twelve labels is the kind of thing that is invisible until the engagement is
 * a year old — the same arrangement, and the same reasoning, as the template
 * list.
 *
 * A left join, so a snapshot with no lines still appears. Nothing writes one —
 * `createScopeSnapshot` refuses — but an inner join would make such a row
 * vanish from the picker rather than show up as the `empty` label the size
 * words already have for it, and a row nobody can see is a row nobody can
 * delete.
 *
 * Newest first, which is the opposite of how the lines inside one are read.
 * The list is a history and the question asked of a history is "what has
 * happened lately": the snapshot a reader wants to compare against is almost
 * always the most recent, and that is what the default comparison uses. The id
 * breaks ties, because two snapshots can land in the same second — a
 * double-pressed button — and a picker that reorders itself between reloads is
 * a picker nobody trusts.
 */
export async function listScopeSnapshots(
  projectId: string,
  database: Database = db,
): Promise<SummarisedSnapshot[]> {
  return database
    .select({
      id: scopeSnapshots.id,
      label: scopeSnapshots.label,
      capturedAt: scopeSnapshots.capturedAt,
      contractValueCents: scopeSnapshots.contractValueCents,
      lineCount: count(scopeSnapshotLines.id),
      // `coalesce` on both aggregates, because a left join with no match sums
      // over no rows at all and SQLite answers NULL — which would reach the
      // picker as a missing number rather than as a zero.
      estimatedMinutes: sql<number>`coalesce(sum(${scopeSnapshotLines.estimatedMinutes}), 0)`,
      unestimatedCount: sql<number>`coalesce(sum(case when ${scopeSnapshotLines.estimatedMinutes} = 0 then 1 else 0 end), 0)`,
    })
    .from(scopeSnapshots)
    .leftJoin(
      scopeSnapshotLines,
      eq(scopeSnapshotLines.snapshotId, scopeSnapshots.id),
    )
    .where(eq(scopeSnapshots.projectId, projectId))
    .groupBy(scopeSnapshots.id)
    .orderBy(desc(scopeSnapshots.capturedAt), desc(scopeSnapshots.id));
}

/**
 * The most recent snapshot of one project, or null if it has never been
 * snapshotted.
 *
 * The whole row rather than the summarised shape the picker reads, because the
 * caller that wants it is the capture, and what it needs is the contract value
 * recorded beside those lines — a figure the aggregates do not carry.
 *
 * One row, ordered the same way `listScopeSnapshots` orders its list, so "the
 * most recent" means the same thing in both places. A limit rather than taking
 * the head of the list: this is asked inside the transaction that writes, and
 * reading a year of snapshots to look at one of them is not a cost a press
 * should pay.
 */
export async function latestScopeSnapshot(
  projectId: string,
  database: Database = db,
): Promise<ScopeSnapshot | null> {
  const [row] = await database
    .select()
    .from(scopeSnapshots)
    .where(eq(scopeSnapshots.projectId, projectId))
    .orderBy(desc(scopeSnapshots.capturedAt), desc(scopeSnapshots.id))
    .limit(1);
  return row ?? null;
}

/**
 * Why a project's scope was not snapshotted.
 *
 * Codes rather than sentences, for the reason `TemplateCaptureReason` gives:
 * every one of these is reachable from a page that was right when it rendered,
 * and the words for a reader live with the form that shows them.
 *
 * `unrecordable-scope` is the one that needs saying out loud. A snapshot
 * records a deliverable's estimate as it stands, negative included — the whole
 * point is that it copies rather than judges. What it cannot keep is a
 * fraction of a minute: the column is an integer and minutes are the unit, so
 * recording 90.5 would store a number that is not a duration. Nothing in the
 * app writes one, so this is a hand-edited row, and the fix is on the
 * deliverable rather than in another press of this button.
 *
 * An estimate too large to represent exactly is *not* this reason, and cannot
 * be: the driver refuses to decode such a value, so reading the deliverables
 * at all throws before anything here can classify it. That row poisons every
 * read of the scope list, not only this one, and there is nothing a snapshot
 * can usefully say about it.
 *
 * `unchanged-since` is the one that is not a fault at all. A snapshot of a
 * scope list that has not moved since the last one records nothing the last
 * one does not already say, and the comparison against either would read the
 * same — so the press is refused and the reader is told why. It is also what
 * bounds this table: a press can only add a row when something has actually
 * changed, so a held-down button writes one snapshot rather than a thousand
 * copies of one.
 *
 * `unrecordable-value` is the same fault on the project's own column: a
 * contract value the snapshot's `wholeCents` guard would refuse. Only that
 * column is asked about, not the rate override — a snapshot does not record a
 * rate, and refusing to record the scope over a column nobody is copying
 * would be a refusal the reader could make no sense of.
 */
export type SnapshotCaptureReason =
  | "no-such-project"
  | "empty-scope"
  | "unchanged-since"
  | "unrecordable-scope"
  | "unrecordable-value";

/** The outcome of asking a project for a snapshot of its scope. */
export type SnapshotCaptureResult =
  | {
      readonly ok: true;
      readonly snapshot: ScopeSnapshot;
      /** How many lines were recorded, which is what the notice reports. */
      readonly lineCount: number;
    }
  | { readonly ok: false; readonly reason: SnapshotCaptureReason };

/** What taking a snapshot asks the person for, which is only what to call it. */
export type SnapshotCaptureInput = {
  label?: string | null;
};

/**
 * Takes a snapshot of a project's scope as it stands, and of what the project
 * is agreed for.
 *
 * Reading the project, reading its deliverables and writing the snapshot are
 * one transaction, and an immediate one. A deferred transaction takes no write
 * lock until the first insert, so a deliverable added between the read and the
 * write would be missing from a record that claims to be the project's scope
 * at that moment — and nothing afterwards could tell, because the line count
 * in the notice would agree with the list that was read rather than the one on
 * screen. The comparison would then report the line as added since, dated to
 * the second before it was.
 *
 * The contract value comes off the project row read inside the same
 * transaction, which is the whole reason this function exists rather than the
 * page calling `createScopeSnapshot` with a value it is holding. The scope and
 * the price have to be true at the same instant or the comparison between two
 * snapshots says something that was never the case.
 *
 * Which columns cross over is `capturedSnapshotLines`' decision, not this
 * function's.
 */
export async function captureScopeSnapshot(
  projectId: string,
  input: SnapshotCaptureInput,
  database: Database = db,
): Promise<SnapshotCaptureResult> {
  return database.transaction(
    async (tx) => {
      const project = await getProject(projectId, tx);
      if (project === null) return { ok: false, reason: "no-such-project" };

      /*
        The project's own amount, asked before the scope is read. A contract
        value no column will take is a hand-edited row too, and the sentence
        for it points at the project rather than at a deliverable — which is
        why it is a reason of its own rather than one word covering both.
      */
      if (!isWholeCents(project.contractValueCents)) {
        return { ok: false, reason: "unrecordable-value" };
      }

      const scope = await listDeliverables(projectId, tx);
      const lines = capturedSnapshotLines(scope);
      /*
        A snapshot of nothing compares as though the whole scope list arrived
        afterwards, which is what the scope list already says. The refusal is
        phrased as an answer rather than an exception because an empty scope
        list is a situation rather than a mistake: the reader pressing the
        button is looking at one.
      */
      if (lines.length === 0) return { ok: false, reason: "empty-scope" };

      /*
        The one estimate a record cannot keep. `recordedMinutes` would throw on
        it from inside this transaction, which reaches the reader as "nothing
        was written, try again" — and retrying cannot fix a row somebody wrote
        by hand. Asked here, before anything is written, and answered.
      */
      if (!lines.every((line) => isRecordableMinutes(line.estimatedMinutes))) {
        return { ok: false, reason: "unrecordable-scope" };
      }

      /*
        Would this snapshot say anything the last one does not? The comparison
        is the one the page would show, run against the newest snapshot, so
        the answer cannot disagree with what the reader is looking at.

        Two reads rather than one, and only on a project that has been
        snapshotted before: the newest row for the price it recorded, and its
        lines for the scope. Inside the same transaction as everything else, so
        a snapshot taken in another tab a moment ago is one this press sees.
      */
      const newest = await latestScopeSnapshot(projectId, tx);
      if (newest !== null) {
        const previous = await listSnapshotLines(newest.id, tx);
        const since = diffScope(
          { lines: previous, contractValueCents: newest.contractValueCents },
          { lines: scope, contractValueCents: project.contractValueCents },
        );
        if (!since.summary.hasChanges) {
          return { ok: false, reason: "unchanged-since" };
        }
      }

      const snapshot = await createScopeSnapshot(
        {
          projectId: project.id,
          label: input.label,
          contractValueCents: project.contractValueCents,
          lines,
        },
        tx,
      );
      return { ok: true, snapshot, lineCount: lines.length };
    },
    { behavior: "immediate" },
  );
}
