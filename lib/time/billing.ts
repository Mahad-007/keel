/**
 * What invoicing a stretch of work stops it being, as pure rules.
 *
 * A time entry's `billedInvoiceId` is NULL until an invoice bills it. Once
 * set, the entry is no longer only a record of what happened — an invoice has
 * copied its minutes into a line somebody has been sent and may have paid, and
 * editing it afterwards makes that document wrong without touching it. These
 * are the rules that say so, kept out of the data layer so they can be read
 * and tested without a database, and so that Phase 6 has one place to extend
 * them rather than a condition buried in an UPDATE.
 */

/** The part of a time entry these rules read: whether an invoice has it. */
export type BillingSubject = {
  billedInvoiceId: string | null;
};

/** The part of a time entry that says whether it is meant to be charged for. */
export type ChargeableSubject = {
  billable: boolean;
};

/**
 * Whether this time is meant to be charged for.
 *
 * Strictly `=== true`, which is the same strictness `readsAsBillable` applies
 * to the checkbox and for the same reason: the column is an integer, so a
 * hand-written row can hold a 2, and anything that is not exactly true reads
 * as not chargeable.
 *
 * Strict in that direction on purpose. An hour wrongly left out of a billable
 * figure is still in the list, still unbilled, and still billable tomorrow; an
 * hour wrongly counted in is one somebody marked free and got charged for, on
 * a document a client has been sent.
 *
 * Written down once because three places read it — the marks on a row, the
 * chargeable half of a day's total, and the step that offers the checkbox
 * instead of a deletion — and a day's figures disagreeing with the mark beside
 * the row that produced them is the kind of inconsistency nobody can debug
 * from the screen.
 */
export function isChargeable(entry: ChargeableSubject): boolean {
  return entry.billable === true;
}

/**
 * Whether an invoice has billed this time.
 *
 * Any non-null value counts, blank included, which is deliberate: the write
 * that marks an entry billed does it with `billed_invoice_id IS NULL` in its
 * WHERE clause, so a row holding an empty string is already one that cannot be
 * billed again. Reading it as unbilled here would make the predicate disagree
 * with the only statement that acts on it, and the row would be editable while
 * refusing to be re-billed.
 */
export function isBilled(entry: BillingSubject): boolean {
  return entry.billedInvoiceId !== null;
}

/**
 * The columns an invoice reads a figure out of, and which a billed entry can
 * therefore no longer move.
 *
 * `minutes` is the amount charged. `billable` is whether it should have been
 * charged at all. `workedOn` decides which period the line falls in, which is
 * what a client checks a dated invoice against. `deliverableId` decides which
 * grouping it was billed under.
 *
 * None of this is about keeping the invoice itself right — Phase 6 copies what
 * it bills into line items of its own, so a document already sent does not
 * change when an entry does. It is about the charge staying checkable: an
 * invoice is defended by going back to the hours behind it, and that only
 * works while those hours still say what was charged for. An entry that has
 * been re-dated and re-attributed since answers a question nobody asked.
 *
 * One edit this cannot hold the line on: deleting the deliverable itself,
 * which nulls the attribution through the foreign key with nothing to stop it.
 * Refusing that would mean a line of scope can never be dropped once any of
 * its time is billed, and keeping the hours matters more than keeping the
 * grouping — see the `time_entries` comment in the schema, and `NOTES.md`.
 *
 * `note` is deliberately absent. It is the one column on a time entry that an
 * invoice does not compute anything from — correcting a typo in "Clled client
 * re: hosting" changes no figure on any document — and freezing it would mean
 * a reader who spots a mistake in their own description has to leave it there
 * for good.
 */
export const BILLED_COLUMNS = [
  "minutes",
  "workedOn",
  "billable",
  "deliverableId",
] as const;

/** One of the columns an invoice has copied a figure out of. */
export type BilledColumn = (typeof BILLED_COLUMNS)[number];

/**
 * A patch as these rules see it: which columns it names, not what it would
 * write to them.
 *
 * The values are `unknown` because nothing here reads one. A patch setting
 * `minutes` to the value the row already holds is still refused on a billed
 * entry — comparing would make the refusal depend on the row being read first,
 * and "it happened to be the same number" is not a reason to let a write
 * through a rule about invoices.
 */
export type BilledColumnPatch = Partial<Record<BilledColumn, unknown>>;

/**
 * Which of the billed columns a patch would move, in the order they are
 * declared.
 *
 * Present-and-undefined counts as absent, because that is what the data layer
 * means by it: a patch built from a form spreads the fields that were
 * submitted, and an explicitly undefined one is a field that was not.
 */
export function billedColumnsIn(patch: BilledColumnPatch): BilledColumn[] {
  return BILLED_COLUMNS.filter((column) => patch[column] !== undefined);
}

/**
 * Whether an invoice stands in the way of this edit.
 *
 * Two questions, and both have to be yes: the entry has been billed, and the
 * patch moves something the invoice copied. A billed entry whose note is being
 * corrected is not refused, and an unbilled entry is never refused however
 * much it moves.
 *
 * A boolean rather than a code, because the words for a reader belong with the
 * form that shows them and the data layer has its own set of refusals to
 * answer in. What this function owns is the rule, not the sentence.
 */
export function editRefusedByInvoice(
  entry: BillingSubject,
  patch: BilledColumnPatch,
): boolean {
  return isBilled(entry) && billedColumnsIn(patch).length > 0;
}
