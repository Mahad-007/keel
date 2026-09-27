import { formatCents } from "@/lib/money";

/**
 * What a project was contracted for, or that nobody has said yet.
 *
 * Zero is the column's default, so it means "not filled in" far more often
 * than it means "agreed at nothing". Rendering it as `$0.00` states a number
 * the business never agreed to, and next to a real amount in the list it reads
 * as free work — so it says so in words instead, in a dimmer grey that keeps
 * the column of real figures scannable.
 *
 * Shared between the list and the project header so the two cannot end up
 * disagreeing about what an unset value looks like.
 */
export function ContractValue({ cents }: { cents: number }) {
  if (cents === 0) {
    return <span className="text-zinc-400 dark:text-zinc-600">Not set</span>;
  }
  return <>{formatCents(cents)}</>;
}
