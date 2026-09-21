"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  parseClientForm,
  readClientFields,
  type ClientFormState,
} from "@/lib/clients/form";
import { createClient } from "@/lib/data/clients";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";

/**
 * Creating a client. The action does four things and delegates all four:
 * read the fields, validate them, write the row, and leave. Everything it
 * decides on its own is error handling.
 *
 * On success it does not return — it redirects, so a refresh cannot resubmit
 * the form and create a second client.
 */
export async function createClientAction(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const fields = readClientFields(formData);

  const parsed = parseClientForm(fields);
  if (!parsed.ok) return rejectedFormState(fields, parsed.errors);

  try {
    await createClient(parsed.value);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("createClientAction: failed to write client", error);
    return failedFormState(
      fields,
      "Could not save the client. Nothing was written — try again.",
    );
  }

  // Outside the try: `redirect` signals by throwing, and catching it here
  // would turn a successful save into a "could not save" message.
  revalidatePath("/clients");
  redirect("/clients");
}
