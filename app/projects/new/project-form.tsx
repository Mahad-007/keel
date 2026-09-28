"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import type { ClientOption } from "@/lib/clients/options";
import {
  INITIAL_PROJECT_FORM_STATE,
  PROJECT_FIELD_NAMES,
} from "@/lib/projects/form";
import { PROJECTS_PATH } from "@/lib/projects/query";

import { ProjectFields } from "../project-fields";
import { createProjectAction } from "./actions";

/**
 * The only interactive piece of the page, and it is client-side for one
 * reason: `useActionState` keeps the messages and the typed values from a
 * rejected submission without a round trip through the URL.
 *
 * Validation is the server's, not the browser's — `noValidate` turns off the
 * native bubbles so there is exactly one set of rules, the one that also runs
 * when the request arrives from somewhere other than this form.
 *
 * The options are handed in by the page rather than read here. What the picker
 * offers has to be the same set the action validates against, and the action
 * reads it for itself; a client component fetching its own list would be a
 * third answer to the same question.
 */
export function NewProjectForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction] = useActionState(
    createProjectAction,
    INITIAL_PROJECT_FORM_STATE,
  );

  useFirstErrorFocus(state, PROJECT_FIELD_NAMES);

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <FormSummary state={state} />
      <ProjectFields state={state} clients={clients} />

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">Save project</SubmitButton>
        <Link
          href={PROJECTS_PATH}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
