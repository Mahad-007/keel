"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";

import {
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import type { ClientOption } from "@/lib/clients/options";
import { PROJECT_FIELD_NAMES, type ProjectFormState } from "@/lib/projects/form";

import { ProjectFields } from "../../project-fields";
import { updateProjectAction } from "./actions";

/**
 * The same fields as the new-project form, started from the stored row instead
 * of from nothing. Client-side for the same reason: `useActionState` keeps a
 * rejected submission's messages and typed values without a round trip through
 * the URL, which on an edit form means without losing the edit.
 *
 * The project's id is bound to the action here rather than carried in a hidden
 * input, so the form has no field naming the row it overwrites. Whether that
 * row is the submitter's to write is the action's question, not this
 * component's — see `updateProjectAction`.
 */
export function EditProjectForm({
  projectId,
  initialState,
  clients,
  cancelHref,
}: {
  projectId: string;
  initialState: ProjectFormState;
  clients: ClientOption[];
  /** The project's own page, which is where a save ends up too. */
  cancelHref: string;
}) {
  const save = useMemo(
    () => updateProjectAction.bind(null, projectId),
    [projectId],
  );
  const [state, formAction] = useActionState(save, initialState);

  useFirstErrorFocus(state, PROJECT_FIELD_NAMES);

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <FormSummary state={state} />
      <ProjectFields state={state} clients={clients} />

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
