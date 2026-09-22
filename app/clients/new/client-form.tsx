"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import {
  CLIENT_FIELD_NAMES,
  INITIAL_CLIENT_FORM_STATE,
} from "@/lib/clients/form";
import { firstErrorField } from "@/lib/forms/state";

import { ClientFields } from "../client-fields";
import { fieldId } from "../fields";
import { FormSummary } from "../form-summary";
import { SubmitButton } from "../submit-button";
import { createClientAction } from "./actions";

/**
 * The only interactive piece of the page, and it is client-side for one
 * reason: `useActionState` keeps the messages and the typed values from a
 * rejected submission without a round trip through the URL.
 *
 * Validation is the server's, not the browser's — `noValidate` turns off the
 * native bubbles so there is exactly one set of rules, the one that also runs
 * when the request arrives from somewhere other than this form.
 *
 * Every field asks for `autoComplete="off"`, the fields' default. These are
 * someone else's details, and what the browser has stored under `name`,
 * `organization` or `email` belongs to whoever is filling the form in, so an
 * autofill here is wrong by construction. Browsers honour `off` unevenly —
 * the point is not to invite the suggestion in the first place, which naming
 * the fields `organization` and `email` did.
 */
export function NewClientForm() {
  const [state, formAction] = useActionState(
    createClientAction,
    INITIAL_CLIENT_FORM_STATE,
  );

  // A rejected submission puts the cursor on the first field that needs
  // fixing. Without it the page looks unchanged from the keyboard: focus is
  // still on the save button, and the messages are wherever they are.
  useEffect(() => {
    const name = firstErrorField(state, CLIENT_FIELD_NAMES);
    if (name === null) return;
    document.getElementById(fieldId(name))?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <FormSummary state={state} />
      <ClientFields state={state} />

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">Save client</SubmitButton>
        <Link
          href="/clients"
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
