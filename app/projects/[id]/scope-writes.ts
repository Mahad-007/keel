/**
 * The writes a project's scope list can ask for.
 *
 * Plain async functions, and the absent `"use server"` at the top of this file
 * is the point. A `"use server"` module exports an endpoint per function: each
 * one is registered as a server reference and can be POSTed directly with
 * whatever arguments the caller likes, `projectId` included. That left the
 * check in `projectDeliverable` comparing two values from the same source no
 * matter how carefully the page passed them.
 *
 * So these are not actions. The only registered references for this page are
 * the `"use server"` closures in `deliverable-list.tsx` and `scope-panel.tsx`,
 * which capture the project — encrypted, because that is the one form the
 * compiler rewrites — and call in here. There is no second way in that skips
 * the capture.
 *
 * They still take `projectId` as a parameter, which is what makes them testable
 * without a page. The difference is that nothing reachable from the wire gets to
 * choose it.
 */

import { revalidatePath } from "next/cache";

import {
  createDeliverable,
  getDeliverable,
  moveDeliverable,
  setDeliverableStatus,
  updateDeliverable,
} from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import {
  SCOPE_PROBLEMS,
  SCOPE_WRITE_DONE,
  scopeWriteProblem,
  staleStatusProblem,
  type ScopeWriteResult,
} from "@/lib/deliverables/arrange";
import {
  changesDeliverable,
  deliverableChanges,
  EDIT_PROBLEMS,
  failedEditState,
  readEditId,
  rejectedEditState,
  savedEditState,
  type EditDeliverableState,
} from "@/lib/deliverables/edit";
import {
  addedDeliverableState,
  deliverableFormFields,
  failedAddState,
  parseDeliverableForm,
  readDeliverableFields,
  rejectedAddState,
  type AddDeliverableState,
} from "@/lib/deliverables/form";
import { isMoveDirection, type MoveDirection } from "@/lib/deliverables/order";
import {
  isDeliverableStatus,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
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
 * The project id comes from the page's closure rather than from the submission,
 * so no field of a form and no argument of a POST can name the project this
 * writes to. That is worth more than tidiness and still less than a permission
 * check: it says which page made the call, not who was holding it. The check
 * that makes this project *theirs* belongs here, from the session, when Phase 8
 * adds accounts.
 */
export async function writeNewDeliverable(
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
    console.error("writeNewDeliverable: failed to write deliverable", error);
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
 * The id in a press comes from the page, which means it comes from whoever is
 * holding the page: it rides in the submission and a caller can put anything
 * there. The project does not — it is captured by the page's closure and
 * encrypted, and this module is not a `"use server"` module, so there is no
 * endpoint that takes it as an argument. That asymmetry is the whole point of
 * this function: the id is forgeable and the project is not, so the one check
 * worth making is that the two agree. A deliverable belonging to some other
 * project is not this page's to move, whatever its id says.
 *
 * It is not an ownership check, and Phase 8 must not read it as one. All it
 * establishes is that the press names a deliverable of the project this page
 * was served for. Whether the reader was entitled to that page is a question
 * about a session, and the answer has to be derived from the session here —
 * never from `projectId`, however unforgeable it is, because an unforgeable
 * value is still only a statement about which page made the call.
 *
 * Gone and somebody-else's are deliberately the same answer. The caller has one
 * sentence for both, which is the honest one — a page that cannot act on a
 * deliverable does not need to be told whether it exists, and saying so would
 * make this endpoint a way of asking.
 *
 * Nor is the id taken on trust for being typed as a string. It arrives over the
 * wire like every other argument here, and anything that is not a string would
 * reach the driver as a bound parameter and come back as an error about SQL
 * rather than as an answer about a deliverable. Not a string is not a
 * deliverable, which is the same answer as not being one of this project's.
 */
async function projectDeliverable(projectId: string, id: unknown) {
  if (typeof id !== "string" || id.trim() === "") return null;

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
export async function writeDeliverableMove(
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
    console.error("writeDeliverableMove: failed to move deliverable", error);
    return scopeWriteProblem(SCOPE_PROBLEMS.failed);
  }

  // The list is part of the page, so the order the server renders only changes
  // once the page is re-rendered. Until it is, what the reader sees is the
  // optimistic copy.
  revalidatePath(projectPath(projectId));
  return SCOPE_WRITE_DONE;
}

/**
 * Moving one deliverable to the next status in its cycle.
 *
 * `from` is where the row stood when the button was drawn, and it is checked
 * twice on the way through. Once here, against the row as read, so the sentence
 * that comes back can say what the row actually holds — and once inside
 * `setDeliverableStatus`, as part of the statement that writes it, which is the
 * check that cannot be beaten by somebody else pressing at the same moment.
 *
 * Only the destination is narrowed. A typed argument to a server action is a
 * promise the caller makes rather than one the runtime keeps, and a status that
 * is about to be written has to be one of ours — but `from` is only ever
 * compared against the row, so anything it does not match is already refused,
 * including whatever a hand-edited row is holding.
 */
export async function writeDeliverableStatus(
  projectId: string,
  id: string,
  from: string,
  to: DeliverableStatus,
): Promise<ScopeWriteResult> {
  if (!isDeliverableStatus(to)) {
    return scopeWriteProblem(SCOPE_PROBLEMS.unknown);
  }

  const deliverable = await projectDeliverable(projectId, id);
  if (deliverable === null) return scopeWriteProblem(SCOPE_PROBLEMS.missing);

  const stale = staleStatusProblem(deliverable, from);
  if (stale !== null) return scopeWriteProblem(stale);

  let written;
  try {
    written = await setDeliverableStatus(id, from, to);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("writeDeliverableStatus: failed to write status", error);
    return scopeWriteProblem(SCOPE_PROBLEMS.failed);
  }

  // The row passed the check above and still did not match: it was deleted or
  // pressed again in the moment between. Nothing was written either way.
  if (written === null) return scopeWriteProblem(SCOPE_PROBLEMS.raced);

  // The status is rendered from the row, so the words beside the line only
  // change once the page is re-rendered.
  revalidatePath(projectPath(projectId));
  return SCOPE_WRITE_DONE;
}

/**
 * Saving an edit to one line of a project's scope.
 *
 * One action for every row, which is why the id is in the submission: a scope
 * list of eight lines would otherwise register eight server references, and the
 * row a save is aimed at is exactly the kind of thing a form says. The project
 * is not in the submission — it comes from the page's closure, and the check
 * that the two agree is the whole reason the id being forgeable does not matter.
 *
 * Like the add line, it does not redirect: the reader is looking at the list
 * they are editing. What comes back is a state the row can close itself on, or
 * the messages it has to stay open holding.
 */
export async function writeDeliverableEdit(
  projectId: string,
  _previous: EditDeliverableState,
  formData: FormData,
): Promise<EditDeliverableState> {
  const fields = readDeliverableFields(formData);

  const parsed = parseDeliverableForm(fields);
  if (!parsed.ok) return rejectedEditState(fields, parsed.errors);

  const before = await projectDeliverable(projectId, readEditId(formData));
  if (before === null) return failedEditState(fields, EDIT_PROBLEMS.missing);

  /*
    A form opened to read the detail and saved untouched is not a write. Writing
    it anyway would bump `updatedAt` and mark the line as edited today, which is
    how a scope list stops being able to say which line actually moved.
  */
  const patch = deliverableChanges(before, parsed.value);
  if (!changesDeliverable(patch)) {
    return savedEditState(
      { id: before.id, title: before.title, changed: false },
      deliverableFormFields(before),
    );
  }

  let saved;
  try {
    saved = await updateDeliverable(before.id, patch);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("writeDeliverableEdit: failed to save deliverable", error);
    return failedEditState(fields, EDIT_PROBLEMS.failed);
  }

  // Deleted between the read above and the update: nothing was written, and the
  // page is describing a list that no longer has the row.
  if (saved === null) return failedEditState(fields, EDIT_PROBLEMS.missing);

  // The line is part of the page, so the words beside it only change once the
  // page is re-rendered.
  revalidatePath(projectPath(projectId));
  return savedEditState(
    { id: saved.id, title: saved.title, changed: true },
    deliverableFormFields(saved),
  );
}
