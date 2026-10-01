"use client";

import { useActionState } from "react";

import {
  FieldError,
  fieldErrorId,
  FormSummary,
  SubmitButton,
  TextAreaField,
  useFirstErrorFocus,
} from "@/components/form";
import type { ProjectStatus } from "@/lib/projects/status";
import {
  TRANSITION_FIELD_NAMES,
  transitionNotePrompt,
  type TransitionFormState,
} from "@/lib/projects/transition-form";
import {
  allowedTransitions,
  TRANSITION_REASON_LIMIT,
  transitionVerb,
} from "@/lib/projects/transitions";

import { transitionProjectAction } from "./actions";

/**
 * The moves a project can make, as the buttons that make them.
 *
 * One form with a button per move, rather than a form per button: the reason
 * box belongs to whichever move is pressed, and two forms could not share it.
 * It is a client component for the same reason the project form is —
 * `useActionState` keeps a rejected submission's message and the sentence that
 * was typed into the box, which is the whole point of demanding one.
 *
 * Closing is drawn as the secondary button wherever it sits beside something
 * else. It is the move that stops the clock and the one nobody should press by
 * aiming at the other.
 */
export function StatusForm({
  projectId,
  status,
  initialState,
}: {
  projectId: string;
  /** The status as last read from the database, which decides the buttons. */
  status: ProjectStatus;
  initialState: TransitionFormState;
}) {
  // The id is fixed for as long as this page is mounted, so the binding is
  // just the action with its first argument already supplied.
  const move = transitionProjectAction.bind(null, projectId);
  const [state, formAction] = useActionState(move, initialState);

  useFirstErrorFocus(state, TRANSITION_FIELD_NAMES);

  const moves = allowedTransitions(status);
  const note = transitionNotePrompt(status);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <TextAreaField
        name="reason"
        label={note.label}
        hint={note.hint}
        error={state.errors.reason}
        defaultValue={state.fields.reason}
        rows={note.required ? 3 : 2}
        maxLength={TRANSITION_REASON_LIMIT}
      />
      <div className="flex flex-wrap items-center gap-2">
        {moves.map((to) => (
          <SubmitButton
            key={to}
            name="status"
            value={to}
            variant={
              to === "closed" && moves.length > 1 ? "secondary" : "primary"
            }
            pendingLabel="Saving…"
          >
            {transitionVerb(status, to) ?? to}
          </SubmitButton>
        ))}
      </div>
      {state.errors.status === undefined ? null : (
        <FieldError id={fieldErrorId("status")}>
          {state.errors.status}
        </FieldError>
      )}
    </form>
  );
}
