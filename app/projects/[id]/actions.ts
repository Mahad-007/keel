"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getProject, transitionProject } from "@/lib/data/projects";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";
import { projectPath } from "@/lib/projects/detail";
import { PROJECTS_PATH } from "@/lib/projects/query";
import {
  parseTransitionForm,
  readTransitionFields,
  type TransitionFormState,
} from "@/lib/projects/transition-form";

/**
 * Moving a project through its lifecycle.
 *
 * The guard runs three times on the way through, and each run is doing a
 * different job. The page only renders buttons for moves the project can make;
 * this action checks the submission against the project as it stands, so it
 * can put a message beside the right field; and `transitionProject` checks it
 * again inside its own transaction, which is the only one of the three that
 * cannot be beaten by the project moving in between.
 *
 * The id is bound by the page rather than carried in a hidden input, so no
 * field of the form names the project it changes. As with the edit action,
 * that is tidiness rather than a permission check — a server action is a POST
 * endpoint, and the check that makes this project *theirs* belongs here when
 * Phase 8 adds accounts.
 */
export async function transitionProjectAction(
  id: string,
  _previous: TransitionFormState,
  formData: FormData,
): Promise<TransitionFormState> {
  const fields = readTransitionFields(formData);

  const current = await getProject(id);
  if (current === null) {
    return failedFormState(fields, "That project no longer exists.");
  }

  const parsed = parseTransitionForm(fields, current.status);
  if (!parsed.ok) return rejectedFormState(fields, parsed.errors);

  let result;
  try {
    result = await transitionProject(id, parsed.value.status, {
      reason: parsed.value.reason,
    });
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("transitionProjectAction: failed to move project", error);
    return failedFormState(
      fields,
      "Could not change the status. Nothing was written — try again.",
    );
  }

  /**
   * The row moved between the read above and the transaction below it. The
   * problem carries its own sentence — "already closed", "no longer exists" —
   * and it belongs to the submission rather than to a field, because by now
   * the form on screen is describing a project that is gone.
   */
  if (!result.ok) return failedFormState(fields, result.problem.message);

  // Back to the project itself, where the badge, the lifecycle sentence and
  // the trail all now say something different.
  // Outside the try: `redirect` signals by throwing, and catching it here
  // would turn a successful move into a "could not change" message.
  revalidatePath(PROJECTS_PATH);
  revalidatePath(projectPath(id));
  redirect(projectPath(id));
}
