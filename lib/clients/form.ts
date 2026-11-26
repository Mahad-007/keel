import type { NewClientInput } from "@/lib/data/clients";
import type { Client } from "@/lib/db/schema";
import { EMAIL_MAX_LENGTH, optionalEmail } from "@/lib/forms/email";
import { readFields } from "@/lib/forms/form-data";
import { zeroedCentsInput } from "@/lib/forms/cents";
import { optionalRateCents } from "@/lib/forms/rate";
import {
  BLANK_THRESHOLD_FIELDS,
  THRESHOLD_FIELD_NAMES,
  thresholdFieldResults,
  thresholdFormFields,
} from "@/lib/forms/threshold";
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
  // Last, because they are the only fields on this form that most clients
  // never need: a client with no thresholds set is judged by Keel's defaults,
  // which is the right answer until somebody has an opinion. A reader filling
  // in a new client reaches the name, the rate and the notes first.
  ...THRESHOLD_FIELD_NAMES,
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
  ...BLANK_THRESHOLD_FIELDS,
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
    // Five more results, keyed by the same names the inputs carry, so a bad
    // figure is reported under the box it was typed into. Spread rather than
    // listed one by one: the five validations are identical apart from their
    // bounds, and the bounds come off the spec.
    ...thresholdFieldResults(fields),
  });

  if (!parsed.ok) return parsed;

  // The thresholds travel in `rest` untouched: the parse keys them by setting,
  // which is what the data layer's input is keyed by, so a blank box reaches
  // `thresholdColumns` as the explicit null that clears the column. Absent
  // would leave the old figure in place, which is the one thing a form clearing
  // a setting must not do.
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
    defaultRate: zeroedCentsInput(client.defaultRateCents),
    notes: client.notes ?? "",
    // The five thresholds, each rendered as the figure somebody typed or as an
    // empty box meaning "use Keel's default". Spread from the row rather than
    // listed, so a setting added to the spec is prefilled here rather than
    // silently cleared by the next save of this form.
    ...thresholdFormFields(client),
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
