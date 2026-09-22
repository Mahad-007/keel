"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  parseClientForm,
  readClientFields,
  type ClientFormState,
} from "@/lib/clients/form";
import { updateClient } from "@/lib/data/clients";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";

/**
 * Saving an edit. The same four steps as creating a client — read, validate,
 * write, leave — over a row that already exists.
 *
 * The id is bound by the page that rendered the form, not read out of the
 * submission. A hidden input naming the row to overwrite is a field the
 * browser will send back with whatever it is given, and "which client am I
 * editing" is not the submitter's to decide.
 */
export async function updateClientAction(
  id: string,
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const fields = readClientFields(formData);

  const parsed = parseClientForm(fields);
  if (!parsed.ok) return rejectedFormState(fields, parsed.errors);

  let saved;
  try {
    saved = await updateClient(id, parsed.value);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("updateClientAction: failed to save client", error);
    return failedFormState(
      fields,
      "Could not save the changes. Nothing was written — try again.",
    );
  }

  // The row was read to render the form and gone by the time it was
  // submitted. Rare, but it is not a field error and it is not a crash.
  if (saved === null) {
    return failedFormState(
      fields,
      "That client no longer exists. Nothing was saved.",
    );
  }

  // Back to whichever list the client is actually on. Sending an archived
  // client to `/clients` — the list that by definition excludes it — makes a
  // save that worked look like one that was thrown away.
  const list = saved.archivedAt === null ? "/clients" : "/clients/archived";

  // Outside the try: `redirect` signals by throwing, and catching it here
  // would turn a successful save into a "could not save" message.
  revalidatePath("/clients");
  revalidatePath("/clients/archived");
  revalidatePath(`/clients/${id}/edit`);
  redirect(list);
}
