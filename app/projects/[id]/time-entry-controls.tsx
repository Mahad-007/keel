import { editTimeButtonId, editTimeButtonLabel } from "@/lib/time/edit";
import { deleteTimeButtonId, deleteTimeButtonLabel } from "@/lib/time/remove";

import { RowButton } from "./row-button";

/**
 * What can be done to one logged stretch of work: open it for editing, or ask
 * about deleting it.
 *
 * No form, which is where this parts company with the scope list's controls.
 * A scope row carries presses that change the list — a move, a status — so its
 * buttons submit. Neither of these does: Edit unfolds the row into a form that
 * has its own, and Delete opens the step that asks, which has its own too. A
 * press that also submitted something would be a write nobody asked for.
 *
 * Both carry an id, because the cursor has to come back to whichever one was
 * pressed when the thing it opened closes — and by then the button is being
 * rendered again for the first time, so there is no ref to have kept.
 */
export function TimeEntryControls({
  id,
  name,
  onEdit,
  onDelete,
}: {
  id: string;
  /** The entry as the whole page names it — see `entryName`. */
  name: string;
  /** Open this entry for editing. Nothing is submitted and nothing written. */
  onEdit: () => void;
  /**
   * Ask about deleting this entry, which opens the step that explains what
   * would be lost. The press itself deletes nothing.
   */
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <RowButton
        id={editTimeButtonId(id)}
        onPress={onEdit}
        label={editTimeButtonLabel(name)}
      >
        Edit
      </RowButton>
      {/*
        Last, because it is the one press on the row that cannot be taken back —
        a reader tabbing along should not have to pass it to reach anything.
      */}
      <RowButton
        id={deleteTimeButtonId(id)}
        onPress={onDelete}
        label={deleteTimeButtonLabel(name)}
      >
        Delete
      </RowButton>
    </div>
  );
}
