import { TextAreaField, TextField } from "@/components/form";
import { ThresholdFields } from "@/components/threshold-fields";
import { CLIENT_FIELD_LIMITS, type ClientFormState } from "@/lib/clients/form";

/**
 * The fields that describe a client, in the order the form lays them
 * out. Both the new and the edit form render exactly this set: a field added
 * to one page and forgotten on the other is the kind of difference nobody
 * notices until a client has been saved without their rate.
 *
 * It takes the whole form state rather than five pairs of props because the
 * values and the messages always travel together — the state *is* what a
 * field needs to render itself.
 */
export function ClientFields({ state }: { state: ClientFormState }) {
  return (
    <>
      <TextField
        name="name"
        label="Name"
        hint="The person or business you invoice. Required."
        maxLength={CLIENT_FIELD_LIMITS.name}
        defaultValue={state.fields.name}
        error={state.errors.name}
      />
      <TextField
        name="company"
        label="Company"
        hint="Optional, when the name above is a person."
        maxLength={CLIENT_FIELD_LIMITS.company}
        defaultValue={state.fields.company}
        error={state.errors.company}
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        maxLength={CLIENT_FIELD_LIMITS.email}
        defaultValue={state.fields.email}
        error={state.errors.email}
      />
      <TextField
        name="defaultRate"
        label="Default rate"
        hint="Per hour. Projects can override it; leave blank if you bill by the project."
        inputMode="decimal"
        placeholder="150.00"
        defaultValue={state.fields.defaultRate}
        error={state.errors.defaultRate}
      />
      <TextAreaField
        name="notes"
        label="Notes"
        hint="Anything you want in front of you when this client emails."
        rows={4}
        maxLength={CLIENT_FIELD_LIMITS.notes}
        defaultValue={state.fields.notes}
        error={state.errors.notes}
      />
      {/*
        Last, below a rule, because they are the only fields here most clients
        never need: a client with none of them set is judged by Keel's defaults,
        which is the right answer until somebody has agreed otherwise. The
        fields above are what a client *is*; these are what their work is
        measured against.
      */}
      <ThresholdFields
        fields={state.fields}
        errors={state.errors}
        inherits="default"
      />
    </>
  );
}
