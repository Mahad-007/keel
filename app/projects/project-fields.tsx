import { SelectField, TextField } from "@/components/form";
import {
  describeArchivedOption,
  type ClientOption,
} from "@/lib/clients/options";
import {
  preselectedClientId,
  PROJECT_FIELD_LIMITS,
  type ProjectFormState,
} from "@/lib/projects/form";

/** What the picker always says, before anything unusual about the options. */
const CLIENT_HINT =
  "Who the work is for. Every project hangs off one client, and it bills at their default rate unless it overrides it below.";

/**
 * The four fields that describe a project, in the order the form lays them
 * out. Both the new and the edit form render exactly this set: a field added
 * to one page and forgotten on the other is the kind of difference nobody
 * notices until a project has been saved without its contract value.
 *
 * It takes the whole form state rather than four pairs of props because the
 * values and the messages always travel together — the state *is* what a field
 * needs to render itself.
 */
export function ProjectFields({
  state,
  clients,
}: {
  state: ProjectFormState;
  /** The clients this form may file the project under, already labelled. */
  clients: readonly ClientOption[];
}) {
  const archived = describeArchivedOption(clients);

  return (
    <>
      <SelectField
        name="client"
        label="Client"
        hint={archived === null ? CLIENT_HINT : `${CLIENT_HINT} ${archived}`}
        placeholder="Choose a client"
        options={clients.map((client) => ({
          value: client.id,
          label: client.label,
        }))}
        defaultValue={preselectedClientId(state, clients)}
        error={state.errors.client}
      />
      <TextField
        name="name"
        label="Name"
        hint="What the engagement is called. Required, and it is what you will pick the project out of a list by."
        maxLength={PROJECT_FIELD_LIMITS.name}
        defaultValue={state.fields.name}
        error={state.errors.name}
      />
      <TextField
        name="contractValue"
        label="Contract value"
        hint="The whole agreed value of the project, not a rate. Leave it blank until it is agreed."
        inputMode="decimal"
        placeholder="12000.00"
        defaultValue={state.fields.contractValue}
        error={state.errors.contractValue}
      />
      <TextField
        name="rateOverride"
        label="Rate override"
        hint="Per hour, for a project that does not bill at the client's default. Blank uses theirs; 0 says this project does not bill by the hour."
        inputMode="decimal"
        placeholder="180.00"
        defaultValue={state.fields.rateOverride}
        error={state.errors.rateOverride}
      />
    </>
  );
}
