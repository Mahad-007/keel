import {
  estimatedHoursMoved,
  negativeEstimateCount,
  totalEstimatedMinutes,
} from "@/lib/scope";

import type { CapturedScopeLine, SnapshotLineDraft } from "./capture";

/**
 * Comparing a scope snapshot against the scope list as it reads now.
 *
 * The deliverables table only ever holds what is agreed today, which is why
 * "that was not in the original scope" is a conversation nobody can win: the
 * list has already been edited. A snapshot supplies the other side, and this
 * file is the arithmetic between them — every line added since, every line
 * dropped, every estimate and title that moved, and what the totals did.
 *
 * Pure functions over plain fields, like `lib/scope.ts`: no row is read here,
 * nothing is formatted, and nothing knows what a page looks like. The
 * sentences a reader sees are `lib/snapshots/describe.ts`.
 *
 * Two things are deliberately **not** compared:
 *
 *   - **Position.** A reorder is not a change to what was promised, only to
 *     the order it is read in — and positions move on their own, because
 *     deleting a line renumbers the ones after it. Reporting that would fill
 *     the table with rows nobody touched.
 *
 *     Which is right for a comparison and wrong for the capture, because a
 *     snapshot records the order. `hasChanges` is therefore not the whole
 *     test of whether a press would record anything new, and
 *     `sameRecordedOrder` is the rest of it — without that, a reordered scope
 *     list is refused as saying nothing, by this function's silence about the
 *     one field it does not read.
 *   - **Timestamps.** `updatedAt` moves when a line is edited, which is
 *     exactly what the field comparisons already say, and it moves on a line
 *     whose edit put the old value back.
 */

/**
 * What a comparison can say about one line of scope.
 *
 * Four kinds, and `changed` is the one the day exists for: a deliverable that
 * is in both lists under the same id but says something different now. The
 * other three are the ones a diff is usually assumed to be — gained, lost,
 * untouched.
 *
 * `unchanged` is a kind rather than an absence because the rows have to be
 * countable: "nine of twelve lines are exactly as agreed" is the sentence that
 * makes the other three readable, and a comparison that dropped them could
 * only say how many things were wrong.
 *
 * The order is the order they are worth reading in: what is new, what is gone,
 * what moved, what stood still. It is not the order the table renders in —
 * `scopeDiffEntries` keeps the live scope list's own order and appends the
 * dropped lines, because a comparison read beside the list above it has to
 * run the same way down the page.
 *
 * The list is here to be walked rather than read in order, which today means
 * one thing: `SCOPE_CHANGE_LABELS` is checked against it, so a kind added
 * without a word for a reader fails a test as well as the compiler. Nothing in
 * the summary iterates it — the counts are asked for one kind at a time — and
 * claiming otherwise, as this comment did, made the order sound load-bearing
 * where only the membership is.
 */
export const SCOPE_CHANGE_KINDS = [
  "added",
  "removed",
  "changed",
  "unchanged",
] as const;

export type ScopeChangeKind = (typeof SCOPE_CHANGE_KINDS)[number];

/**
 * One way a line of scope can read differently from the way it was captured.
 *
 * A union discriminated on the field, rather than a record with `before` and
 * `after` typed as "whatever either might be". An estimate's two sides are
 * numbers, a description's may be null, and a status is one of three words —
 * a sentence describing the move needs the right type of each, and a
 * `string | number | null` on both sides would make every describer check what
 * it had been handed.
 *
 * `estimate` rather than `estimatedMinutes`, because the field name is what a
 * reader sees it called. The minutes are the unit, not the name of the thing.
 */
export type ScopeFieldChange =
  | { readonly field: "title"; readonly before: string; readonly after: string }
  | {
      readonly field: "description";
      readonly before: string | null;
      readonly after: string | null;
    }
  | {
      readonly field: "estimate";
      readonly before: number;
      readonly after: number;
    }
  | {
      readonly field: "status";
      readonly before: string;
      readonly after: string;
    };

/**
 * The columns a pairing is compared on, from either side of it.
 *
 * A structural shape rather than the snapshot line or the deliverable, so one
 * comparison serves both directions and a test can pass four fields. The
 * stored snapshot row and a live deliverable both satisfy it, which is the
 * point: there is one set of rules for what counts as a difference.
 *
 * `status` is a plain string rather than `DeliverableStatus`. Both columns are
 * TEXT in SQLite, so a hand-edited row can hold a fourth value — and a
 * comparison that could not represent it would either crash or call two
 * unequal statuses equal.
 */
export type ComparableScopeLine = {
  title: string;
  description: string | null;
  estimatedMinutes: number;
  status: string;
};

/**
 * Every way one line reads differently from the way it was captured, in the
 * order they are worth reading.
 *
 * The title leads, because it names the line and a retitled deliverable has to
 * say so before anything else about it makes sense. The estimate next, because
 * it is the number every figure in the scope summary is built on. Then the
 * status, which is a fact about the work rather than about the promise. The
 * description last: a sharpened sentence is not a scope change in the way six
 * extra hours is, and a reader scanning for the hours should not have to read
 * past a paragraph to find them.
 *
 * Compared exactly, with nothing trimmed and nothing normalised. Both sides
 * came out of the same column through the same guards, so a difference in
 * whitespace is an edit somebody made rather than noise — and a comparison
 * that quietly trimmed would report "no change" on a line that does not match
 * what was captured.
 *
 * An empty list is the answer for a line that still reads exactly as it did,
 * which is what makes it the test for `unchanged`.
 */
export function scopeFieldChanges(
  before: ComparableScopeLine,
  after: ComparableScopeLine,
): ScopeFieldChange[] {
  const changes: ScopeFieldChange[] = [];

  if (before.title !== after.title) {
    changes.push({ field: "title", before: before.title, after: after.title });
  }
  if (before.estimatedMinutes !== after.estimatedMinutes) {
    changes.push({
      field: "estimate",
      before: before.estimatedMinutes,
      after: after.estimatedMinutes,
    });
  }
  if (before.status !== after.status) {
    changes.push({
      field: "status",
      before: before.status,
      after: after.status,
    });
  }
  if (before.description !== after.description) {
    changes.push({
      field: "description",
      before: before.description,
      after: after.description,
    });
  }

  return changes;
}

/**
 * One line of the comparison: a deliverable, and what happened to it.
 *
 * Both sides are carried rather than only the differences, because the table
 * shows them. A dropped line has to be nameable — "Migrate the old posts, six
 * hours, gone" — and the only place its title still exists is the snapshot;
 * an added one is only in the live list. Carrying both also means the row can
 * be rendered without the caller holding either list open beside it.
 *
 * The invariants, which the kind implies and nothing here enforces beyond
 * `scopeDiffEntries` producing them:
 *
 *   - `added`: `before` is null, `after` is the line, `changes` is empty.
 *   - `removed`: `after` is null, `before` is the line, `changes` is empty.
 *   - `changed`: both sides present, `changes` is not empty.
 *   - `unchanged`: both sides present, `changes` is empty.
 *
 * A flat shape rather than a four-way union on the kind. The table narrows on
 * the kind exactly once, to decide which column reads from which side, and a
 * union would make every other use — counting, filtering, keying a row —
 * narrow again for a field that is there in all four cases.
 */
export type ScopeDiffEntry = {
  /** The deliverable the two sides are paired on, present in every kind. */
  readonly deliverableId: string;
  readonly kind: ScopeChangeKind;
  /** The line as the snapshot recorded it, or null if it is new since. */
  readonly before: SnapshotLineDraft | null;
  /** The line as the scope list reads now, or null if it has been dropped. */
  readonly after: CapturedScopeLine | null;
  /** Field-by-field differences. Empty unless the kind is `changed`. */
  readonly changes: readonly ScopeFieldChange[];
};

/**
 * The two scope lists, paired up line by line.
 *
 * Paired on `deliverableId`, which is what makes this a diff rather than two
 * lists side by side: the same deliverable under a new title is one `changed`
 * row, where matching on titles would report a removal and an addition and
 * leave the reader to guess they were the same promise. The cost of that
 * choice is the opposite case — a line deleted and retyped is two rows, not
 * one edit — and that is the right way round, because the second one really
 * did happen twice.
 *
 * The order is the live scope list's own, with everything dropped since
 * appended after it. A removed line has no position in the current list, so
 * there is nowhere honest to interleave it; putting them last keeps the table
 * readable in the order the scope list is read in, and groups the rows a
 * reader is usually hunting for.
 *
 * A snapshot naming the same deliverable twice is a hand-written row — the
 * capture reads a primary key — and the first copy wins. The alternatives are
 * both worse: comparing against the last would make the answer depend on the
 * order rows came back in, and reporting both would put one deliverable in the
 * table twice under one id, which every count below would then double.
 */
export function scopeDiffEntries(
  before: readonly SnapshotLineDraft[],
  after: readonly CapturedScopeLine[],
): ScopeDiffEntry[] {
  const captured = new Map<string, SnapshotLineDraft>();
  for (const line of before) {
    if (!captured.has(line.deliverableId)) {
      captured.set(line.deliverableId, line);
    }
  }

  const entries: ScopeDiffEntry[] = [];
  const paired = new Set<string>();

  for (const line of after) {
    const was = captured.get(line.id);
    if (was === undefined) {
      entries.push({
        deliverableId: line.id,
        kind: "added",
        before: null,
        after: line,
        changes: [],
      });
      continue;
    }

    paired.add(line.id);
    const changes = scopeFieldChanges(was, line);
    entries.push({
      deliverableId: line.id,
      kind: changes.length === 0 ? "unchanged" : "changed",
      before: was,
      after: line,
      changes,
    });
  }

  // Over the map rather than the list, so a duplicated id is one removal
  // rather than two. A Map keeps insertion order, so these stay in the order
  // the snapshot recorded them.
  for (const [deliverableId, line] of captured) {
    if (paired.has(deliverableId)) continue;
    entries.push({
      deliverableId,
      kind: "removed",
      before: line,
      after: null,
      changes: [],
    });
  }

  return entries;
}

/**
 * What a whole comparison adds up to.
 *
 * The entries say what happened to each line; this says what happened to the
 * engagement. It is the part a reader looks at first and often the only part
 * they need: four hours of extra scope at the same price is a sentence, and
 * the table underneath is the working behind it.
 *
 * Both sides of every total are carried rather than only the difference. A
 * delta of six hours means one thing against an estimate of eight and another
 * against one of eight hundred, and a panel showing only the movement would
 * make the reader go and find the denominator.
 *
 * Every figure here is computed from the entries rather than from the two
 * lists, so all of them agree with the rows in the table by construction. A
 * hand-edited snapshot that names one deliverable twice is one row and is
 * counted once, which is the only way the counts and the table can be read
 * against each other.
 */
export type ScopeDiffSummary = {
  /** Lines in the scope list now that the snapshot had never heard of. */
  addedCount: number;
  /** Lines the snapshot recorded that are no longer in the scope list. */
  removedCount: number;
  /** Lines in both that read differently now. */
  changedCount: number;
  /** Lines in both that read exactly as they did. */
  unchangedCount: number;
  /** How many lines the snapshot held. */
  lineCountBefore: number;
  /** How many the scope list holds now. */
  lineCountAfter: number;
  /** What the snapshot was estimated at, in minutes. */
  estimatedMinutesBefore: number;
  /** What the scope list is estimated at now, in minutes. */
  estimatedMinutesAfter: number;
  /** The movement, in minutes. Negative when scope was given up. */
  estimatedMinutesDelta: number;
  /**
   * The same movement in hours, for reading.
   *
   * The difference between the two ends as they are rounded for reading,
   * rather than the movement in minutes rounded once — `estimatedHoursMoved`
   * says why. The sentence states all three figures, so the one in the middle
   * has to be the difference of the two beside it.
   */
  estimatedHoursDelta: number;
  /** What the project was agreed for when the snapshot was taken, in cents. */
  contractValueCentsBefore: number;
  /** What it is agreed for now, in cents. */
  contractValueCentsAfter: number;
  /** The movement, in cents. Negative when the price came down. */
  contractValueCentsDelta: number;
  /**
   * How many captured lines carried an estimate below zero, and how many do
   * now.
   *
   * Nothing in the app writes a negative estimate — the deliverable form
   * refuses one — but a snapshot records what it found, deliberately, so a row
   * somebody wrote straight to the database is copied rather than repaired.
   * The counts are here because the totals above cannot be asked: a line of
   * minus two hours against one of plus two leaves `estimatedMinutesBefore`
   * reading zero, which is indistinguishable from a scope list nobody had
   * sized and is the one state the sentences would describe wrongly.
   *
   * Counted per side, because the two sides are different lists at different
   * moments: a bad row can be captured and then fixed, or added since. Which
   * side holds it decides which half of the comparison a reader cannot trust.
   *
   * The same count, for the same reason, as `ScopeSummary`'s.
   */
  negativeEstimateCountBefore: number;
  negativeEstimateCountAfter: number;
  /**
   * Whether anything at all is different.
   *
   * Carried rather than left to a caller comparing four counts, because the
   * answer includes the contract value: a project whose scope is untouched and
   * whose price has moved has changed, and a page that only counted lines
   * would tell the reader nothing happened.
   */
  hasChanges: boolean;
};

/** How many entries of the comparison are of one kind. */
function countKind(
  entries: readonly ScopeDiffEntry[],
  kind: ScopeChangeKind,
): number {
  return entries.filter((entry) => entry.kind === kind).length;
}

/**
 * What the comparison adds up to, from the rows it produced.
 *
 * The totals go through `totalEstimatedMinutes` rather than a reduce written
 * out here, so a scope total in a diff is summed by the same function that
 * sums one in the scope panel. Two spellings of the same sum is how a panel
 * ends up reporting a change of six hours beside a list that moved by five.
 *
 * Nothing is clamped and nothing is repaired. An estimate below zero — a
 * hand-edited row — pulls the total down, and the delta says so, which is the
 * clearest signal available that the row needs looking at.
 */
export function summariseScopeDiff(
  entries: readonly ScopeDiffEntry[],
  contractValueCentsBefore: number,
  contractValueCentsAfter: number,
): ScopeDiffSummary {
  const captured = entries
    .map((entry) => entry.before)
    .filter((line): line is SnapshotLineDraft => line !== null);
  const current = entries
    .map((entry) => entry.after)
    .filter((line): line is CapturedScopeLine => line !== null);

  const estimatedMinutesBefore = totalEstimatedMinutes(captured);
  const estimatedMinutesAfter = totalEstimatedMinutes(current);
  const estimatedMinutesDelta = estimatedMinutesAfter - estimatedMinutesBefore;

  const addedCount = countKind(entries, "added");
  const removedCount = countKind(entries, "removed");
  const changedCount = countKind(entries, "changed");
  const contractValueCentsDelta =
    contractValueCentsAfter - contractValueCentsBefore;

  return {
    addedCount,
    removedCount,
    changedCount,
    unchangedCount: countKind(entries, "unchanged"),
    lineCountBefore: captured.length,
    lineCountAfter: current.length,
    estimatedMinutesBefore,
    estimatedMinutesAfter,
    estimatedMinutesDelta,
    estimatedHoursDelta: estimatedHoursMoved(
      estimatedMinutesBefore,
      estimatedMinutesAfter,
    ),
    contractValueCentsBefore,
    contractValueCentsAfter,
    contractValueCentsDelta,
    negativeEstimateCountBefore: negativeEstimateCount(captured),
    negativeEstimateCountAfter: negativeEstimateCount(current),
    hasChanges:
      addedCount + removedCount + changedCount > 0 ||
      contractValueCentsDelta !== 0,
  };
}

/**
 * The snapshot side of a comparison: the scope list as it was recorded, and
 * what the project was agreed for at that moment.
 *
 * The contract value travels with the lines rather than beside them, because
 * the two were true at the same instant and pairing them wrongly is the one
 * mistake that makes the whole comparison lie. Four positional arguments —
 * two lists and two amounts — is an invitation to hand over last month's price
 * with this month's scope.
 */
export type CapturedScope = {
  readonly lines: readonly SnapshotLineDraft[];
  readonly contractValueCents: number;
};

/** The other side: the scope list as it reads now, and the price now. */
export type CurrentScope = {
  readonly lines: readonly CapturedScopeLine[];
  readonly contractValueCents: number;
};

/**
 * Everything a scope comparison says: the rows, and what they add up to.
 *
 * One call for both, so the sentence at the top and the table underneath
 * cannot come from two different readings of the same lists.
 */
export type ScopeDiff = {
  readonly entries: readonly ScopeDiffEntry[];
  readonly summary: ScopeDiffSummary;
};

/**
 * What changed between a snapshot and the scope list as it reads now.
 *
 * The function the day exists for, and deliberately a thin one: the pairing is
 * `scopeDiffEntries`, the arithmetic is `summariseScopeDiff`, and both are
 * worth testing on their own. What this adds is that the summary is computed
 * from the entries it is handed back with — so a reader who finds the figures
 * disagreeing with the table has found a bug in one of those two functions
 * rather than a page that compared the lists twice.
 */
export function diffScope(
  before: CapturedScope,
  after: CurrentScope,
): ScopeDiff {
  const entries = scopeDiffEntries(before.lines, after.lines);
  return {
    entries,
    summary: summariseScopeDiff(
      entries,
      before.contractValueCents,
      after.contractValueCents,
    ),
  };
}

/**
 * Only the rows that moved, in the order the comparison produced them.
 *
 * The table shows these and not the untouched lines. A forty-line project with
 * two changes on it would otherwise be thirty-eight rows of "Unchanged" with
 * the two that matter somewhere in the middle, which is a table that hides
 * exactly what it was opened to show. How many were left out is in the summary
 * and gets a sentence of its own, so nothing is concealed — the full list is
 * the scope list, one tab-width away.
 *
 * A filter rather than a flag on the entry, so the comparison stays the whole
 * truth and the view is the thing that narrows.
 */
export function movedScopeLines(
  entries: readonly ScopeDiffEntry[],
): ScopeDiffEntry[] {
  return entries.filter((entry) => entry.kind !== "unchanged");
}
