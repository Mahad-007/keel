import { TextField } from "@/components/form";
import {
  SNAPSHOT_FIELD_SCOPE,
  SNAPSHOT_LABEL_LIMIT,
  type SnapshotFormState,
} from "@/lib/snapshots/form";

/**
 * The one thing a snapshot asks for: what this moment is.
 *
 * Optional, and the hint says so first, because the press is the point and a
 * reader who has to think of a name is a reader who closes the tab. The
 * examples are there to show the shape — a reason, not a date, because the
 * date is already recorded and repeating it in the label is the one thing that
 * makes the picker harder to read.
 */
export function SnapshotFields({ state }: { state: SnapshotFormState }) {
  return (
    <TextField
      name="label"
      label="What this moment is"
      hint="Optional. Something you will recognise later — “Signed proposal”, “Before the March change order”. The date is recorded either way."
      error={state.errors.label}
      defaultValue={state.fields.label}
      maxLength={SNAPSHOT_LABEL_LIMIT}
      scope={SNAPSHOT_FIELD_SCOPE}
    />
  );
}
