"use server";

import { revalidatePath } from "next/cache";

import {
  createDeliverable,
  getDeliverable,
  moveDeliverable,
} from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import {
  SCOPE_PROBLEMS,
  SCOPE_WRITE_DONE,
  scopeWriteProblem,
  type ScopeWriteResult,
} from "@/lib/deliverables/arrange";
import {
  addedDeliverableState,
  failedAddState,
  parseDeliverableForm,
  readDeliverableFields,
  rejectedAddState,
  type AddDeliverableState,
} from "@/lib/deliverables/form";
import { isMoveDirection, type MoveDirection } from "@/lib/deliverables/order";
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

/**
 * The deliverable a press names, if it is one of this project's.
 *
 * A server action is a POST endpoint, and the id in a press comes from the
 * page — which means it comes from whoever is holding the page. The project is
 * bound by the component rather than submitted, so the one check worth making
 * here is that the two agree: a deliverable belonging to some other project is
 * not this page's to move, whatever its id says.
 *
 * Gone and somebody-else's are deliberately the same answer. The caller has one
 * sentence for both, which is the honest one — a page that cannot act on a
 * deliverable does not need to be told whether it exists, and saying so would
 * make this endpoint a way of asking.
 */
async function projectDeliverable(projectId: string, id: string) {
  const deliverable = await getDeliverable(id);
  if (deliverable === null) return null;
  if (deliverable.projectId !== projectId) {
    // Not something a reader can cause, so it is worth a line in the log:
    // either the page bound the wrong project or somebody posted an id.
    console.warn(
      `scope action: deliverable ${id} is not on project ${projectId}`,
    );
    return null;
  }
  return deliverable;
}

/**
 * Moving one deliverable a single place up or down its project's scope list.
 *
 * It takes the id and the direction as arguments rather than a `FormData`,
 * because the page does not hand the browser's submission straight on: it reads
 * the press, rearranges the list on screen, and then calls this. The arguments
 * are no more trusted for being typed — a server action is reachable with
 * whatever a caller likes in them — so the direction is narrowed here before it
 * reaches the arithmetic that would otherwise clamp an unknown delta into a
 * move to the top of the list.
 *
 * No redirect and no form state. The reader is looking at the list they are
 * rearranging, the optimistic copy has already moved, and the only thing this
 * has to say is whether the list it was looking at was still real.
 */
export async function moveDeliverableAction(
  projectId: string,
  id: string,
  direction: MoveDirection,
): Promise<ScopeWriteResult> {
  if (!isMoveDirection(direction)) {
    return scopeWriteProblem(SCOPE_PROBLEMS.unknown);
  }

  const deliverable = await projectDeliverable(projectId, id);
  if (deliverable === null) return scopeWriteProblem(SCOPE_PROBLEMS.missing);

  try {
    const moved = await moveDeliverable(id, direction);
    // Deleted between the read above and the move: nothing was written, and
    // the page is describing a list that no longer has it.
    if (moved === null) return scopeWriteProblem(SCOPE_PROBLEMS.missing);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("moveDeliverableAction: failed to move deliverable", error);
    return scopeWriteProblem(SCOPE_PROBLEMS.failed);
  }

  // The list is part of the page, so the order the server renders only changes
  // once the page is re-rendered. Until it is, what the reader sees is the
  // optimistic copy.
  revalidatePath(projectPath(projectId));
  return SCOPE_WRITE_DONE;
}
