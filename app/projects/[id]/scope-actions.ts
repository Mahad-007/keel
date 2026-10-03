"use server";

import { revalidatePath } from "next/cache";

import { createDeliverable } from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import {
  addedDeliverableState,
  failedAddState,
  parseDeliverableForm,
  readDeliverableFields,
  rejectedAddState,
  type AddDeliverableState,
} from "@/lib/deliverables/form";
import { projectPath } from "@/lib/projects/detail";

/**
 * Adding one line to a project's scope.
 *
 * The one thing that makes this different from every other write in the app:
 * it does not redirect. Scope is typed in a run — four things were agreed,
 * four lines get written — and a redirect per line would reload the page and
 * throw the cursor away three times. So the action returns a state, the form
 * stays mounted, and the list above it is revalidated to show what landed.
 *
 * The project id is bound by the page rather than carried in a hidden input,
 * so no field of the form names the project it writes to. That is tidiness
 * rather than a permission check — a server action is a POST endpoint, and
 * the check that makes this project *theirs* belongs here when Phase 8 adds
 * accounts.
 */
export async function addDeliverableAction(
  projectId: string,
  _previous: AddDeliverableState,
  formData: FormData,
): Promise<AddDeliverableState> {
  const fields = readDeliverableFields(formData);

  const parsed = parseDeliverableForm(fields);
  if (!parsed.ok) return rejectedAddState(fields, parsed.errors);

  /*
    A deliverable with no project is refused by the data layer anyway, inside
    the transaction that would have written it, and the message it raises
    names a column. This one names the situation: the page has been open while
    the project was deleted somewhere else, and "try again" — what every other
    failure here advises — is the one thing that will not work.
  */
  const project = await getProject(projectId);
  if (project === null) {
    return failedAddState(
      fields,
      "That project no longer exists, so there is nothing to add scope to.",
    );
  }

  let deliverable;
  try {
    deliverable = await createDeliverable({ projectId, ...parsed.value });
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("addDeliverableAction: failed to write deliverable", error);
    return failedAddState(
      fields,
      "Could not add that deliverable. Nothing was written — try again.",
    );
  }

  // The list above the form is part of the page, so it only shows the new
  // line once the page is re-rendered.
  revalidatePath(projectPath(projectId));
  return addedDeliverableState({
    id: deliverable.id,
    title: deliverable.title,
  });
}
