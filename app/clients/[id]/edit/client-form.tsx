"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";

import { CLIENT_FIELD_NAMES, type ClientFormState } from "@/lib/clients/form";

import { ClientFields } from "../../client-fields";
import { FormSummary } from "../../form-summary";
import { SubmitButton } from "../../submit-button";
import { useFirstErrorFocus } from "../../use-first-error-focus";
import { updateClientAction } from "./actions";

/**
 * The same fields as the new-client form, started from the stored row instead
 * of from nothing. Client-side for the same reason: `useActionState` keeps a
 * rejected submission's messages and typed values without a round trip
 * through the URL, which on an edit form means without losing the edit.
 *
 * The client's id is bound to the action here rather than carried in a hidden
 * input. The form then has no field naming the row it overwrites, so there is
 * nothing to tamper with.
 */
export function EditClientForm({
  clientId,
  initialState,
  cancelHref,
}: {
  clientId: string;
  initialState: ClientFormState;
  /** The list this client is on — which is not `/clients` once it is archived. */
  cancelHref: string;
}) {
  const save = useMemo(
    () => updateClientAction.bind(null, clientId),
    [clientId],
  );
  const [state, formAction] = useActionState(save, initialState);

  useFirstErrorFocus(state, CLIENT_FIELD_NAMES);

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <FormSummary state={state} />
      <ClientFields state={state} />

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
