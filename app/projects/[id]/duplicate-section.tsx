import {
  describeWhatIsCopied,
  DUPLICATE_LEAVES_BEHIND,
} from "@/lib/projects/duplicate";
import { initialDuplicateState } from "@/lib/projects/duplicate-form";

import { DuplicateForm } from "./duplicate-form";

/**
 * Where a project is copied from, at the foot of the overview.
 *
 * Below the status controls rather than beside the edit link in the header:
 * duplicating is the rarest thing anyone does on this page, and it is the one
 * press here that creates something. A control that makes a second project
 * should not sit where a cursor lands while somebody is reading the first.
 *
 * Two sentences above the form rather than a tooltip or nothing at all,
 * because "duplicate" is a word every product means something slightly
 * different by. The question a reader actually has is whether the copy brings
 * the history with it, and the answer — it does not — is the whole design of
 * the feature. Saying it here costs two lines and saves a reader opening the
 * copy to find out.
 */
export function DuplicateSection({
  projectName,
  deliverableCount,
  duplicate,
}: {
  /** What the name box suggests calling the copy. */
  projectName: string;
  /**
   * How many deliverables would come over. Taken as a count rather than the
   * rows: this section shows no deliverable, and handing it the list would
   * invite it to.
   */
  deliverableCount: number;
  duplicate: Parameters<typeof DuplicateForm>[0]["duplicate"];
}) {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Duplicate this project
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {describeWhatIsCopied(deliverableCount)}
      </p>
      <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {DUPLICATE_LEAVES_BEHIND}
      </p>
      <DuplicateForm
        duplicate={duplicate}
        initialState={initialDuplicateState(projectName)}
      />
    </section>
  );
}
