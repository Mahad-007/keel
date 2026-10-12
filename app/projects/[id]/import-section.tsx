import { INITIAL_IMPORT_STATE } from "@/lib/deliverables/import-form";

import { BulkImportForm } from "./bulk-import-form";

/**
 * The import control, on the scope tab under the add line.
 *
 * Under it rather than above, because adding one line is what most visits to
 * this tab are for and this is the once-per-engagement control. Above the
 * templates, because a paste is where a scope list usually comes from the
 * first time — the template is for the second engagement of the same shape,
 * and by then the reader knows where to look.
 *
 * It explains where the lines land before the box is read, because that is the
 * question a reader has with a paste in the clipboard and a list already on
 * screen: nothing here replaces what was agreed, and anything the import gets
 * slightly wrong is an ordinary deliverable to edit afterwards.
 */
export function ImportSection({
  importScope,
  scopeIsEmpty,
}: {
  importScope: Parameters<typeof BulkImportForm>[0]["importScope"];
  /**
   * Whether anything has been agreed yet, which changes what a paste is for:
   * starting the list, or adding to it. Taken as a flag rather than the rows,
   * because this section shows no deliverable and handing it the list would
   * invite it to.
   */
  scopeIsEmpty: boolean;
}) {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Import a pasted list
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {scopeIsEmpty
          ? "Scope is usually agreed somewhere else first — an email, a proposal, a spreadsheet. Paste that list here and it becomes this project's deliverables, one per line."
          : "Paste a list and its lines are added to the end of this scope list, one deliverable per line. Nothing already agreed is changed."}{" "}
        Every line arrives pending, and nothing is written until you have seen
        the preview and pressed Import.
      </p>
      <BulkImportForm
        importScope={importScope}
        initialState={INITIAL_IMPORT_STATE}
      />
    </section>
  );
}
