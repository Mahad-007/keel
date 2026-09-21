"use client";

import { useActionState } from "react";

import { INITIAL_CLIENT_FORM_STATE } from "@/lib/clients/form";

import { createClientAction } from "./actions";
import { TextAreaField, TextField } from "./fields";
import { FormSummary } from "./form-summary";
import { SubmitButton } from "./submit-button";

/**
 * The only interactive piece of the page, and it is client-side for one
 * reason: `useActionState` keeps the messages and the typed values from a
 * rejected submission without a round trip through the URL.
 *
 * Validation is the server's, not the browser's — `noValidate` turns off the
 * native bubbles so there is exactly one set of rules, the one that also runs
 * when the request arrives from somewhere other than this form.
 */
export function NewClientForm() {
  const [state, formAction] = useActionState(
    createClientAction,
    INITIAL_CLIENT_FORM_STATE,
  );

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <FormSummary state={state} />
      <TextField
        name="name"
        label="Name"
        hint="The person or business you invoice. Required."
        autoComplete="organization"
        maxLength={120}
        defaultValue={state.fields.name}
        error={state.errors.name}
      />
      <TextField
        name="company"
        label="Company"
        hint="Optional, when the name above is a person."
        autoComplete="organization"
        maxLength={120}
        defaultValue={state.fields.company}
        error={state.errors.company}
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
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
        maxLength={2000}
        defaultValue={state.fields.notes}
        error={state.errors.notes}
      />

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">Save client</SubmitButton>
      </div>
    </form>
  );
}
