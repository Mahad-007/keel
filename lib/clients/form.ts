import type { NewClientInput } from "@/lib/data/clients";
import { optionalEmail } from "@/lib/forms/email";
import { readFields } from "@/lib/forms/form-data";
import { optionalRateCents } from "@/lib/forms/rate";
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

export const CLIENT_FIELD_NAMES = [
  "name",
  "email",
  "company",
  "notes",
  "defaultRate",
] as const;

export type ClientFieldName = (typeof CLIENT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type ClientFormFields = Record<ClientFieldName, string>;

export type ClientFieldErrors = FieldErrors<ClientFieldName>;

/** Long enough for a real legal entity, short enough to fit a table cell. */
const NAME_MAX = 120;
const COMPANY_MAX = 120;
const NOTES_MAX = 2000;

export const EMPTY_CLIENT_FIELDS: ClientFormFields = {
  name: "",
  email: "",
  company: "",
  notes: "",
  defaultRate: "",
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
    name: requiredText(fields.name, { label: "Name", max: NAME_MAX }),
    email: optionalEmail(fields.email),
    company: optionalText(fields.company, { label: "Company", max: COMPANY_MAX }),
    notes: optionalText(fields.notes, { label: "Notes", max: NOTES_MAX }),
    defaultRate: optionalRateCents(fields.defaultRate),
  });

  if (!parsed.ok) return parsed;

  const { defaultRate, ...rest } = parsed.value;
  return { ok: true, value: { ...rest, defaultRateCents: defaultRate } };
}
