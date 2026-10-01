import type { Project } from "@/lib/db/schema";
import { INITIAL_TRANSITION_FORM_STATE } from "@/lib/projects/transition-form";
import { allowedTransitions } from "@/lib/projects/transitions";

import { StatusForm } from "./status-form";

/**
 * Where the status is changed, as opposed to where it is shown.
 *
 * It lives at the bottom of the overview rather than next to the badge in the
 * header for the reason the archive section lives at the bottom of the client
 * form: a control that changes what a project *is* should not be the first
 * thing a cursor lands on while someone is reading what it is.
 *
 * There is no "are you sure?" in front of any of it. Every move is reversible
 * except by another recorded move, the buttons say exactly what they do, and
 * the one that is genuinely hard to take back — reopening — is guarded by
 * having to write a sentence, which is a better confirmation than a dialogue
 * because it leaves something behind.
 */
export function StatusSection({ project }: { project: Project }) {
  const moves = allowedTransitions(project.status);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Change the status
      </h3>
      {moves.length === 0 ? (
        <NoMoves status={project.status} />
      ) : (
        <StatusForm
          projectId={project.id}
          status={project.status}
          initialState={INITIAL_TRANSITION_FORM_STATE}
        />
      )}
    </section>
  );
}

/**
 * The status column is plain TEXT in SQLite, so a hand-edited row can hold a
 * value the lifecycle has never heard of — and such a row has nowhere to go,
 * because every move is defined relative to a status that exists. Saying so
 * beats an empty space under a heading, which reads as a feature that failed
 * to load rather than a row that needs fixing.
 */
function NoMoves({ status }: { status: string }) {
  return (
    <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      This project is stored as &ldquo;{status}&rdquo;, which is not one of the
      four statuses a project moves between, so there is nothing it can be
      moved to. Put the row back to draft, active, paused or closed and the
      lifecycle picks up again.
    </p>
  );
}
