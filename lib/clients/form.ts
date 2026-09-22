import type { NewClientInput } from "@/lib/data/clients";
import type { Client } from "@/lib/db/schema";
import { EMAIL_MAX_LENGTH, optionalEmail } from "@/lib/forms/email";
import { readFields } from "@/lib/forms/form-data";
import { optionalRateCents, rateInput } from "@/lib/forms/rate";
import { collect, type FieldErrors, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { optionalText, requiredText } from "@/lib/forms/text";

/**
 * The client form, from submitted strings to something the data layer will
 * accept. Pure: it takes the fields, never a request or a database, so every
 * validation branch is testable without either.
 *
 * The field names are the single source of truth — the inputs, the reader,
 * the validators, and the error keys all come from this list, so a renamed
 * input cannot quietly stop being validated.
 */

/**
 * In the order the form lays the fields out, which is also the order errors
 * are walked in: the cursor after a rejected submission has to land on the
 * first problem the user would read, not the first one declared here.
 */
export const CLIENT_FIELD_NAMES = [
  "name",
  "company",
  "email",
  "defaultRate",
  "notes",
] as const;

export type ClientFieldName = (typeof CLIENT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type ClientFormFields = Record<ClientFieldName, string>;

export type ClientFieldErrors = FieldErrors<ClientFieldName>;

/**
 * How long each field may be. Exported because the inputs carry the same
 * numbers as `maxLength`: two copies of "120" drift, and the day they do the
 * browser stops someone at a length the validator would have accepted, or
 * lets them type past one it rejects.
 */
export const CLIENT_FIELD_LIMITS = {
  /** Long enough for a real legal entity, short enough to fit a table cell. */
  name: 120,
  company: 120,
  email: EMAIL_MAX_LENGTH,
  notes: 2000,
} as const;

export const EMPTY_CLIENT_FIELDS: ClientFormFields = {
  name: "",
  company: "",
  email: "",
  defaultRate: "",
  notes: "",
};

export type ClientFormState = FormState<ClientFieldName>;

/**
 * What the form starts from. Defined here rather than in the action file
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_CLIENT_FORM_STATE: ClientFormState =
  initialFormState(EMPTY_CLIENT_FIELDS);

export function readClientFields(formData: FormData): ClientFormFields {
  return readFields(formData, CLIENT_FIELD_NAMES);
}

export function parseClientForm(
  fields: ClientFormFields,
): ParseResult<NewClientInput, ClientFieldName> {
  const parsed = collect({
    name: requiredText(fields.name, {
      label: "Name",
      max: CLIENT_FIELD_LIMITS.name,
    }),
    email: optionalEmail(fields.email),
    company: optionalText(fields.company, {
      label: "Company",
      max: CLIENT_FIELD_LIMITS.company,
    }),
    notes: optionalText(fields.notes, {
      label: "Notes",
      max: CLIENT_FIELD_LIMITS.notes,
    }),
    defaultRate: optionalRateCents(fields.defaultRate),
  });

  if (!parsed.ok) return parsed;

  const { defaultRate, ...rest } = parsed.value;
  return { ok: true, value: { ...rest, defaultRateCents: defaultRate } };
}

/**
 * An existing client as the fields that describe it. The edit form starts
 * from what is stored, and every value here is a string the validators accept
 * back unchanged — so opening a client and saving it untouched writes the same
 * row, rather than quietly normalising it into something else.
 *
 * A NULL column is a blank input, not the word "null": absence looks the same
 * on the way in as it does on the way out.
 */
export function clientFormFields(client: Client): ClientFormFields {
  return {
    name: client.name,
    company: client.company ?? "",
    email: client.email ?? "",
    defaultRate: rateInput(client.defaultRateCents),
    notes: client.notes ?? "",
  };
}

/**
 * What the edit form starts from: the stored client, nothing wrong with it
 * yet. The new form's equivalent is `INITIAL_CLIENT_FORM_STATE` — a constant,
 * because a blank form is the same every time, and a function here because an
 * edit form is not.
 */
export function clientFormStateFor(client: Client): ClientFormState {
  return initialFormState(clientFormFields(client));
}
