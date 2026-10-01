import type { ClientOption } from "@/lib/clients/options";
import type { NewProjectInput } from "@/lib/data/projects";
import type { Project } from "@/lib/db/schema";
import { optionalAmountCents } from "@/lib/forms/amount";
import { optionalCentsInput, zeroedCentsInput } from "@/lib/forms/cents";
import { requiredChoice } from "@/lib/forms/choice";
import { readFields } from "@/lib/forms/form-data";
import { overrideRateCents } from "@/lib/forms/rate";
import { collect, hasFieldError, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { requiredText } from "@/lib/forms/text";

/**
 * The project form, from submitted strings to something the data layer will
 * accept. Pure: it takes the fields and the clients on offer, never a request
 * or a database, so every validation branch is testable without either.
 *
 * The field names are the single source of truth — the inputs, the reader,
 * the validators, and the error keys all come from this list, so a renamed
 * input cannot quietly stop being validated.
 */

/**
 * In the order the form lays the fields out, which is also the order errors
 * are walked in: the cursor after a rejected submission has to land on the
 * first problem the user would read, not the first one declared here.
 *
 * The client comes first because it is the decision the rest of the form is
 * relative to — the rate override field is only meaningful once you know
 * whose default it would be overriding.
 *
 * Status is deliberately absent, and the data layer will not accept one in a
 * patch either. A project's status moves through a lifecycle with rules of its
 * own — a `<select>` here would let a closed project silently reopen. The
 * buttons on the project page are where it moves, through `transitionProject`.
 */
export const PROJECT_FIELD_NAMES = [
  "client",
  "name",
  "contractValue",
  "rateOverride",
] as const;

export type ProjectFieldName = (typeof PROJECT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type ProjectFormFields = Record<ProjectFieldName, string>;

/**
 * How long each field may be. Exported because the inputs carry the same
 * numbers as `maxLength`: two copies of "120" drift, and the day they do the
 * browser stops someone at a length the validator would have accepted, or
 * lets them type past one it rejects.
 */
export const PROJECT_FIELD_LIMITS = {
  /** A project name is a title, not a description. The same ceiling as a client's. */
  name: 120,
} as const;

export const EMPTY_PROJECT_FIELDS: ProjectFormFields = {
  client: "",
  name: "",
  contractValue: "",
  rateOverride: "",
};

export type ProjectFormState = FormState<ProjectFieldName>;

/**
 * What the form starts from. Defined here rather than in the action file
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_PROJECT_FORM_STATE: ProjectFormState =
  initialFormState(EMPTY_PROJECT_FIELDS);

export function readProjectFields(formData: FormData): ProjectFormFields {
  return readFields(formData, PROJECT_FIELD_NAMES);
}

/**
 * What the form yields once every field is good: exactly the columns a
 * project row is made of, which the data layer accepts whole as a new project
 * or as a patch to an existing one.
 */
export type ProjectFormValue = Pick<
  NewProjectInput,
  "clientId" | "name" | "contractValueCents" | "rateCents"
>;

/**
 * `clientIds` is the set the form actually offered. Validating against it
 * rather than against "some row exists" is what stops a submission naming a
 * client the picker never showed — and it means the id reaching the data
 * layer has already been proven to be one of them.
 */
export function parseProjectForm(
  fields: ProjectFormFields,
  clientIds: readonly string[],
): ParseResult<ProjectFormValue, ProjectFieldName> {
  const parsed = collect({
    client: requiredChoice(fields.client, clientIds, {
      label: "Client",
      // The likeliest cause is a page left open while the client was
      // archived, not a typo, so the message says what to do about it.
      unknown: "That client is not one you can pick. Choose another.",
    }),
    name: requiredText(fields.name, {
      label: "Name",
      max: PROJECT_FIELD_LIMITS.name,
    }),
    contractValue: optionalAmountCents(fields.contractValue),
    rateOverride: overrideRateCents(fields.rateOverride),
  });

  if (!parsed.ok) return parsed;

  const { client, name, contractValue, rateOverride } = parsed.value;
  return {
    ok: true,
    value: {
      clientId: client,
      name,
      contractValueCents: contractValue,
      // Null rather than absent, so an edit that clears the override writes
      // NULL instead of leaving the old figure in place: the data layer reads
      // an absent key as "do not touch this column".
      rateCents: rateOverride,
    },
  };
}

/**
 * An existing project as the fields that describe it. The edit form starts
 * from what is stored, and every value here is a string the validators accept
 * back unchanged — so opening a project and saving it untouched writes the
 * same row rather than quietly normalising it into something else.
 *
 * The two money fields both render absence as an empty box, but they mean
 * different things by it, which is why they go through different functions: a
 * contract value of zero is one nobody has agreed, and a rate override of zero
 * is one somebody chose.
 */
export function projectFormFields(project: Project): ProjectFormFields {
  return {
    client: project.clientId,
    name: project.name,
    contractValue: zeroedCentsInput(project.contractValueCents),
    rateOverride: optionalCentsInput(project.rateCents),
  };
}

/**
 * What the edit form starts from: the stored project, nothing wrong with it
 * yet. The new form's equivalent is `INITIAL_PROJECT_FORM_STATE` — a constant,
 * because a blank form is the same every time, and a function here because an
 * edit form is not.
 */
export function projectFormStateFor(project: Project): ProjectFormState {
  return initialFormState(projectFormFields(project));
}

/**
 * Which client the picker starts on.
 *
 * Normally that is whatever the form is holding: blank on a new project, the
 * stored client on an edit, the submitted one after a rejection. The exception
 * is somebody's first project, when there is exactly one client to file it
 * under — asking them to pick from a list of one is a click that cannot go
 * wrong and cannot go right either.
 *
 * A rejected picker is left alone. The reader has just been told to choose a
 * client, and filling the field in for them under that message would make the
 * message look wrong.
 */
export function preselectedClientId(
  state: ProjectFormState,
  clients: readonly ClientOption[],
): string {
  if (state.fields.client !== "") return state.fields.client;
  if (hasFieldError(state.errors, "client")) return "";
  return clients.length === 1 ? clients[0].id : "";
}

/**
 * What an edit actually changed, as a patch holding only those columns.
 *
 * The data layer treats an empty patch as a no-op, and says why: a form
 * submitted without a change should not bump `updatedAt` and reorder a list
 * sorted by it. A patch that always carries all four columns defeats that —
 * pressing Save on an untouched form would rewrite the row and jump the project
 * to the top of the list, claiming something happened when nothing did.
 *
 * Comparing values is safe here because the form round-trips: the fields
 * `projectFormFields` renders are strings the validators return unchanged, so a
 * field nobody touched parses back to the value already in the row rather than
 * to something merely equivalent.
 */
export function projectFormChanges(
  current: Project,
  value: ProjectFormValue,
): Partial<ProjectFormValue> {
  const changes: Partial<ProjectFormValue> = {};
  if (value.clientId !== current.clientId) changes.clientId = value.clientId;
  if (value.name !== current.name) changes.name = value.name;
  if (value.contractValueCents !== current.contractValueCents) {
    changes.contractValueCents = value.contractValueCents;
  }
  if (value.rateCents !== current.rateCents) changes.rateCents = value.rateCents;
  return changes;
}
