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
